#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import CleanCSS from 'clean-css';
import { exec } from 'child_process';
import chalk from 'chalk';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { minify as minifyHTML } from 'html-minifier-terser';
import { minify as minifyJS } from 'terser';
import http from 'http';
import serveStatic from 'serve-static';
import chokidar from 'chokidar';

const devMemory = new Map();
let globalHtml = '';

const mode = process.argv[2];
const isInit = !mode;
const isDev = mode === 'dev';
const isBuild = mode === 'build';

const cwd = process.cwd();
const appDir = path.join(cwd, 'app');
const mdDir = path.join(appDir, 'md');
const cssDir = path.join(appDir, 'css');
const jsDir = path.join(appDir, 'js');
const htmlDir = path.join(appDir, 'html');
const codeDir = path.join(appDir, 'code');
const publicDir = path.join(cwd, 'public');
const templatePath = path.join(publicDir, 'index.html');
const configPath = path.join(cwd, 'config.json');
const titlesPath = path.join(cwd, 'titles.json');
const cdnCssPath = path.join(cwd, 'cdn.css.json');
const cdnJsPath = path.join(cwd, 'cdn.js.json');
const cdnHighlightPath = path.join(cwd, 'cdn.highlight.json');
const initFlagPath = path.join(cwd, '.initialized');
const prettierIgnorePath = path.join(cwd, '.prettierignore');

const prettierIgnoreContent = `  
***.html
!app/code*.html
`.trim();

const defaultMd = `  
\`\`\`js  
console.log("Hello World");  
\`\`\`  
`;

const staticHtml = `  
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        {base_href}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {cdn.css}
        {cdn.highlight}
        {style}
    </head>
    <body>
        {content}
        {cdn.js}
        {script}
    </body>
</html>`.trim();

const staticCss = `
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
  right: 8px; 
  top: 8px; 
  padding: 4px 8px; 
  font-size: 12px; 
  color: #333;
  background-color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 4px; 
  cursor: pointer; 
  opacity: 0; 
  backdrop-filter: blur(2px);
  transition: opacity 0.2s ease-in-out, background 0.2s;
}

.copy-button:hover {
  background-color: rgba(255,255,255,1);
}

pre:hover .copy-button, 
pre:focus-within .copy-button { 
  opacity: 1; 
}
`.trim();

const staticJs = `
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('pre').forEach(preElement => {
    const code = preElement.querySelector('code');
    if (!code) return;

    
    if (
      !code.classList.contains('hljs') ||
      ![...code.classList].some(cls => cls.startsWith('language-'))
    ) {
      return;
    }

    const button = document.createElement('button');
    button.innerHTML = 'Copy';
    button.className = 'copy-button';

    button.onclick = () => {
      navigator.clipboard.writeText(code.innerText).then(() => {
        button.innerHTML = 'Copied!';
        setTimeout(() => (button.innerHTML = 'Copy'), 1000);
      });
    };

    preElement.appendChild(button);
  });
});
`.trim();

const translateJs = `
document.addEventListener('DOMContentLoaded', () => {

  const defaultLanguage = 'id';

  const browserLanguage =
    navigator.languages?.[0] ||
    navigator.language ||
    defaultLanguage;

  const targetLanguage =
    browserLanguage.split('-')[0];

  
  if (targetLanguage === defaultLanguage) {
    return;
  }

  
  if (window.__mdxtraTranslateLoaded) {
    return;
  }

  window.__mdxtraTranslateLoaded = true;

  
  const container =
    document.createElement('div');

  container.id =
    'google_translate_element';

  container.style.display =
    'none';

  document.body.appendChild(container);

  
  window.googleTranslateElementInit =
    function () {

      new google.translate.TranslateElement(
        {
          pageLanguage: defaultLanguage,
          autoDisplay: false
        },
        'google_translate_element'
      );

      const interval = setInterval(() => {

        const select =
          document.querySelector(
            '.goog-te-combo'
          );

        if (!select) return;

        select.value = targetLanguage;

        select.dispatchEvent(
          new Event('change')
        );

        clearInterval(interval);

      }, 500);
    };

  const script =
    document.createElement('script');

  script.src =
    'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';

  script.async = true;

  document.head.appendChild(script);

});
`.trim();

