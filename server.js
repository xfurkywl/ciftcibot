const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- KULLANICI AYARLARI ---
const SIFRE = process.env.BOT_PASSWORD || 'otimesafk69..';
const BOT_ADI = process.env.BOT_NAME || 'arxen';
const SUNUCU_IP = process.env.SERVER_IP || 'play.sezoncraft.com';
const PORT = process.env.PORT || 3000;
// --------------------------

let bot = null;
let botDurumu = 'Çevrimdışı';
let toplamKazanc = 0;
let islemSayisi = 0;
let sonIslemZamani = null;
let loglar = [];
let botCalisiyorMu = false;
let donguAktif = false; // YENİ: Döngü kontrolü için flag
let sonIslemSuresi = 0; // YENİ: Son işlem zamanını takip et

// Static dosyaları serve et
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint'leri
app.get('/api/status', (req, res) => {
    res.json({
        durum: botDurumu,
        toplamKazanc,
        islemSayisi,
        sonIslemZamani,
        botAdi: BOT_ADI,
        sunucu: SUNUCU_IP,
        aktif: botCalisiyorMu
    });
});

app.get('/api/logs', (req, res) => {
    res.json({ logs: loglar.slice(-100) }); // Son 100 log
});

app.post('/api/start', (req, res) => {
    if (botCalisiyorMu) {
        return res.json({ success: false, message: 'Bot zaten çalışıyor!' });
    }
    baslatBot();
    res.json({ success: true, message: 'Bot başlatılıyor...' });
});

app.post('/api/stop', (req, res) => {
    if (!botCalisiyorMu) {
        return res.json({ success: false, message: 'Bot zaten durmuş!' });
    }
    durdurBot();
    res.json({ success: true, message: 'Bot durduruluyor...' });
});

app.post('/api/command', (req, res) => {
    const { command } = req.body;
    if (!bot || !botCalisiyorMu) {
        return res.json({ success: false, message: 'Bot aktif değil!' });
    }
    bot.chat(command);
    logEkle(`[Komut Gönderildi] ${command}`, 'info');
    res.json({ success: true, message: 'Komut gönderildi!' });
});

// Socket.IO bağlantıları
io.on('connection', (socket) => {
    console.log('Yeni istemci bağlandı');
    
    // İlk bağlantıda durumu gönder
    socket.emit('status', {
        durum: botDurumu,
        toplamKazanc,
        islemSayisi,
        sonIslemZamani,
        aktif: botCalisiyorMu
    });
    
    socket.emit('logs', loglar.slice(-50));
    
    socket.on('disconnect', () => {
        console.log('İstemci bağlantısı kesildi');
    });
});

function logEkle(mesaj, tip = 'info') {
    const zaman = new Date().toLocaleString('tr-TR');
    const logObjesi = { zaman, mesaj, tip };
    loglar.push(logObjesi);
    
    // 500'den fazla log tutma
    if (loglar.length > 500) {
        loglar = loglar.slice(-500);
    }
    
    console.log(`[${zaman}] ${mesaj}`);
    io.emit('newLog', logObjesi);
}

function durumGuncelle() {
    const durum = {
        durum: botDurumu,
        toplamKazanc,
        islemSayisi,
        sonIslemZamani,
        aktif: botCalisiyorMu
    };
    io.emit('status', durum);
}

