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
let donguTimeout = null;
let sonIslemSuresi = 0;
let menuIslemde = false; // DÜZELTME: Menü kilidi
let yenidenBaglanTimeout = null; // Reconnect timeout
let yenidenBaglanAktif = false;  // Reconnect döngüsü aktif mi

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
    res.json({ logs: loglar.slice(-100) });
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

function zamanlanmisYenidenBaglan() {
    // Zaten reconnect döngüsündeyse tekrar başlatma
    if (yenidenBaglanAktif) return;
    yenidenBaglanAktif = true;

    let deneme = 1;

    function dene() {
        if (!yenidenBaglanAktif) return;

        logEkle(`🔄 Yeniden bağlanma denemesi #${deneme} (15 saniyede bir)...`, 'warning');
        botDurumu = `Yeniden bağlanıyor... (Deneme #${deneme})`;
        durumGuncelle();

        baslatBot();

        // Bot başarıyla bağlandıysa (spawn event'i tetiklenince botCalisiyorMu true olur)
        // Başarısız olursa 15 saniye sonra tekrar dene
        yenidenBaglanTimeout = setTimeout(() => {
            if (!botCalisiyorMu) {
                deneme++;
                dene();
            } else {
                // Başarıyla bağlandı
                yenidenBaglanAktif = false;
                logEkle('✅ Yeniden bağlantı başarılı!', 'success');
            }
        }, 15000);
    }

    dene();
}