const devReloadScript = `
if (typeof EventSource !== 'undefined') {
  
  const es = new EventSource(window.location.origin + '/__reload');
  es.onmessage = () => location.reload();  
}`.trim();

marked.use(
    markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
    })
);

async function isFirstRun() {
    try {
        await fs.access(initFlagPath);
        return false;
    } catch {
        await fs.writeFile(initFlagPath, new Date().toISOString(), 'utf-8');
        return true;
    }
}

async function isProjectInitialized() {
    try {
        await fs.access(initFlagPath);
        return true;
    } catch {
        return false;
    }
}

function replaceMarkdownLinks(content) {
    return content.replace(/\]\(([^)]+?)\.md\)/g, ']($1.html)');
}

function replaceHtmlLinks(content, basePrefix = '') {
    if (!basePrefix) return content;

    return content.replace(
        /\b(href|src|poster)=["'](?!https?:\/\/|\/\/|#|mailto:|tel:|data:)([^"']+)["']/g,
        (match, attr, url) => {
            if (url.startsWith(`${basePrefix}/`)) {
                return `${attr}="${url}"`;
            }

            if (url.startsWith('/')) {
                return `${attr}="${basePrefix}${url}"`;
            }

            return `${attr}="${basePrefix}/${url}"`;
        }
    );
}

async function readAndConcatFiles(dir, extFilter = []) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const results = await Promise.all(
            entries.map(async (entry) => {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    return readAndConcatFiles(fullPath, extFilter);
                } else if (
                    entry.isFile() &&
                    (extFilter.length === 0 ||
                        extFilter.includes(path.extname(entry.name)))
                ) {
                    return fs.readFile(fullPath, 'utf-8');
                } else {
                    return '';
                }
            })
        );
        return results.join('\n').trim();
    } catch (err) {
        if (err.code === 'ENOENT') return '';
        throw err;
    }
}

async function loadGlobalHtml() {
    const indexPath = path.join(mdDir, 'index.md');

    try {
        const content = await fs.readFile(indexPath, 'utf-8');

        const regex = /\{html\.([a-zA-Z0-9_.-]+)\.global\}/g;

        const tokens = [...content.matchAll(regex)];

        let result = '';

        for (const [, name] of tokens) {
            const relativePath = name.replace(/\./g, '/');

            const htmlPath = path.join(htmlDir, `${relativePath}.html`);
            const htmlFolder = path.join(htmlDir, relativePath);

            let htmlContent = '';

            const stat = await fs.stat(htmlFolder).catch(() => null);

            if (stat && stat.isDirectory()) {
                htmlContent = await readAndConcatFiles(htmlFolder, ['.html']);
            } else {
                htmlContent = await fs.readFile(htmlPath, 'utf-8');
            }

            result += htmlContent + '\n';
        }

        globalHtml = result;
    } catch {
        globalHtml = '';
    }
}

async function processHtmlPlaceholders(content) {
    content = content.replace(/\{html\.[^}]+\.global\}/g, '');
    const regex = /\{html\.([a-zA-Z0-9_.-]+)\}/g;
    let html = content;

    const tokens = [...html.matchAll(regex)];

    for (const [token, pathPart] of tokens) {
        const relativePath = pathPart.replace(/\./g, '/');
        const htmlPath = path.join(htmlDir, `${relativePath}.html`);
        const htmlFolder = path.join(htmlDir, relativePath);

        try {
            let htmlContent = '';
            const stat = await fs.stat(htmlFolder).catch(() => null);

            if (stat && stat.isDirectory()) {
                htmlContent = await readAndConcatFiles(htmlFolder, ['.html']);
            } else {
                htmlContent = await fs.readFile(htmlPath, 'utf-8');
            }

            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            html = html.replace(
                new RegExp(`<p>\\s*${escaped}\\s*</p>`, 'g'),
                htmlContent
            );

            html = html.replace(new RegExp(escaped, 'g'), htmlContent);
        } catch {
            console.warn(`⚠️ File/folder HTML tidak ditemukan: ${htmlPath}`);
        }
    }

    html = await processCodePlaceholdersHtml(html);

    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
}

