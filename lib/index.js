#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import chokidar from 'chokidar';
import hljs from 'highlight.js';
import pkg from 'enquirer';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { minify } from 'html-minifier-terser';

const { prompt } = pkg;

// Variabel global untuk direktori
const inputDir = path.join(process.cwd(), 'app');
let outputDir = '';
const configJson = 'config.json';
const publicDir = path.join(process.cwd(), 'public');
const mdDir = path.join(inputDir);
const templateFile = path.join(publicDir, 'index.html');
const mdFile = path.join(mdDir, 'index.md');

// Konten default untuk setiap file
const defaultTemplate =
  '<!DOCTYPE html>\n' +
  '<html lang="id">\n' +
  '<head>\n' +
  '  <meta charset="UTF-8">\n' +
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
  '  <title>{{TITLE}}</title>\n' +
  '  {{HIGHLIGHT_CSS}}\n' +
  '</head>\n' +
  '<body>\n' +
  '  <main>\n' +
  '    {{CONTENT}}\n' +
  '  </main>\n' +
  '  {{HIGHLIGHT_JS}}\n' +
  '</body>\n' +
  '</html>';

const defaultMd = '# mdxtra!';

// Fungsi untuk memastikan direktori tersedia
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Fungsi untuk memastikan file tersedia dengan konten default
function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultContent, 'utf8');
    console.log(`Created default ${path.basename(filePath)}`);
  }
}

// Fungsi utama untuk memastikan semua file dan direktori tersedia
function ensurePublicFiles() {
  try {
    ensureDir(publicDir);
    ensureFile(templateFile, defaultTemplate);

    ensureDir(mdDir);
    ensureFile(mdFile, defaultMd);
  } catch (err) {
    console.error('Error ensuring public files:', err);
  }
}

// Konfigurasi marked dengan marked-highlight
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      } else {
        return hljs.highlightAuto(code).value;
      }
    },
  })
);

// Fungsi untuk mengganti path dari .md ke .html
function replaceMarkdownLinks(data) {
  return data.replace(
    /\((.*?\.md)(#.*?)?\)/g,
    (match, p1, p2) => `(${p1.replace('.md', '.html')}${p2 || ''})`
  );
}

// Fungsi untuk memastikan direktori ada
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

// Fungsi untuk menghapus semua file HTML di direktori app
async function deleteHTMLFilesInApp(directory) {
  try {
    const files = await fs.promises.readdir(directory, {
      withFileTypes: true,
    });
    for (const file of files) {
      const filePath = path.join(directory, file.name);
      if (file.isDirectory()) {
        // Rekursif untuk subdirektori
        await deleteHTMLFilesInApp(filePath);
      } else if (path.extname(file.name) === '.html') {
        // Hapus file HTML
        await fs.promises.unlink(filePath);
        console.log(chalk.yellow(`Deleted HTML file: ${filePath}`));
      }
    }
  } catch (err) {
    console.error(chalk.red(`Error deleting HTML files in ${directory}:`), err);
  }
}

// Fungsi untuk menyalin file
async function copyFile(app, dest) {
  const ext = path.extname(app);
  if (ext === '.html' || ext === '.css' || ext === '.js') return; // Abaikan file HTML, CSS, dan JS
  ensureDirectoryExistence(dest);
  await fs.promises.copyFile(app, dest);
}

// Fungsi untuk membaca dan menggabungkan CSS atau JS ke dalam HTML
function inlineAssets(html, outputFilePath) {
  return html
    .replace(/<link rel="stylesheet" href="([^"]+)">/g, (match, cssPath) => {
      const fullCssPath = path.resolve(inputDir, cssPath);
      if (fs.existsSync(fullCssPath)) {
        const cssContent = fs.readFileSync(fullCssPath, 'utf8').trim();

        if (cssContent.length === 0) {
          console.warn(chalk.yellow(`[CSS] Empty file: ${fullCssPath}`));
          return ''; // Hapus tag jika file kosong
        }

        return `<style>\n${cssContent}\n</style>`;
      } else {
        console.warn(chalk.red(`[CSS] File not found: ${fullCssPath}`));
        return ''; // Hapus tag jika file tidak ditemukan
      }
    })
    .replace(/<script src="([^"]+)"><\/script>/g, (match, jsPath) => {
      const fullJsPath = path.resolve(inputDir, jsPath);
      if (fs.existsSync(fullJsPath)) {
        const jsContent = fs.readFileSync(fullJsPath, 'utf8').trim();

        if (jsContent.length === 0) {
          console.warn(chalk.yellow(`[JS] Empty file: ${fullJsPath}`));
          return ''; // Hapus tag jika file kosong
        }

        return `<script>\n${jsContent}\n</script>`;
      } else {
        console.warn(chalk.red(`[JS] File not found: ${fullJsPath}`));
        return ''; // Hapus tag jika file tidak ditemukan
      }
    });
}

