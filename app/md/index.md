**MDXtra** adalah static site generator berbasis Markdown yang ringan dan cepat untuk membangun dokumentasi maupun website statis. MDXtra mendukung syntax highlighting, komponen HTML, penyisipan source code, live reload, minifikasi otomatis, serta deployment ke GitHub Pages.

## Fitur

- Konversi Markdown ke HTML
- Live Reload
- Minify HTML, CSS, dan JavaScript
- Syntax Highlight dengan Highlight.js
- Template HTML
- Placeholder HTML dan Source Code
- CSS dan JavaScript global
- Copy Button untuk blok kode
- Auto Translate
- CDN CSS dan JavaScript
- Dukungan GitHub Pages
- Multi halaman

## Instalasi

```bash
npm install -g mdxtra
```

## Membuat Project

```bash
mdxtra
```

Struktur project:

```text
project/
├── app/
│   ├── md/
│   ├── css/
│   ├── js/
│   ├── html/
│   └── code/
├── public/
│   └── index.html
├── config.json
├── titles.json
├── cdn.css.json
├── cdn.js.json
├── cdn.highlight.json
└── .prettierignore
```

## Development

Jalankan server pengembangan:

```bash
mdxtra dev
```

Server akan berjalan di:

```text
http://127.0.0.1:3173
```

Fitur yang tersedia:

- Live Reload
- Build otomatis saat file berubah
- Browser terbuka secara otomatis

## Build

Buat versi produksi dengan menjalankan:

```bash
mdxtra build
```

Hasil build akan disimpan di folder `dist/`.

## Struktur Folder

### `app/md`

Berisi file Markdown yang akan dikonversi menjadi halaman HTML.

### `app/css`

Berisi stylesheet global yang diterapkan ke seluruh halaman.

### `app/js`

Berisi JavaScript global.

### `app/html`

Berisi komponen HTML yang dapat disisipkan menggunakan placeholder.

### `app/code`

Berisi source code yang dapat ditampilkan di dalam dokumen Markdown.

## Placeholder

### HTML

```text
{html.header}
{html.docs.sidebar}
{html.header.global}
```

### Source Code

```text
{code.example.js}
```

## Template

Template utama berada di:

```text
public/index.html
```

Placeholder yang tersedia:

- `{title}` — Judul halaman.
- `{content}` — Hasil konversi Markdown.
- `{style}` — CSS yang dihasilkan.
- `{script}` — JavaScript yang dihasilkan.
- `{cdn.css}` — Seluruh CDN CSS.
- `{cdn.js}` — Seluruh CDN JavaScript.
- `{cdn.highlight}` — Tema Highlight.js.
- `{base_href}` — Base URL untuk GitHub Pages.

## Konfigurasi

File `config.json`:

```json
{
    "outDir": "dist",
    "singleQuote": true,
    "copyButton": false,
    "autoTranslate": false,
    "githubPages": null
}
```

Penjelasan opsi:

- `outDir` — Menentukan folder hasil build.
- `singleQuote` — Menggunakan tanda petik tunggal pada output HTML.
- `copyButton` — Menampilkan tombol **Copy** pada blok kode.
- `autoTranslate` — Mengaktifkan Google Translate secara otomatis.
- `githubPages` — Menentukan base path saat deployment ke GitHub Pages.

## Judul Halaman

File `titles.json`:

```json
{
    "index": "Beranda",
    "about": "Tentang Kami"
}
```

Setiap key merepresentasikan nama file Markdown tanpa ekstensi, sedangkan nilainya digunakan sebagai judul halaman.

## CDN

### CSS

`cdn.css.json`

```json
["https://cdn.jsdelivr.net/npm/bootstrap/dist/css/bootstrap.min.css"]
```

### JavaScript

`cdn.js.json`

```json
["https://cdn.jsdelivr.net/npm/bootstrap/dist/js/bootstrap.bundle.min.js"]
```

### Highlight.js

`cdn.highlight.json`

```json
["https://cdn.jsdelivr.net/npm/highlight.js/styles/github.min.css"]
```

## Contoh

```markdown
# Selamat Datang

{html.header}

## Contoh

{code.example.js}

[Lanjut](install.md)
```

## Perintah

```bash
# Membuat project baru
mdxtra

# Menjalankan development server
mdxtra dev

# Build untuk produksi
mdxtra build
```