async function processCodePlaceholders(content) {
    const regex = /\{code\.([a-zA-Z0-9_.-]+)\}/g;
    let result = content;

    const tokens = [...content.matchAll(regex)];

    for (const [token, rawPath] of tokens) {
        try {
            const extMatch = rawPath.match(/\.([a-zA-Z0-9]+)$/);
            const ext = extMatch ? extMatch[1] : 'txt';

            const withoutExt = rawPath.replace(/\.[^.]+$/, '');

            const filePath = withoutExt.replace(/\./g, '/');

            const fullPath = path.join(appDir, 'code', `${filePath}.${ext}`);

            const code = await fs.readFile(fullPath, 'utf-8');

            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const codeHtml = `\n\`\`\`${ext}\n${code}\n\`\`\`\n`;

            result = result.replace(new RegExp(escaped, 'g'), codeHtml);
        } catch {
            console.warn(`⚠️ File code tidak ditemukan: ${rawPath}`);
        }
    }

    return result;
}
async function processCodePlaceholdersHtml(content) {
    const regex = /\{code\.([a-zA-Z0-9_.-]+)\}/g;
    let html = content;

    const tokens = [...html.matchAll(regex)];

    for (const [token, rawPath] of tokens) {
        try {
            const extMatch = rawPath.match(/\.([a-zA-Z0-9]+)$/);
            const ext = extMatch ? extMatch[1] : '';

            const withoutExt = rawPath.replace(/\.[^.]+$/, '');
            const filePath = withoutExt.replace(/\./g, '/');

            const fullPath = path.join(appDir, 'code', `${filePath}.${ext}`);
            const code = await fs.readFile(fullPath, 'utf-8');

            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const markdownCode = `\n\`\`\`${ext}\n${code}\n\`\`\`\n`;

            const highlightedHtml = marked(markdownCode);

            html = html.replace(new RegExp(escaped, 'g'), highlightedHtml);
        } catch {
            console.warn(`⚠️ File code tidak ditemukan: ${rawPath}`);
        }
    }

    return html;
}

async function ensureTemplateExists() {
    try {
        await fs.access(templatePath);
    } catch {
        await fs.mkdir(publicDir, { recursive: true });
        await fs.writeFile(templatePath, staticHtml, 'utf-8');
        console.log(
            chalk.green('✅ File public/index.html default berhasil dibuat.')
        );
    }
}

async function ensureMdExists() {
    try {
        await fs.access(mdDir);
    } catch {
        await fs.mkdir(mdDir, { recursive: true });
        await fs.writeFile(path.join(mdDir, 'index.md'), defaultMd, 'utf-8');
        console.log(
            chalk.green('✅ Folder app/md dibuat dengan index.md default.')
        );
    }
}

async function ensureAppStructure() {
    const folders = [cssDir, jsDir, htmlDir, codeDir];

    for (const folder of folders) {
        try {
            await fs.access(folder);
        } catch {
            await fs.mkdir(folder, { recursive: true });
            console.log(
                chalk.green(`✅ Folder ${path.relative(cwd, folder)} dibuat.`)
            );
        }
    }
}

async function ensureJsonFileExists(filePath, defaultContent = []) {
    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(
            filePath,
            JSON.stringify(defaultContent, null, 2),
            'utf-8'
        );
        console.log(
            chalk.green(`✅ File ${path.basename(filePath)} berhasil dibuat.`)
        );
    }
}

async function ensurePrettierIgnore() {
    try {
        await fs.access(prettierIgnorePath);
    } catch {
        await fs.writeFile(prettierIgnorePath, prettierIgnoreContent, 'utf-8');

        console.log(chalk.green('✅ File .prettierignore berhasil dibuat.'));
    }
}