// Fungsi untuk mengonversi file Markdown ke HTML
async function convertMarkdownToHTML(inputFilePath, outputFilePath, titleMap) {
  try {
    if (!fs.existsSync(inputFilePath)) {
      console.error(chalk.blue(`The file ${inputFilePath} does not exist.`));
      return;
    }

    const data = await fs.promises.readFile(inputFilePath, 'utf8');
    const updatedData = replaceMarkdownLinks(data);
    const htmlContent = marked(updatedData);
    const containsCodeBlock = /<pre><code class="hljs/.test(htmlContent);
    const title =
      titleMap[inputFilePath] || path.basename(outputFilePath, '.html');

    const highlightCSS = containsCodeBlock
      ? `
    <style>
      pre {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 1em;
      }
      pre code {
        display: block;
        width: 100%;
      }
      code {
        display: inline;
      }
      .copy-button {
        position: absolute;
        right: 5px;
        top: 5px;
        padding: 3px 6px;
        font-size: 12px;
        color: #fff;
        background-color: #1a1a1a;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
      }
      pre:hover .copy-button,
      pre:focus-within .copy-button {
        opacity: 1;
      }
    </style>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/tomorrow-night-bright.min.css"
      integrity="sha512-kihsljiamrbQ3b3s3TXoAWNSbzbp+gYIeeva81nQwCj/zICdiT/QnKbWTV7DElmAm3mc4vuTR3fo0ToTe2cpNw=="
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
    >
  `
      : '';

    const highlightJS = containsCodeBlock
      ? `
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('pre').forEach((preElement) => {
          const code = preElement.querySelector('code');
          if (!code) return; // Pastikan ada elemen <code>

          const button = document.createElement('button');
          button.innerText = 'Copy';
          button.className = 'copy-button';
          button.onclick = () => {
            navigator.clipboard.writeText(code.innerText).then(() => {
              button.innerText = 'Copied!';
              setTimeout(() => button.innerText = 'Copy', 2000);
            });
          };
          preElement.appendChild(button);
        });
      });
    </script>
  `
      : '';

    // Baca template HTML
    const templatePath = path.join(process.cwd(), 'public', 'index.html');
    let template = await fs.promises.readFile(templatePath, 'utf8');

    // Ganti placeholder dengan konten aktual
    let fullHtmlContent = template
      .replace('{{TITLE}}', title)
      .replace('{{HIGHLIGHT_CSS}}', highlightCSS)
      .replace('{{CONTENT}}', htmlContent)
      .replace('{{HIGHLIGHT_JS}}', highlightJS);

    fullHtmlContent = inlineAssets(fullHtmlContent, outputFilePath);

    fullHtmlContent = fullHtmlContent;

    // Minifikasi HTML
    const minifiedHtml = await minify(fullHtmlContent, {
      collapseWhitespace: true,
      removeComments: true,
      removeEmptyAttributes: true,
      minifyCSS: true,
      minifyJS: true,
    });

    ensureDirectoryExistence(outputFilePath);
    await fs.promises.writeFile(outputFilePath, minifiedHtml);
  } catch (err) {
    console.error(
      chalk.red(`Error processing the file ${inputFilePath}:`),
      err
    );
  }
}

