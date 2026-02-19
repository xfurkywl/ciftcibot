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
let menuIslemde = false;
let yenidenBaglanTimeout = null;
let yenidenBaglanAktif = false;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
    if (yenidenBaglanAktif) return;
    yenidenBaglanAktif = true;

    if (bot) {
        try {
            bot.removeAllListeners();
            bot.quit();
        } catch (e) { }
        bot = null;
    }

    if (donguTimeout) {
        clearTimeout(donguTimeout);
        donguTimeout = null;
    }

    menuIslemde = false;
    botCalisiyorMu = false;

    let deneme = 1;

    function dene() {
        if (!yenidenBaglanAktif) return;

        logEkle(`🔄 Yeniden bağlanma denemesi #${deneme} - 15 saniye bekleniyor...`, 'warning');
        botDurumu = `Yeniden bağlanıyor... (Deneme #${deneme})`;
        durumGuncelle();

        yenidenBaglanTimeout = setTimeout(() => {
            if (!yenidenBaglanAktif) return;

            logEkle(`🔌 Bağlantı kuruluyor... (Deneme #${deneme})`, 'info');
            baslatBot();

            yenidenBaglanTimeout = setTimeout(() => {
                if (!botCalisiyorMu && yenidenBaglanAktif) {
                    deneme++;
                    dene();
                }
            }, 20000);

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

    bot.on('message', (message) => {
        const msg = message.toString();
        if (msg.trim().length > 0) {
            logEkle(`💬 ${msg}`, 'chat');
        }

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
                        if (!botCalisiyorMu) return;
                        logEkle(`💰 Kazanç: ${tamSayiKazanc} dinar - Yatırılıyor...`, 'success');
                        bot.chat(`/is deposit ${tamSayiKazanc}`);
                        durumGuncelle();
                    }, 3000);
                }
            }
        }
    });

    function baslatCiftciDongusu() {
        if (!botCalisiyorMu) {
            logEkle('⚠️ Bot durmuş, döngü başlatılmadı', 'warning');
            return;
        }

        if (donguTimeout) {
            clearTimeout(donguTimeout);
            donguTimeout = null;
        }

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

            setTimeout(() => {
                baslatCiftciDongusu();
            }, 8000);

        }, rastgeleSure);
    }

    bot.on('spawn', () => {
        if (isFirstSpawn) {
            isFirstSpawn = false;
            yenidenBaglanAktif = false;
            if (yenidenBaglanTimeout) {
                clearTimeout(yenidenBaglanTimeout);
                yenidenBaglanTimeout = null;
            }
            botDurumu = 'Giriş yapılıyor...';
            logEkle('✅ Sunucuya bağlanıldı!', 'success');
            durumGuncelle();

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
                            }, 8000);

                        }, 18000);
                    }, 12000);
                }, 8000);
            }, 5000);

        } else {
            logEkle('📍 Konum değişti (spawn event)', 'info');
        }
    });

    // ============================================================
    // ANA DÜZELTME: Raw packet ile shift+sağ tık
    // ============================================================
    bot.on('windowOpen', async (window) => {
        // DEBUG: Her açılan pencerenin bilgisini logla
        logEkle(`🪟 Pencere açıldı — Başlık: "${window.title}" | Tip: ${window.type} | Slot sayısı: ${window.slots.length}`, 'info');

        if (menuIslemde) {
            logEkle('⏳ Menü zaten işlemde, bu pencere atlanıyor...', 'warning');
            return;
        }

        // Sadece çiftçi menüsünü işle
        const baslik = window.title ? window.title.toLowerCase() : '';
        const ciftciMenusu = baslik.includes('çiftçi') || baslik.includes('ciftci') || baslik.includes('farmer');

        if (!ciftciMenusu) {
            logEkle(`⏭️ Çiftçi menüsü değil, atlanıyor: "${window.title}"`, 'warning');
            return;
        }

        menuIslemde = true;
        const targetSlot = 24;

        // İnsan gibi rastgele gecikme (4-7 saniye)
        const rastgeleGecikme = Math.floor(Math.random() * 3000) + 4000;
        logEkle(`⏳ Çiftçi menüsü açıldı, ${(rastgeleGecikme / 1000).toFixed(1)}sn sonra tıklanacak...`, 'info');

        setTimeout(async () => {
            if (!botCalisiyorMu) {
                menuIslemde = false;
                return;
            }

            try {
                // Pencere hala açık mı?
                if (!bot.currentWindow || bot.currentWindow.id !== window.id) {
                    logEkle('⚠️ Pencere kapanmış, tıklama iptal edildi', 'warning');
                    menuIslemde = false;
                    return;
                }

                // Slot dolu mu?
                const slot = window.slots[targetSlot];
                if (!slot || slot.type === -1) {
                    logEkle(`⚠️ Slot ${targetSlot} boş, tıklama iptal edildi`, 'warning');
                    menuIslemde = false;
                    return;
                }

                logEkle(`🎯 Slot ${targetSlot} içeriği: ${slot.name || slot.type}`, 'info');

                // -----------------------------------------------
                // RAW PACKET ile shift+sağ tık
                // Mineflayer'ın clickWindow'u yerine direkt protokol paketi
                // -----------------------------------------------
                const stateId = window.stateId || 0;

                bot._client.write('window_click', {
                    windowId: window.id,
                    stateId: stateId,
                    slot: targetSlot,
                    mouseButton: 1,       // sağ tık
                    mode: 1,              // shift modu
                    changedSlotsCount: 0,
                    changedSlots: [],
                    cursorItem: { present: false }
                });

                logEkle(`🖱️ RAW paket gönderildi — Slot ${targetSlot} [shift+sağ tık]`, 'success');

                // Sunucunun işlemesi için bekle — pencereyi biz kapatmıyoruz
                await new Promise(resolve => setTimeout(resolve, 3000));

                menuIslemde = false;
                logEkle('✅ Menü işlemi tamamlandı, kilit açıldı', 'info');

            } catch (err) {
                logEkle(`❌ Tıklama hatası: ${err.message}`, 'error');
                menuIslemde = false;
            }
        }, rastgeleGecikme);
    });

    // Pencere kapandığında kilidi serbest bırak
    bot.on('windowClose', () => {
        if (menuIslemde) {
            logEkle('🔓 Pencere kapandı, kilit açılıyor...', 'info');
            menuIslemde = false;
        }
    });

    bot.on('error', (err) => {
        logEkle(`❌ Bot hatası: ${err.message}`, 'error');
        botDurumu = 'Hata';
        menuIslemde = false;
        durumGuncelle();
    });

    bot.on('kicked', (reason) => {
        logEkle(`⚠️ Sunucudan atıldı (RAW): ${JSON.stringify(reason)}`, 'error');
        botDurumu = 'Atıldı - Yeniden bağlanılacak...';
        botCalisiyorMu = false;
        menuIslemde = false;
        if (donguTimeout) clearTimeout(donguTimeout);
        try { bot.removeAllListeners(); } catch (e) { }
        durumGuncelle();
        zamanlanmisYenidenBaglan();
    });

    bot.on('end', (reason) => {
        logEkle(`🔌 Bot bağlantısı kesildi${reason ? ' — Neden: ' + reason : ''}`, 'warning');
        botDurumu = 'Çevrimdışı - Yeniden bağlanılacak...';
        botCalisiyorMu = false;
        menuIslemde = false;
        if (donguTimeout) clearTimeout(donguTimeout);
        try { bot.removeAllListeners(); } catch (e) { }
        durumGuncelle();
        zamanlanmisYenidenBaglan();
    });
}

function durdurBot() {
    yenidenBaglanAktif = false;
    if (yenidenBaglanTimeout) {
        clearTimeout(yenidenBaglanTimeout);
        yenidenBaglanTimeout = null;
    }

    if (bot) {
        try { bot.quit(); } catch (e) { }
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

process.on('SIGTERM', () => {
    console.log('SIGTERM sinyali alındı, bot durduruluyor...');
    durdurBot();
    server.close(() => {
        console.log('Sunucu kapatıldı');
        process.exit(0);
    });
});