async function initProject() {
    const firstRun = await isFirstRun();
    if (!firstRun) {
        console.log(chalk.gray('ℹ️ Project sudah diinisialisasi'));
        return;
    }

    console.log(chalk.yellow('🚀 Inisialisasi project baru...'));

    await ensureTemplateExists();
    await ensureMdExists();
    await ensureAppStructure();
    await ensureJsonFileExists(configPath, {});
    await ensureJsonFileExists(titlesPath, {});
    await ensureJsonFileExists(cdnCssPath, []);
    await ensureJsonFileExists(cdnJsPath, []);
    await ensureJsonFileExists(cdnHighlightPath, []);
    await ensurePrettierIgnore();
    await loadConfig();

    console.log(chalk.green('✅ Project siap digunakan'));
}

async function loadHighlightCdn() {
    const defaultUrl =
        'https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/styles/github.min.css';
    try {
        const data = await fs.readFile(cdnHighlightPath, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed[0];
        } else if (typeof parsed === 'string' && parsed.trim() !== '') {
            return parsed;
        } else {
            return defaultUrl;
        }
    } catch {
        return defaultUrl;
    }
}

async function loadTemplate() {
    return await fs.readFile(templatePath, 'utf-8');
}

async function loadConfig(readonly = false) {
    let config = {};

    try {
        const data = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(data);
    } catch {
        if (readonly) return {};
        config = {};
    }

    if (!readonly) {
        let changed = false;

        if (!config.outDir) {
            config.outDir = 'dist';
            changed = true;
        }

        if (typeof config.singleQuote !== 'boolean') {
            if (config.singleQuote !== undefined) {
                throw new Error(
                    '❌ config.singleQuote harus bernilai true atau false'
                );
            }
            config.singleQuote = true;
            changed = true;
        }

        if (typeof config.copyButton !== 'boolean') {
            if (config.copyButton !== undefined) {
                throw new Error(
                    '❌ config.copyButton harus bernilai true atau false'
                );
            }

            config.copyButton = false;
            changed = true;
        }

        if (typeof config.autoTranslate !== 'boolean') {
            if (config.autoTranslate !== undefined) {
                throw new Error(
                    '❌ config.autoTranslate harus bernilai true atau false'
                );
            }

            config.autoTranslate = false;
            changed = true;
        }

        if (config.githubPages === undefined) {
            config.githubPages = null;
            changed = true;
        }

        if (changed) {
            await saveConfig(config);
        }
    }

    return config;
}

async function loadTitles() {
    try {
        const data = await fs.readFile(titlesPath, 'utf-8');
        return JSON.parse(data);
    } catch {
        await fs.writeFile(titlesPath, JSON.stringify({}, null, 2), 'utf-8');
        console.log(chalk.green('✅ File titles.json berhasil dibuat.'));
        return {};
    }
}

async function saveConfig(config) {
    const newContent = JSON.stringify(config, null, 2);

    let oldContent = '';

    try {
        oldContent = await fs.readFile(configPath, 'utf-8');
    } catch {}

    if (oldContent === newContent) {
        return;
    }

    await fs.writeFile(configPath, newContent, 'utf-8');
}

async function cleanFolder(dir, allowedExtensions = [], allowedFiles = []) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const filePath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await cleanFolder(filePath, allowedExtensions, allowedFiles);
                const remaining = await fs.readdir(filePath);
                if (remaining.length === 0) {
                    await fs.rmdir(filePath);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (
                    !allowedExtensions.includes(ext) &&
                    !allowedFiles.includes(entry.name)
                ) {
                    await fs.unlink(filePath);
                }
            }
        }
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

async function cleanupAll() {
    await cleanFolder(publicDir, [], ['index.html']);
    await cleanFolder(mdDir, ['.md']);
    await cleanFolder(htmlDir, ['.html']);
    await cleanFolder(cssDir, ['.css']);
    await cleanFolder(jsDir, ['.js']);
}