// Fungsi untuk memproses file Markdown
async function processMarkdownFile(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    const references = new Set();

    const titleConfigPath = configJson;
    if (!fs.existsSync(titleConfigPath)) {
      await fs.promises.writeFile(titleConfigPath, '{}');
    }

    // Membaca data config.json yang ada
    const titleMap = JSON.parse(
      await fs.promises.readFile(titleConfigPath, 'utf-8')
    );

    // Mengambil nama file tanpa ekstensi
    const fileName = path.basename(filePath, '.md');

    // Menentukan title: jika ada entry kustom di config.json, gunakan itu, jika tidak, gunakan nama file
    const title = titleMap[filePath] || fileName;

    // Menambahkan judul ke titleMap jika belum ada
    if (!titleMap[filePath]) {
      titleMap[filePath] = title;
    }

    // Menyimpan kembali titleMap ke config.json
    await fs.promises.writeFile(
      titleConfigPath,
      JSON.stringify(titleMap, null, 2)
    );

    const lines = data.split('\n');
    for (const line of lines) {
      const match = line.match(/\[(.*?)\]\((.*?\.md)(#.*?)?\)/);
      if (match) {
        references.add(path.join(path.dirname(filePath), match[2]));
      }
    }

    const outputFilePath = path.join(
      outputDir,
      path.relative(inputDir, filePath.replace('.md', '.html'))
    );
    await convertMarkdownToHTML(filePath, outputFilePath, titleMap);

    for (const ref of references) {
      const refOutputFilePath = path.join(
        outputDir,
        path.relative(inputDir, ref.replace('.md', '.html'))
      );
      await convertMarkdownToHTML(ref, refOutputFilePath, titleMap);
    }
  } catch (err) {
    console.error(
      chalk.red(`Error processing references in ${filePath}:`),
      err
    );
  }
}

// Fungsi untuk memproses semua file dalam direktori, termasuk subdirektorinya
const processAllFiles = async (directory) => {
  try {
    // Membaca semua file dan folder dalam direktori
    const files = await fs.promises.readdir(directory, {
      withFileTypes: true,
    });

    for (const file of files) {
      const filePath = path.join(directory, file.name); // Path lengkap file atau folder

      if (file.isDirectory()) {
        await processAllFiles(filePath); // Jika folder, proses secara rekursif
      } else if (path.extname(file.name) === '.md') {
        await processMarkdownFile(filePath); // Jika file Markdown, proses file
      } else {
        // Jika bukan Markdown, salin ke output directory
        const outputFilePath = path.join(
          outputDir,
          path.relative(inputDir, filePath)
        );
        await copyFile(filePath, outputFilePath);
      }
    }
  } catch (err) {
    console.error(chalk.red(`Error processing directory ${directory}:`), err); // Tangani error
  }
};

// Fungsi untuk mendapatkan daftar semua file dalam direktori, termasuk subdirektori
const getAllFiles = async (directory, base = '') => {
  let files = []; // Menyimpan daftar file
  const entries = await fs.promises.readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name); // Path lengkap
    const relativePath = path.join(base, entry.name); // Path relatif

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, relativePath); // Rekursi untuk folder
      files = files.concat(subFiles);
    } else {
      files.push(relativePath); // Tambahkan file ke daftar
    }
  }
  return files; // Kembalikan daftar file
};

// Fungsi untuk menyinkronkan file antara direktori sumber dan tujuan
const syncFiles = async (appDir, destDir) => {
  try {
    const appFiles = await getAllFiles(appDir); // Ambil semua file dari sumber
    const destFiles = await getAllFiles(destDir); // Ambil semua file dari tujuan

    // Buat set yang berisi file yang seharusnya ada di tujuan
    const appFilePaths = new Set(
      appFiles.map((file) => path.join(destDir, file.replace('.md', '.html')))
    );

    for (const destFile of destFiles) {
      const fullDestPath = path.join(destDir, destFile);

      // Hapus file di tujuan jika tidak ada dalam sumber
      if (!appFilePaths.has(fullDestPath)) {
        await fs.promises.unlink(fullDestPath);
        console.log(chalk.yellow(`File ${fullDestPath} has been removed.`));
      }
    }

    await processAllFiles(appDir); // Proses ulang file dari sumber ke tujuan
  } catch (err) {
    console.error(chalk.red(`Error syncing files: ${err.message}`)); // Tangani error
  }
};