function baslatBot() {
    if (botCalisiyorMu) return;

    botCalisiyorMu = true;
    menuIslemde = false;
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

                    // DÜZELTME: Deposit gecikmesi artırıldı (anti-cheat için)
                    setTimeout(() => {
                        if (!botCalisiyorMu) return;
                        logEkle(`💰 Kazanç: ${tamSayiKazanc} dinar - Yatırılıyor...`, 'success');
                        bot.chat(`/is deposit ${tamSayiKazanc}`);
                        durumGuncelle();
                    }, 3000); // 1500 → 3000ms
                }
            }
        }
    });

    // DÖNGÜ FONKSİYONU
    function baslatCiftciDongusu() {
        if (!botCalisiyorMu) {
            logEkle('⚠️ Bot durmuş, döngü başlatılmadı', 'warning');
            return;
        }

        if (donguTimeout) {
            clearTimeout(donguTimeout);
            donguTimeout = null;
        }

        // DÜZELTME: Süre 10-15 dakikaya çıkarıldı (anti-cheat için)
        const min = 10 * 60 * 1000;
        const max = 15 * 60 * 1000;
        const rastgeleSure = Math.floor(Math.random() * (max - min + 1)) + min;

        const dakika = (rastgeleSure / 60000).toFixed(2);
        const sonrakiZaman = new Date(Date.now() + rastgeleSure);
        const saatDakika = sonrakiZaman.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        logEkle(`⏰ Sonraki işlem ${dakika} dakika sonra (${saatDakika})`, 'info');

        donguTimeout = setTimeout(() => {
            if (!botCalisiyorMu) {
                logEkle('⚠️ Bot durdurulmuş, işlem iptal edildi', 'warning');
                return;
            }

            sonIslemSuresi = Date.now();
            logEkle('🌾 Çiftçi menüsü açılıyor...', 'info');
            bot.chat('/çiftçi');

            // DÜZELTME: Sonraki döngü gecikmesi artırıldı
            setTimeout(() => {
                baslatCiftciDongusu();
            }, 8000); // 5000 → 8000ms

        }, rastgeleSure);
    }

    // GİRİŞ VE BAĞLANTI
    bot.on('spawn', () => {
        if (isFirstSpawn) {
            isFirstSpawn = false;
            // Başarıyla bağlandı, reconnect döngüsünü iptal et
            yenidenBaglanAktif = false;
            if (yenidenBaglanTimeout) {
                clearTimeout(yenidenBaglanTimeout);
                yenidenBaglanTimeout = null;
            }
            botDurumu = 'Giriş yapılıyor...';
            logEkle('✅ Sunucuya bağlanıldı!', 'success');
            durumGuncelle();

            // DÜZELTME: Tüm komut gecikmeleri artırıldı (anti-cheat için)
            setTimeout(() => {
                if (!botCalisiyorMu) return;
                bot.chat(`/login ${SIFRE}`);
                logEkle('🔐 Giriş yapılıyor...', 'info');

                setTimeout(() => {
                    if (!botCalisiyorMu) return;
                    bot.chat('/skyblock');
                    logEkle('🏝️ Skyblock\'a gidiliyor...', 'info');

                    setTimeout(() => {
                        if (!botCalisiyorMu) return;
                        bot.chat('/is go');
                        logEkle('🏢 İş yerine gidiliyor...', 'info');

                        setTimeout(() => {
                            if (!botCalisiyorMu) return;
                            bot.chat('/çiftçi');
                            botDurumu = 'Aktif - Çalışıyor';
                            logEkle('🚀 Bot aktif! Otomasyon başladı.', 'success');
                            sonIslemSuresi = Date.now();
                            durumGuncelle();

                            setTimeout(() => {
                                baslatCiftciDongusu();
                            }, 8000); // 5000 → 8000ms

                        }, 18000); // 5000 → 18000ms
                    }, 12000);    // 8000 → 12000ms
                }, 8000);         // 5000 → 8000ms
            }, 5000);             // 3000 → 5000ms

        } else {
            logEkle('📍 Konum değişti (spawn event)', 'info');
        }
    });

    // MENÜ TIKLAMA - DÜZELTME: Kilit mekanizması eklendi
    bot.on('windowOpen', async (window) => {
        // Zaten işlem yapılıyorsa yeni tıklama yapma
        if (menuIslemde) {
            logEkle('⏳ Menü zaten işlemde, bekleniyor...', 'warning');
            return;
        }

        menuIslemde = true;
        const targetSlot = 24;

        // DÜZELTME: Tıklama gecikmesi artırıldı
        setTimeout(async () => {
            if (!botCalisiyorMu) {
                menuIslemde = false;
                return;
            }

            try {
                await bot.clickWindow(targetSlot, 1, 1);
                logEkle('🖱️ Slot 24\'e tıklandı (Kaktüs)', 'success');

                // DÜZELTME: Kapatma gecikmesi artırıldı
                setTimeout(() => {
                    if (!botCalisiyorMu) {
                        menuIslemde = false;
                        return;
                    }
                    bot.closeWindow(window);

                    // Kilidi serbest bırak (kapatmadan sonra biraz bekle)
                    setTimeout(() => {
                        menuIslemde = false;
                        logEkle('✅ Menü işlemi tamamlandı, kilit açıldı', 'info');
                    }, 3000);

                }, 2500); // 1000 → 2500ms

            } catch (err) {
                logEkle(`❌ Tıklama hatası: ${err.message}`, 'error');
                menuIslemde = false;
            }
        }, 4000); // 2000 → 4000ms
    });

    bot.on('error', (err) => {
        logEkle(`❌ Bot hatası: ${err.message}`, 'error');
        botDurumu = 'Hata';
        menuIslemde = false;
        durumGuncelle();
    });

    bot.on('kicked', (reason) => {
        logEkle(`⚠️ Sunucudan atıldı: ${reason}`, 'error');
        botDurumu = 'Atıldı - Yeniden bağlanılacak...';
        botCalisiyorMu = false;
        menuIslemde = false;
        if (donguTimeout) clearTimeout(donguTimeout);
        durumGuncelle();
        zamanlanmisYenidenBaglan();
    });

    bot.on('end', () => {
        logEkle('🔌 Bot bağlantısı kesildi', 'warning');
        botDurumu = 'Çevrimdışı - Yeniden bağlanılacak...';
        botCalisiyorMu = false;
        menuIslemde = false;
        if (donguTimeout) clearTimeout(donguTimeout);
        durumGuncelle();
        zamanlanmisYenidenBaglan();
    });
}

function durdurBot() {
    // Reconnect döngüsünü durdur
    yenidenBaglanAktif = false;
    if (yenidenBaglanTimeout) {
        clearTimeout(yenidenBaglanTimeout);
        yenidenBaglanTimeout = null;
    }

    if (bot) {
        bot.quit();
        bot = null;
    }

    if (donguTimeout) {
        clearTimeout(donguTimeout);
        donguTimeout = null;
    }

    botCalisiyorMu = false;
    menuIslemde = false;
    sonIslemSuresi = 0;
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
⏱️  İşlem Aralığı: 10-15 dakika
    `);

    logEkle('🌐 Web sunucusu başlatıldı', 'success');

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