async function loadCdnLinks(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function getMarkdownFilesRecursively(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                return getMarkdownFilesRecursively(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                return fullPath;
            } else {
                return null;
            }
        })
    );
    return files.flat().filter(Boolean);
}

async function getHtmlFilesRecursively(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
            entries.map(async (entry) => {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    return getHtmlFilesRecursively(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.html')) {
                    return fullPath;
                } else {
                    return null;
                }
            })
        );
        return files.flat().filter(Boolean);
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

async function removeEmptyDirs(dir) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);
            await removeEmptyDirs(fullPath);
        }
    }

    const remaining = await fs.readdir(dir);
    if (remaining.length === 0) {
        await fs.rmdir(dir);
    }
}

async function build() {
    try {
        const initialized = await isProjectInitialized();

        await cleanupAll();

        const config = initialized
            ? await loadConfig()
            : await loadConfig(true);
        await loadGlobalHtml();

        const basePrefix = config.githubPages ? `${config.githubPages}` : '';

        const distDir = path.join(cwd, config.outDir);
        await fs.mkdir(distDir, { recursive: true });

        const cdnCssList = await loadCdnLinks(cdnCssPath);
        const cdnJsList = await loadCdnLinks(cdnJsPath);
        const cdnHighlightUrl = await loadHighlightCdn();

        const cdnCssTags = cdnCssList
            .map(
                (url) =>
                    `<link rel='stylesheet' href='${url}' crossorigin='anonymous' />`
            )
            .join('\n');
        const cdnJsTags = cdnJsList
            .map(
                (url) =>
                    `<script src='${url}' crossorigin='anonymous'></script>`
            )
            .join('\n');

        const template = await loadTemplate();
        const mdFiles = await getMarkdownFilesRecursively(mdDir);

        for (const inputPath of mdFiles) {
            const relativePath = path.relative(mdDir, inputPath);
            const outputFileName = relativePath.replace(/\.md$/, '.html');
            const outputPath = path.join(distDir, outputFileName);
            await fs.mkdir(path.dirname(outputPath), { recursive: true });

            const mdRaw = await fs.readFile(inputPath, 'utf-8');

            let updatedMdContent = replaceMarkdownLinks(mdRaw);

            updatedMdContent = await processCodePlaceholders(updatedMdContent);

            const htmlFromMarkdown = globalHtml + marked(updatedMdContent);
            const htmlWithInsertedContent =
                await processHtmlPlaceholders(htmlFromMarkdown);
            const htmlWithPrefix = replaceHtmlLinks(
                htmlWithInsertedContent,
                basePrefix
            );

            const hasCodeBlock = /<pre><code/.test(htmlWithInsertedContent);

            const cdnLink = hasCodeBlock
                ? `<link rel='stylesheet' href='${cdnHighlightUrl}' crossorigin='anonymous' />`
                : '';

            const rawCssFiles = await readAndConcatFiles(cssDir, ['.css']);

            const rawCss = [
                rawCssFiles,
                hasCodeBlock && config.copyButton ? staticCss : '',
            ].join('\n');

            const minifiedCss = rawCss
                ? new CleanCSS().minify(rawCss).styles
                : '';

            const rawJsFiles = await readAndConcatFiles(jsDir, ['.js']);

            const rawJs = [
                rawJsFiles,

                hasCodeBlock && config.copyButton ? staticJs : '',

                config.autoTranslate ? translateJs : '',
            ].join('\n');

            const minifiedJs = rawJs ? (await minifyJS(rawJs)).code || '' : '';

            const titleKey = path.basename(inputPath, '.md');
            const title = (await loadTitles())[titleKey] || titleKey;
            const styleTag = minifiedCss ? `<style>${minifiedCss}</style>` : '';
            const scriptTag = minifiedJs
                ? `<script>${minifiedJs}</script>`
                : '';
            const baseTag = basePrefix ? `<base href="/${basePrefix}/">` : '';

            let fullHtml = template
                .replace(/{title}/g, title)
                .replace(/{base_href}/g, baseTag)
                .replace(/{cdn.highlight}/g, cdnLink)
                .replace(/{cdn.css}/g, cdnCssTags)
                .replace(/{content}/g, htmlWithPrefix)
                .replace(/{style}/g, styleTag)
                .replace(/{script}/g, scriptTag)
                .replace(/{cdn.js}/g, cdnJsTags);

            const commentHeader = `<!--  
Developed by: Salman  
-->  
`;

            const minifiedNormalHtml = await minifyHTML(fullHtml, {
                collapseWhitespace: true,
                removeComments: true,
                minifyJS: true,
                minifyCSS: true,
            });

            const finalOutputHtml = config.singleQuote
                ? minifiedNormalHtml.replace(/="([^"]*)"/g, "='$1'")
                : minifiedNormalHtml;

            await fs.writeFile(
                outputPath,
                commentHeader + finalOutputHtml,
                'utf-8'
            );
            console.log(
                chalk.green(
                    `✅ ${relativePath} → ${config.outDir}/${outputFileName}`
                )
            );
        }

        const isRootOutput = path.resolve(distDir) === path.resolve(cwd);
        if (!isRootOutput) {
            const expectedHtmlSet = new Set(
                mdFiles.map((mdPath) => {
                    const rel = path.relative(mdDir, mdPath);
                    return path.join(distDir, rel.replace(/\.md$/, '.html'));
                })
            );

            const existingHtmlFiles = await getHtmlFilesRecursively(distDir);

            for (const htmlFile of existingHtmlFiles) {
                if (!expectedHtmlSet.has(htmlFile)) {
                    await fs.unlink(htmlFile);
                    console.log(
                        chalk.yellow(
                            `🗑️ Sinkronisasi: hapus ${path.relative(
                                distDir,
                                htmlFile
                            )}`
                        )
                    );
                }
            }

            await removeEmptyDirs(distDir);
        }

        console.log(chalk.green('🎉 Semua file selesai dikonversi!'));
    } catch (err) {
        console.error(chalk.red(err));
    }
}