// Fungsi untuk meminta direktori input output
async function askForOutputDirectory() {
  const { outputDirectory } = await prompt({
    type: 'input',
    name: 'outputDirectory',
    message: 'Enter the output directory (e.g., .):',
    default: '.',
  });

  outputDir = path.join(process.cwd(), outputDirectory);

  // Simpan direktori output ke file konfigurasi
  const config = { outputDirectory };
  fs.writeFileSync(configJson, JSON.stringify(config, null, 2));
}

// Fungsi untuk memperbarui titleConfig setelah file dihapus
async function updateConfigAfterDeletion(filePath) {
  try {
    if (!fs.existsSync(configJson)) return;

    const titleMap = JSON.parse(
      await fs.promises.readFile(configJson, 'utf-8')
    );

    if (titleMap[filePath]) {
      delete titleMap[filePath];
      await fs.promises.writeFile(
        configJson,
        JSON.stringify(titleMap, null, 2)
      );
      console.log(`Updated ${configJson}: Removed ${filePath}`);
    }
  } catch (err) {
    console.error('Error updating config.json:', err);
  }
}

// Fungsi utilitas untuk menangani create, update, delete
function handleFileEvent(eventType, filePath) {
  const ext = path.extname(filePath);
  const relativePath = path.relative(inputDir, filePath);
  const outputFilePath = path.join(
    outputDir,
    relativePath.replace('.md', '.html')
  );

  const isMarkdown = ext === '.md';
  const isHTML = ext === '.html';
  const isCSS = ext === '.css';
  const isJS = ext === '.js';

  const outputExists = fs.existsSync(outputFilePath);

  switch (eventType) {
    case 'create':
    case 'update':
      if (isMarkdown) {
        processMarkdownFile(filePath);
        console.log(
          chalk.green(`[Markdown] Processed: ${filePath} -> ${outputFilePath}`)
        );
      } else if (isCSS || isJS) {
        console.log(chalk.blue(`[${ext.toUpperCase()}] Updated: ${filePath}`));

        fs.readdirSync(outputDir).forEach((file) => {
          if (file.endsWith('.html')) {
            const htmlPath = path.join(outputDir, file);
            let html = fs.readFileSync(htmlPath, 'utf8');

            html = inlineAssets(html, htmlPath);
            fs.writeFileSync(htmlPath, html);
          }
        });
      } else if (!isHTML) {
        copyFile(filePath, outputFilePath);
        console.log(
          chalk.magenta(`[File] Copied: ${filePath} -> ${outputFilePath}`)
        );
      }
      break;

    case 'delete':
      if (outputExists) {
        fs.unlinkSync(outputFilePath);
        console.log(
          chalk.red(`[File] Deleted: ${filePath} -> ${outputFilePath}`)
        );
      }
      if (isMarkdown) {
        updateConfigAfterDeletion(filePath);
      }
      break;
  }
}

// Fungsi utama
async function mdxtra() {
  // Periksa apakah direktori output sudah ada di file konfigurasi
  const configPath = configJson;
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.outputDirectory) {
      // Jika sudah ada, gunakan direktori yang sudah disimpan
      outputDir = path.join(process.cwd(), config.outputDirectory);
    } else {
      await askForOutputDirectory();
    }
  } else {
    await askForOutputDirectory();
  }
}

// Memulai Watcher
mdxtra()
  .then(() => ensurePublicFiles())
  .then(() => deleteHTMLFilesInApp(inputDir))
  .then(() => processAllFiles(inputDir))
  .then(() => {
    const watcher = chokidar.watch(inputDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
    });

    watcher
      .on('add', (filePath) => handleFileEvent('create', filePath))
      .on('change', (filePath) => handleFileEvent('update', filePath))
      .on('unlink', (filePath) => handleFileEvent('delete', filePath));

    console.log(chalk.blue(`🔍 Watching for file changes in ${inputDir}`));
  })
  .catch((err) => {
    console.error(chalk.red('An error occurred:'), err);
  });
