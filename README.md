# 🌾 Çiftçi Satış Botu - Web Panel

Minecraft Skyblock sunucusu için otomatik çiftçi ürünleri satış botu. Modern web arayüzü ile bot kontrolü ve canlı log takibi.

![Bot Dashboard](https://img.shields.io/badge/Status-Active-success)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Railway](https://img.shields.io/badge/Deploy-Railway-purple)

## ✨ Özellikler

- 🎮 **Otomatik Satış**: 13-15 dakika arası rastgele aralıklarla otomatik çiftçi menüsü
- 💰 **Akıllı Yatırma**: Satış kazançlarını otomatik olarak `/is deposit` ile yatırır
- 🌐 **Web Arayüzü**: Modern, responsive kontrol paneli
- 📊 **Canlı İstatistikler**: Toplam kazanç, işlem sayısı ve ortalama kazanç
- 📜 **Gerçek Zamanlı Loglar**: Socket.IO ile canlı log takibi
- 🎛️ **Manuel Kontrol**: Web üzerinden bot başlatma/durdurma ve komut gönderme
- 🔄 **Otomatik Yeniden Başlatma**: Railway'de otomatik başlatma

## 🚀 Railway'de Kurulum

### 1. Repository Oluşturma

GitHub'da yeni bir repository oluşturun ve dosyaları yükleyin:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI_ADINIZ/ciftci-bot.git
git push -u origin main
```

### 2. Railway'e Deploy

1. [Railway.app](https://railway.app) sitesine gidin ve giriş yapın
2. "New Project" → "Deploy from GitHub repo" seçin
3. Repository'nizi seçin
4. Otomatik deploy başlayacak

### 3. Environment Variables (Ortam Değişkenleri)

Railway dashboard'da **Variables** sekmesine gidin ve şu değişkenleri ekleyin:

```env
BOT_PASSWORD=otimesafk69..
BOT_NAME=arxen
SERVER_IP=play.sezoncraft.com
AUTO_START=true
PORT=3000
```

**Önemli:** Şifrenizi ve bot adınızı kendi bilgilerinizle değiştirin!

### 4. Domain Ayarlama

Railway otomatik bir domain verir (örn: `your-app.up.railway.app`). 
- Settings → Networking → Generate Domain

## 💻 Yerel Kurulum (Test için)

```bash
# Bağımlılıkları yükle
npm install

# Botu başlat
npm start
```

Tarayıcınızda `http://localhost:3000` adresini açın.

## 🎮 Kullanım

### Web Paneli

1. Railway URL'inizi tarayıcınızda açın
2. **Başlat** butonuna tıklayın
3. Bot otomatik olarak:
   - Sunucuya bağlanır
   - Giriş yapar (`/login`)
   - Skyblock'a gider (`/skyblock`)
   - İş yerine gider (`/is go`)
   - Çiftçi menüsünü açar (`/çiftçi`)
   - Kaktüse tıklar ve satışı başlatır

### Manuel Komutlar

Web panelindeki "Manuel Komut" bölümünden istediğiniz komutu gönderebilirsiniz:

- `/çiftçi` - Çiftçi menüsünü aç
- `/is go` - İş yerine git
- `/bal` - Bakiye kontrol
- `/spawn` - Spawn'a ışınlan

## 📊 İstatistikler

Panel üzerinde şunları görebilirsiniz:

- **Bot Durumu**: Çevrimdışı, Bağlanıyor, Aktif, vb.
- **Toplam Kazanç**: Tüm satışlardan elde edilen toplam dinar
- **İşlem Sayısı**: Kaç kez satış yapıldı
- **Son İşlem**: En son satışın zamanı
- **Ortalama Kazanç**: İşlem başına ortalama kazanç

## 🔧 Ayarlar

### Bot Zamanlama

`server.js` dosyasında döngü süresini değiştirebilirsiniz:

```javascript
const min = 13 * 60 * 1000;  // Minimum 13 dakika
const max = 15 * 60 * 1000;  // Maksimum 15 dakika
```

### Tıklama Konumu

Farklı bir slot'a tıklamak için:

```javascript
const targetSlot = 24;  // 25. slot (index 24)
```

## 🐛 Sorun Giderme

### Bot Bağlanamıyor

1. Sunucu IP'sini kontrol edin
2. Minecraft versiyonunu kontrol edin (şu anda `1.20.1`)
3. Şifrenizin doğru olduğundan emin olun

### Railway'de Çalışmıyor

1. Environment variables doğru ayarlandı mı?
2. Logs'u kontrol edin: Railway Dashboard → Deployments → View Logs
3. `AUTO_START=true` değişkenini eklediniz mi?

### Bot Atıldı

- Sunucu anti-bot koruması olabilir
- Zamanlama aralıklarını artırın (15-20 dakika)
- VPN kullanmayı deneyin

## 📝 Notlar

- Bot 24/7 çalışabilir (Railway free plan'da 500 saat/ay limit var)
- Loglar maksimum 500 adet tutulur
- Web paneli üzerinden komut göndererek test edebilirsiniz
- Kazançlar otomatik olarak `/is deposit` ile yatırılır

## ⚠️ Uyarı

Bu bot eğitim amaçlıdır. Kullanırken sunucu kurallarına uyun ve sorumluluğunuz size aittir.

## 📞 Destek

Sorun yaşarsanız:
1. Railway logs'unu kontrol edin
2. Web panelindeki log ekranına bakın
3. Environment variables'ı kontrol edin

## 📄 Lisans

ISC License

---

**Geliştirici Notu**: Bot Railway'de otomatik olarak başlar. Durdurmak için web panelinden "Durdur" butonunu kullanın.