function baslatBot() {
    if (botCalisiyorMu) return;
    
    botCalisiyorMu = true;
    botDurumu = 'Bağlanıyor...';
    logEkle('🤖 Bot başlatılıyor...', 'success');
    durumGuncelle();
    
    bot = mineflayer.createBot({
        host: SUNUCU_IP,
        username: BOT_ADI,
        version: '1.20.1'
    });
    
    let isFirstSpawn = true;
    
    // SOHBET TAKİBİ
    bot.on('message', (message) => {
        const msg = message.toString();
        
        if (msg.trim().length > 0) {
            logEkle(`💬 ${msg}`, 'chat');
        }
        
        // Satış mesajını yakala
        if (msg.includes('Ürünler') && msg.includes('dinar karşılığında satıldı')) {
            const mesajIcerigi = msg.split('Ürünler')[1];
            const miktarEslesmesi = mesajIcerigi.match(/\d+([,.]\d+)?/);
            
            if (miktarEslesmesi) {
                const hamMiktar = miktarEslesmesi[0].replace(',', '.');
                const tamSayiKazanc = Math.floor(parseFloat(hamMiktar));
                
                if (!isNaN(tamSayiKazanc) && tamSayiKazanc > 0) {
                    toplamKazanc += tamSayiKazanc;
                    islemSayisi++;
                    sonIslemZamani = new Date().toLocaleString('tr-TR');
                    
                    setTimeout(() => {
                        logEkle(`💰 Kazanç: ${tamSayiKazanc} dinar - Yatırılıyor...`, 'success');
                        bot.chat(`/is deposit ${tamSayiKazanc}`);
                        durumGuncelle();
                    }, 1500);
                }
            }
        }
    });
    
    // 5-10 DAKİKA ARASI RASTGELE DÖNGÜ - GÜVENLİ VERSİYON
    function baslatCiftciDongusu() {
        if (!botCalisiyorMu || donguAktif) {
            logEkle('⚠️ Döngü zaten aktif veya bot durmuş, yeni döngü başlatılmadı', 'warning');
            return;
        }
        
        // Son işlemden bu yana yeterli süre geçti mi kontrol et
        const simdikiZaman = Date.now();
        const gecenSure = simdikiZaman - sonIslemSuresi;
        
        if (sonIslemSuresi > 0 && gecenSure < 4 * 60 * 1000) { // 4 dakikadan az geçtiyse
            logEkle(`⚠️ Çok erken! Son işlemden sadece ${(gecenSure/60000).toFixed(1)} dakika geçti. Minimum 4 dakika beklenmeli. İptal ediliyor.`, 'warning');
            return;
        }
        
        donguAktif = true; // Döngüyü kilitle
        
        const min = 5 * 60 * 1000;  // 5 dakika (300000 ms)
        const max = 10 * 60 * 1000; // 10 dakika (600000 ms)
        const rastgeleSure = Math.floor(Math.random() * (max - min + 1)) + min;
        
        const dakika = (rastgeleSure / 60000).toFixed(2);
        const sonrakiZaman = new Date(Date.now() + rastgeleSure);
        const saatDakika = sonrakiZaman.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        
        logEkle(`⏰ Sonraki işlem ${dakika} dakika sonra (${saatDakika})`, 'info');
        
        setTimeout(() => {
            if (!botCalisiyorMu) {
                logEkle('⚠️ Bot durdurulmuş, işlem iptal edildi', 'warning');
                donguAktif = false;
                return;
            }
            
            sonIslemSuresi = Date.now(); // İşlem zamanını kaydet
            logEkle('🌾 Çiftçi menüsü açılıyor...', 'info');
            bot.chat('/çiftçi');
            
            // Döngüyü serbest bırak ve yeni döngüyü başlat
            setTimeout(() => {
                donguAktif = false;
                baslatCiftciDongusu();
            }, 3000); // Menü açılması için 3 saniye bekle
            
        }, rastgeleSure);
    }
    
    // GİRİŞ VE BAĞLANTI - GÜNCELLENMIŞ
    bot.on('spawn', () => {
        if (isFirstSpawn) {
            isFirstSpawn = false;
            botDurumu = 'Giriş yapılıyor...';
            logEkle('✅ Sunucuya bağlanıldı!', 'success');
            durumGuncelle();
            
            setTimeout(() => {
                bot.chat(`/login ${SIFRE}`);
                logEkle('🔐 Giriş yapılıyor...', 'info');
                
                setTimeout(() => {
                    bot.chat('/skyblock');
                    logEkle('🏝️ Skyblock\'a gidiliyor...', 'info');
                    
                    setTimeout(() => {
                        bot.chat('/is go');
                        logEkle('🏢 İş yerine gidiliyor...', 'info');
                        
                        setTimeout(() => {
                            bot.chat('/çiftçi');
                            botDurumu = 'Aktif - Çalışıyor';
                            logEkle('🚀 Bot aktif! Otomasyon başladı.', 'success');
                            sonIslemSuresi = Date.now(); // İlk işlem zamanını kaydet
                            durumGuncelle();
                            
                            // İlk döngüyü başlat
                            setTimeout(() => {
                                donguAktif = false; // Flag'i sıfırla
                                baslatCiftciDongusu();
                            }, 5000);
                        }, 5000);
                    }, 8000);
                }, 5000);
            }, 3000);
        } else {
            // Sonraki spawn'lar (TP, ada değişimi vs.) - Döngüyü yeniden başlatma
            logEkle('📍 Konum değişti (spawn event) - Döngü devam ediyor', 'info');
        }
    });
    
    // MENÜ TIKLAMA
    bot.on('windowOpen', async (window) => {
        const targetSlot = 24;
        
        setTimeout(async () => {
            try {
                await bot.clickWindow(targetSlot, 1, 1);
                logEkle('🖱️ Slot 24\'e tıklandı (Kaktüs)', 'success');
                
                setTimeout(() => {
                    bot.closeWindow(window);
                }, 1000);
            } catch (err) {
                logEkle(`❌ Tıklama hatası: ${err.message}`, 'error');
            }
        }, 2000);
    });
    
    bot.on('error', (err) => {
        logEkle(`❌ Bot hatası: ${err.message}`, 'error');
        botDurumu = 'Hata';
        durumGuncelle();
    });
    
    bot.on('kicked', (reason) => {
        logEkle(`⚠️ Sunucudan atıldı: ${reason}`, 'error');
        botDurumu = 'Atıldı';
        botCalisiyorMu = false;
        donguAktif = false;
        durumGuncelle();
    });
    
    bot.on('end', () => {
        logEkle('🔌 Bot bağlantısı kesildi', 'warning');
        botDurumu = 'Çevrimdışı';
        botCalisiyorMu = false;
        donguAktif = false;
        durumGuncelle();
    });
}

function durdurBot() {
    if (bot) {
        bot.quit();
        bot = null;
    }
    botCalisiyorMu = false;
    donguAktif = false; // Flag'i sıfırla
    sonIslemSuresi = 0; // Zaman sayacını sıfırla
    botDurumu = 'Durduruldu';
    logEkle('⏹️ Bot durduruldu', 'warning');
    durumGuncelle();
}

// Sunucu başlatma
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════╗
║ 🌾 ÇİFTÇİ SATIŞ BOTU - WEB PANEL     ║
╚═══════════════════════════════════════╝

🌐 Web Panel: http://localhost:${PORT}
🤖 Bot: ${BOT_ADI}
🖥️ Sunucu: ${SUNUCU_IP}
⏱️  İşlem Aralığı: 5-10 dakika
    `);
    
    logEkle('🌐 Web sunucusu başlatıldı', 'success');
    
    // Otomatik başlatma (Railway için)
    if (process.env.AUTO_START !== 'false') {
        setTimeout(() => {
            baslatBot();
        }, 2000);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM sinyali alındı, bot durduruluyor...');
    durdurBot();
    server.close(() => {
        console.log('Sunucu kapatıldı');
        process.exit(0);
    });
});
