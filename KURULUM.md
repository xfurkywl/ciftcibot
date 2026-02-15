# 🚀 RAILWAY HIZLI KURULUM REHBERİ

## Adım 1: GitHub'a Yükle

```bash
# Yeni repository oluştur
git init
git add .
git commit -m "Çiftçi Bot - İlk versiyon"
git remote add origin https://github.com/KULLANICI_ADINIZ/ciftci-bot.git
git push -u origin main
```

## Adım 2: Railway'e Deploy

1. https://railway.app sitesine git
2. GitHub ile giriş yap
3. "New Project" tıkla
4. "Deploy from GitHub repo" seç
5. Repository'ni seç
6. Otomatik deploy başlayacak ✅

## Adım 3: Environment Variables Ekle

Railway Dashboard'da → Variables sekmesi → Add Variables:

```
BOT_PASSWORD=otimesafk69..
BOT_NAME=arxen
SERVER_IP=play.sezoncraft.com
AUTO_START=true
PORT=3000
```

⚠️ **ÖNEMLİ**: Şifreyi ve bot adını kendi bilginizle değiştirin!

## Adım 4: Domain Al

Railway Dashboard'da:
- Settings → Networking → "Generate Domain" tıkla
- Domain'iniz hazır: `https://xxxxx.up.railway.app`

## Adım 5: Tarayıcıda Aç

Domain'inizi tarayıcıda açın ve kontrol panelini görün! 🎉

---

## 📋 Kontrol Listesi

- [ ] Dosyalar GitHub'a yüklendi
- [ ] Railway'de proje oluşturuldu
- [ ] Environment variables eklendi
- [ ] Domain oluşturuldu
- [ ] Web panel açıldı
- [ ] Bot başarıyla çalışıyor

## 🆘 Sorun mu var?

1. **Bot bağlanamıyor**: Environment variables'ı kontrol et
2. **Deploy başarısız**: Railway logs'unu incele
3. **Web panel açılmıyor**: Domain'in aktif olduğundan emin ol

## 📱 Mobil Erişim

Railway domain'inizi mobil tarayıcınızda açarak her yerden bot kontrolü yapabilirsiniz!

---

**Not**: Bot otomatik başlar. Durdurmak için web panelinden "Durdur" butonunu kullan.
