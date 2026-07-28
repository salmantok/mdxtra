**MDXtra** adalah static site generator berbasis Markdown yang ringan dan cepat untuk membangun dokumentasi atau website statis. Mendukung syntax highlighting, komponen HTML, penyisipan source code, live reload, minifikasi otomatis, serta GitHub Pages.

## Fitur

- Markdown → HTML
- Live Reload
- Minify HTML, CSS, dan JavaScript
- Syntax Highlight (Highlight.js)
- Template HTML
- Placeholder HTML & Source Code
- CSS & JavaScript global
- Copy Button untuk blok kode
- Auto Translate
- CDN CSS & JavaScript
- GitHub Pages
- Multi halaman

---

## Instalasi

```bash
npm install -g mdxtra
```

---

## Memulai Project

```bash
mdxtra
```

Struktur:

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

---

## Development

Jalankan server pengembangan:

```bash
mdxtra dev
```

Server berjalan di:

```text
http://127.0.0.1:3173
```

Fitur:

- Live Reload
- Build otomatis
- Browser terbuka otomatis

---

## Build

```bash
mdxtra build
```

Hasil build akan disimpan di folder `dist/`.

---

## Struktur Folder

| Folder     | Fungsi                            |
| ---------- | --------------------------------- |
| `app/md`   | Halaman Markdown                  |
| `app/css`  | CSS global                        |
| `app/js`   | JavaScript global                 |
| `app/html` | Komponen HTML                     |
| `app/code` | Source code yang dapat disisipkan |

---

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

---

## Template

Template berada di:

```text
public/index.html
```

Placeholder yang tersedia:

| Placeholder       | Keterangan            |
| ----------------- | --------------------- |
| `{title}`         | Judul halaman         |
| `{content}`       | Isi Markdown          |
| `{style}`         | CSS                   |
| `{script}`        | JavaScript            |
| `{cdn.css}`       | CDN CSS               |
| `{cdn.js}`        | CDN JavaScript        |
| `{cdn.highlight}` | Tema Highlight.js     |
| `{base_href}`     | Base URL GitHub Pages |

---

## Konfigurasi

`config.json`

```json
{
    "outDir": "dist",
    "singleQuote": true,
    "copyButton": false,
    "autoTranslate": false,
    "githubPages": null
}
```

| Opsi            | Fungsi                          |
| --------------- | ------------------------------- |
| `outDir`        | Folder hasil build              |
| `singleQuote`   | Gunakan petik tunggal pada HTML |
| `copyButton`    | Tombol Copy pada blok kode      |
| `autoTranslate` | Google Translate otomatis       |
| `githubPages`   | Base path GitHub Pages          |

---

## Judul Halaman

`titles.json`

```json
{
    "index": "Beranda",
    "about": "Tentang Kami"
}
```

---

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

---

## Contoh

```markdown
# Selamat Datang

{html.header}

## Contoh

{code.example.js}

[Lanjut](install.md)
```

---

## Perintah

```bash
# Inisialisasi project
mdxtra

# Development
mdxtra dev

# Production build
mdxtra build
```
