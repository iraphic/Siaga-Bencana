# SiagaBencana AI 🚨

Aplikasi asisten darurat cerdas berbasis AI untuk mitigasi dan respon cepat bencana alam di Indonesia.

## 📖 Latar Belakang
Indonesia terletak di wilayah *Ring of Fire*, menjadikannya salah satu negara dengan tingkat kerawanan bencana alam tertinggi di dunia. Gempa bumi, tsunami, banjir, dan erupsi gunung berapi adalah ancaman nyata yang bisa terjadi kapan saja. Masalah utama yang sering dihadapi adalah:
- Lambatnya akses informasi panduan keselamatan saat panik.
- Data bencana yang tersebar dan sulit divisualisasikan secara cepat oleh masyarakat awam.
- Kurangnya asisten interaktif yang bisa memberikan instruksi pertolongan pertama secara instan.

## 💡 Solusi
**SiagaBencana AI** dirancang untuk menjadi "pendamping digital" di saat darurat. Dengan memanfaatkan **Google Gemini AI**, aplikasi ini mampu memberikan instruksi keselamatan yang dipersonalisasi berdasarkan jenis bencana. Integrasi peta real-time dan data BMKG memastikan pengguna mendapatkan informasi valid untuk mengambil keputusan cepat yang bisa menyelamatkan nyawa.

## ✨ Fitur Utama
- 🤖 **AI Emergency Assistant**: Chatbot yang ditenagai Gemini 3.1 Pro untuk memberikan panduan evakuasi dan P3K secara instan.
- 🗺️ **Interactive Disaster Map**: Peta sebaran bencana real-time di seluruh Indonesia dengan mode *Full Screen*.
- ⚠️ **BMKG Live Feed**: Notifikasi otomatis untuk gempa bumi terbaru di atas 5.0 SR lengkap dengan koordinat dan potensi tsunami.
- 📍 **Geolocation Awareness**: Mendeteksi bencana yang terjadi di sekitar lokasi pengguna secara otomatis.
- 🆘 **Quick Action Guide**: Tombol akses cepat untuk protokol darurat (Gempa, Banjir, Kebakaran, Medis).
- 📱 **Mobile Optimized**: Antarmuka yang ringan dan responsif, dirancang untuk kemudahan penggunaan dalam situasi stres.

## 🛠️ Tech Stack
- **Core**: [React 18](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI**: [Google Gemini API](https://ai.google.dev/) (Model: Gemini 3.1 Pro)
- **Maps**: [Leaflet.js](https://leafletjs.org/) & [OpenStreetMap](https://www.openstreetmap.org/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 Panduan Menjalankan Aplikasi

### 1. Persiapan
Pastikan Anda sudah menginstal **Node.js** (versi 18 atau terbaru) di komputer Anda.

### 2. Instalasi Dependensi
Buka terminal di folder proyek dan jalankan:
```bash
npm install
```

### 3. Konfigurasi Environment
Buat file `.env` (atau gunakan environment variable platform) dan tambahkan API Key:
```env
GEMINI_API_KEY=your_api_key_here
```

### 4. Menjalankan Aplikasi
Jalankan server pengembangan dengan perintah:
```bash
npm run dev
```
Setelah berhasil, buka browser dan akses:
**[http://localhost:3000](http://localhost:3000)**

## 📱 Panduan Instalasi di HP (PWA)
Aplikasi ini mendukung **Progressive Web App (PWA)**, sehingga Anda bisa menginstalnya di HP tanpa melalui Play Store/App Store.

### Untuk Android (Google Chrome)
1. Buka URL aplikasi di browser Chrome.
2. Klik ikon **tiga titik** di pojok kanan atas.
3. Pilih menu **"Tambahkan ke Layar Utama"** atau **"Instal Aplikasi"**.
4. Aplikasi akan muncul di menu aplikasi HP Anda.

### Untuk iOS (Safari)
1. Buka URL aplikasi di browser Safari.
2. Klik ikon **Share** (kotak dengan panah ke atas) di bagian bawah.
3. Gulir ke bawah dan pilih **"Add to Home Screen"**.
4. Klik **Add** di pojok kanan atas.

---
*SiagaBencana AI - Cerdas Menghadapi Bencana, Sigap Menyelamatkan Nyawa.*
