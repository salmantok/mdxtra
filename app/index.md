# mdxtra

**mdxtra** adalah alat dokumentasi berbasis Markdown yang mengonversi file `.md` menjadi HTML dengan fitur tambahan seperti **highlighting kode, tombol salin kode, dan sinkronisasi file**.

## Fitur

- **Konversi Markdown ke HTML** dengan _highlighting_ kode otomatis.
- **Dukungan tombol salin kode** untuk setiap blok kode.
- **Minifikasi HTML** menggunakan `html-minifier-terser`.
- **Sinkronisasi file** secara otomatis dengan _watcher_ menggunakan `chokidar`.
- **Dukungan konfigurasi** melalui `config.json`.
- **Tema _highlighting_ kode** menggunakan `highlight.js`.
- **Manajemen file otomatis** (pembuatan, penghapusan, dan penyelarasan file).

## Instalasi

```sh
npm install -g mdxtra
```

## Cara Menggunakan

### Menjalankan mdxtra

Untuk memulai, jalankan perintah berikut di dalam direktori proyek:

```sh
mdxtra
```

Pada eksekusi pertama, mdxtra akan meminta Anda untuk memilih direktori output. Tekan enter dan output direktori ke proyek saat ini.

### Struktur Direktori

Secara default, mdxtra bekerja dengan struktur berikut:

```
root/
  app/
    index.md
  public/
    index.html
config.json
```

- **`app/`** adalah tempat menyimpan file Markdown dan aset tambahan.
- **`public/`** berisi **template HTML utama**.
- **`config.json`** memungkinkan Anda mengatur output dan title.