async function buildDevOnce() {
    const mdFiles = await getMarkdownFilesRecursively(mdDir);

    if (mdFiles.length === 0) {
        console.log(chalk.yellow('⚠️ Tidak ada file markdown'));
        return devMemory;
    }

    const template = await loadTemplate();
    const titles = await loadTitles();

    const config = await loadConfig();
    await loadGlobalHtml();

    const cdnCssList = await loadCdnLinks(cdnCssPath);
    const cdnJsList = await loadCdnLinks(cdnJsPath);
    const cdnHighlightUrl = await loadHighlightCdn();

    const cdnCssTags = cdnCssList
        .map(
            (url) =>
                `<link rel='stylesheet' href='${url}' crossorigin='anonymous' />`
        )
        .join('\n');

    const cdnJsTags = cdnJsList
        .map((url) => `<script src='${url}' crossorigin='anonymous'></script>`)
        .join('\n');

    for (const inputPath of mdFiles) {
        const relativePath = path.relative(mdDir, inputPath);

        const urlPath =
            '/' + relativePath.replace(/\\/g, '/').replace(/\.md$/, '.html');

        const mdRaw = await fs.readFile(inputPath, 'utf-8');

        let content = replaceMarkdownLinks(mdRaw);
        content = await processCodePlaceholders(content);

        const htmlFromMarkdown = globalHtml + marked(content);
        const htmlWithInjected =
            await processHtmlPlaceholders(htmlFromMarkdown);

        const hasCodeBlock = /<pre><code/.test(htmlWithInjected);

        const cdnHighlightTag = hasCodeBlock
            ? `<link rel='stylesheet' href='${cdnHighlightUrl}' crossorigin='anonymous' />`
            : '';

        const rawCssFiles = await readAndConcatFiles(cssDir, ['.css']);

        const rawCss = [
            rawCssFiles,
            hasCodeBlock && config.copyButton ? staticCss : '',
        ].join('\n');

        const rawJsFiles = await readAndConcatFiles(jsDir, ['.js']);

        const rawJs = [
            rawJsFiles,

            devReloadScript,

            hasCodeBlock && config.copyButton ? staticJs : '',

            config.autoTranslate ? translateJs : '',
        ].join('\n');

        const minifiedCss = rawCss ? new CleanCSS().minify(rawCss).styles : '';

        const minifiedJs = rawJs ? (await minifyJS(rawJs)).code || '' : '';

        const titleKey = path.basename(inputPath, '.md');
        const title = titles[titleKey] || titleKey;

        const styleTag = minifiedCss ? `<style>${minifiedCss}</style>` : '';
        const scriptTag = minifiedJs ? `<script>${minifiedJs}</script>` : '';
        const baseTag = '';

        const fullHtml = template
            .replace(/{title}/g, title)
            .replace(/{base_href}/g, baseTag)
            .replace(/{cdn.highlight}/g, cdnHighlightTag)
            .replace(/{cdn.css}/g, cdnCssTags)
            .replace(/{content}/g, htmlWithInjected)
            .replace(/{style}/g, styleTag)
            .replace(/{script}/g, scriptTag)
            .replace(/{cdn.js}/g, cdnJsTags);

        const finalHtml = await minifyHTML(fullHtml, {
            collapseWhitespace: true,
            removeComments: true,
            removeEmptyAttributes: true,
            minifyCSS: true,
            minifyJS: true,
        });

        const commentHeader = `<!--  
Developed by: Salman  
GitHub: https://github.com/salmantok  
-->  
`;

        const finalHtmlWithQuotes = config.singleQuote
            ? finalHtml.replace(/="([^"]*)"/g, "='$1'")
            : finalHtml;

        devMemory.set(urlPath, commentHeader + finalHtmlWithQuotes);
    }

    if (!devMemory.has('/index.html') && devMemory.size > 0) {
        const first = devMemory.values().next().value;
        devMemory.set('/index.html', first);
    }

    return devMemory;
}

