# Konuşmak İster Misin? 💬

Anonim ve gerçek zamanlı sohbet uygulaması. Kullanıcılar konuşmacı veya dinleyici olarak eşleşir ve güvenli bir ortamda sohbet ederler.

## 🚀 Özellikler

- **Anonim Sohbet**: Kimlik doğrulama gerektirmez
- **Gerçek Zamanlı Eşleşme**: Firebase Realtime Database ile anlık eşleşme
- **Rol Tabanlı Sistem**: Konuşmacı ve Dinleyici rolleri
- **Canlı Mesajlaşma**: Anlık mesaj gönderme ve alma
- **Presence Tracking**: Kullanıcı durumu takibi
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu

## 🛠️ Teknolojiler

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Firebase Realtime Database
- **Deployment**: Vercel

## 🏃‍♂️ Yerel Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Tarayıcıda aç
http://localhost:3000
```

## 🔥 Firebase Kurulumu

1. Firebase Console'da yeni proje oluştur
2. Realtime Database'i etkinleştir
3. Güvenlik kurallarını ayarla (firebase-rules.json)
4. Web uygulaması ekle ve config bilgilerini al
5. `src/lib/firebase.ts` dosyasını güncelle

## 📱 Kullanım

1. Ana sayfada rol seç (Konuşmacı/Dinleyici)
2. Eşleşme kuyruğuna katıl
3. Eşleşme bulununca sohbete başla
4. Gerçek zamanlı mesajlaşma yap

## 🔒 Güvenlik

- Tamamen anonim kullanım
- Kimlik doğrulama gerektirmez
- Firebase güvenlik kuralları ile korunur
- Kullanıcı verileri saklanmaz

## 🌐 Canlı Demo

[https://konusmak-ister-misin.vercel.app](https://konusmak-ister-misin.vercel.app)

## 📄 Lisans

MIT License
