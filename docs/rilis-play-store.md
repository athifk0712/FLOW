# Rilis ke Play Store — checklist & jawaban formulir

Tautan publik (setelah web di-deploy):

- Kebijakan privasi: https://flowku.expo.app/privasi.html
- Hapus akun: https://flowku.expo.app/hapus-akun.html
- Beranda aplikasi: https://flowku.expo.app/

Sumber halamannya: `mobile/public/privasi.html` dan `mobile/public/hapus-akun.html` (ikut `npx expo export --platform web`).
Kalau isi data/fitur berubah, perbarui kedua halaman **dan** jawaban Data Safety di bawah supaya tetap sama.

## 1. Supabase — Site URL

Authentication → URL Configuration:

- **Site URL**: `https://flowku.expo.app` (sekarang masih `http://localhost:3000`, jadi link di email login mengarah ke localhost).
- Redirect URLs tetap: `https://flowku.expo.app/**`, `flow://**`.

## 2. Google OAuth — publish consent screen

Google Cloud Console → Google Auth Platform:

1. **Branding**: nama aplikasi `Flowku`, email dukungan, logo (opsional; logo memicu verifikasi brand, boleh dikosongkan dulu),
   Application home page `https://flowku.expo.app/`, Privacy policy `https://flowku.expo.app/privasi.html`,
   Authorized domain: domain dari halaman tersebut, email developer.
2. **Data access**: hanya scope dasar (`openid`, `email`, `profile`). Tanpa scope sensitif, publish tidak butuh review Google.
3. **Audience** → **Publish app** (Testing → In production).

Catatan: `expo.app` adalah domain bersama. Kalau Google menolak authorized domain atau meminta verifikasi kepemilikan,
solusinya domain sendiri (mis. `flowku.id`) yang diarahkan ke hosting web.

## 3. Play Console — Data safety

**Ringkasan**

| Pertanyaan | Jawaban |
|---|---|
| Mengumpulkan atau membagikan data pengguna yang wajib dilaporkan? | Ya |
| Semua data dienkripsi saat transit? | Ya (HTTPS/TLS) |
| Pengguna bisa meminta data dihapus? | Ya |
| Metode pembuatan akun | OAuth (Google), dan email (kode OTP); juga mode tamu tanpa akun |
| URL hapus akun | https://flowku.expo.app/hapus-akun.html |

**Jenis data**. Flowku masih memakai Gemini API **gratis**, dan di tier gratis Google boleh memakai input untuk
produknya sendiri. Jadi data yang dikirim ke AI ditandai **dibagikan** (penerima: Google). Data lain hanya
*dikumpulkan*. Semua: *tidak diproses sementara*, tujuan = Fungsi aplikasi kecuali disebut lain.

| Kategori Play | Jenis | Wajib/opsional | Dibagikan? | Tujuan |
|---|---|---|---|---|
| Info pribadi | Alamat email | Opsional (hanya jika akun disimpan) | Tidak | Fungsi aplikasi, Pengelolaan akun |
| Info pribadi | Nama | Opsional (nama tampilan) | **Ya** (dikirim ke Gemini untuk menyapa) | Fungsi aplikasi, Personalisasi |
| Info pribadi | ID pengguna | Wajib | Tidak | Fungsi aplikasi, Pengelolaan akun |
| Info keuangan | Info keuangan lainnya (transaksi, saldo, budget, utang, aset) | Wajib | **Ya** (ringkasan ke Gemini saat chat AI) | Fungsi aplikasi |
| Foto dan video | Foto (struk, foto profil) | Opsional | **Ya** (foto struk ke Gemini saat scan) | Fungsi aplikasi |
| Pesan | Pesan dalam aplikasi lainnya (chat Flowku AI) | Opsional | **Ya** (ke Gemini) | Fungsi aplikasi |
| Aktivitas aplikasi | Konten buatan pengguna lainnya (catatan, refleksi) | Opsional | **Ya** (catatan transaksi ikut di ringkasan AI) | Fungsi aplikasi |

Tidak dikumpulkan: lokasi, kontak, SMS/log panggilan, info kesehatan, file/dokumen lain, kalender, ID perangkat/iklan,
log error & diagnostik (tidak ada SDK analitik/crash), riwayat penelusuran.

**Kalau nanti billing Gemini diaktifkan**, data yang dikirim ke penyedia layanan yang memprosesnya *atas nama kita*
tidak lagi dihitung "dibagikan". Saat itu ubah kolom "Dibagikan?" menjadi Tidak semua, dan hapus kotak "Penting —
layanan Gemini API gratis" di `mobile/public/privasi.html` (beserta kalimat pengecualian di Ringkasnya).

## 4. Lainnya yang diminta Play

- **Kategori aplikasi**: Keuangan. Deklarasi aplikasi keuangan: pilih bahwa Flowku *tidak* menawarkan pinjaman, investasi,
  atau layanan finansial berlisensi (hanya pencatat).
- **Akses aplikasi** untuk reviewer: tidak perlu login (mode tamu).
- **Iklan**: Tidak ada iklan.
- **Rating konten**: isi kuesioner IARC (tanpa kekerasan, tanpa transaksi uang sungguhan).
- **Target audiens**: 18+ (atau 13+). Jangan pilih anak-anak, nanti kena kebijakan Families.
- **Closed testing**: akun developer perorangan baru wajib closed test (cek jumlah penguji & durasi terbaru di Console)
  sebelum bisa mengajukan produksi.
- **Build**: Play butuh **AAB** (bukan APK) → tambah profil `production` di `eas.json` dengan `"buildType": "app-bundle"`.