function openBrowser(url) {
    const platform = process.platform;

    if (platform === 'win32') {
        exec(`start ${url}`);
    } else if (platform === 'darwin') {
        exec(`open ${url}`);
    } else {
        exec(`xdg-open ${url}`);
    }
}

async function dev() {
    try {
        console.log(chalk.cyan('⚡ MDXtra Dev Server'));

        await buildDevOnce();

        let clients = [];

        const server = http.createServer((req, res) => {
            if (req.url === '/__reload') {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                });
                res.write('\n');

                clients.push(res);

                req.on('close', () => {
                    clients = clients.filter((c) => c !== res);
                });

                return;
            }

            if (req.url === '/' && devMemory.has('/index.html')) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(devMemory.get('/index.html'));
                return;
            }

            if (devMemory.has(req.url)) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(devMemory.get(req.url));
                return;
            }
        });

        server.listen(3173, '127.0.0.1', () => {
            const url = 'http://127.0.0.1:3173';
            console.log(chalk.green(`🚀 ${url}`));

            openBrowser(url);
        });

        chokidar
            .watch([
                mdDir,
                htmlDir,
                cssDir,
                jsDir,
                templatePath,
                configPath,
                titlesPath,
                cdnCssPath,
                cdnJsPath,
                cdnHighlightPath,
            ])
            .on('change', async (file) => {
                console.log(chalk.yellow(`🔄 ${file} berubah`));

                await buildDevOnce();

                clients.forEach((res) => {
                    res.write('data: reload\n\n');
                });
            });
    } catch (err) {
        console.error(chalk.red(err));
    }
}

async function main() {
    if (isInit) {
        await initProject();
        return;
    }

    if (isDev) {
        await dev();
        return;
    }

    if (isBuild) {
        await build();
        return;
    }

    console.log(chalk.red(`❌ Argumen tidak dikenal: ${mode}`));
}

main();
