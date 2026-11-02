#!/usr/bin/env node
/* =====================================================================
   Пререндер: вписывает данные из js/config.js в статичный index.html.
   Зачем: поисковики и превью в мессенджерах не выполняют JS — им нужен
   готовый текст в разметке. Сайт работает и без этого шага, но тогда
   в HTML останется текст прошлого клиента.

   Запуск из папки сайта:   node tools/prerender.mjs
   Нужен только Node.js 18+, никаких пакетов.

   Что делает:
   - заполняет все блоки <div id="r-…"> готовым HTML из конфига;
   - <title>, description, canonical, Open Graph, JSON-LD;
   - data-theme и свои цвета на <html> (тема видна и без JS);
   - demo: true → раскомментирует noindex, demo: false → закомментирует.
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const sandbox = { window: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/config.js'), sandbox, { filename: 'config.js' });
const cfg = sandbox.window.SITE_CONFIG;
if (!cfg) { console.error('В js/config.js не найден window.SITE_CONFIG'); process.exit(1); }
vm.runInContext(read('js/main.js'), sandbox, { filename: 'main.js' });
const R = sandbox.module.exports;

// JSON туда-обратно: объект из vm → обычный объект (тот же JSON.stringify, что в браузере)
const data = JSON.parse(JSON.stringify(cfg));
const out = R.renderAll(data);
const esc = R.esc;
let html = read('index.html');
let missing = [];

for (const k of R.REGIONS) {
  const re = new RegExp(`(<div id="r-${k}" class="r"[^>]*>)[\\s\\S]*?(</div><!--/r-${k}-->)`);
  if (!re.test(html)) { missing.push(k); continue; }
  html = html.replace(re, (_, a, b) => a + out[k] + b);
}

const seo = data.seo || {};
const setMeta = (attr, name, val) => {
  const re = new RegExp(`(<meta ${attr}="${name}" content=")[^"]*(">)`);
  html = html.replace(re, (_, a, b) => a + esc(val || '') + b);
};
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(seo.title || data.nameFull || data.name || '')}</title>`);
setMeta('name', 'description', seo.description);
setMeta('property', 'og:title', seo.title);
setMeta('property', 'og:description', seo.description);
setMeta('property', 'og:url', seo.url);
setMeta('property', 'og:image', seo.ogImage);
html = html.replace(/(<link rel="canonical" href=")[^"]*(">)/, (_, a, b) => a + esc(seo.url || '') + b);
html = html.replace(/(<script type="application\/ld\+json" id="ld-json">)[\s\S]*?(<\/script>)/, (_, a, b) => a + out.ld + b);

// тема на <html>
const PRESET_BG = { garage: '#141414', workshop: '#F4F1EA', premium: '#0F1113' };
const th = data.theme || {};
const vars = { bg: '--c-bg', surface: '--c-surface', text: '--c-text', muted: '--c-muted', accent: '--c-accent', onAccent: '--c-on-accent', accent2: '--c-accent-2' };
let style = Object.entries(vars).filter(([k]) => th.colors && th.colors[k]).map(([k, v]) => `${v}:${th.colors[k]}`);
if (typeof th.radius === 'number') style.push(`--radius:${th.radius}px`);
const htmlTag = `<html lang="ru" data-theme="${esc(th.preset || 'premium')}" data-style="${esc(th.style || 'report')}" data-prerendered="${R.hash(data)}"${style.length ? ` style="${esc(style.join(';'))}"` : ''}>`;
html = html.replace(/<html[^>]*>/, htmlTag);
// шрифт заголовков стиля — в preload (первым грузится то, что видно на первом экране)
const FONT = { report: 'unbounded-var.woff2', paper: 'oswald-var.woff2', signal: 'russo-one.woff2', friendly: 'onest-var.woff2' };
html = html.replace(/(<link rel="preload" href="fonts\/)[^"]+(" as="font")/, (_, a, b) => a + (FONT[th.style] || FONT.report) + b);
html = html.replace(/(<meta name="theme-color" content=")[^"]*(">)/, (_, a, b) => a + ((th.colors && th.colors.bg) || PRESET_BG[th.preset] || '#141414') + b);

// noindex для демо
const ON = '<meta name="robots" content="noindex, nofollow">';
const OFF = '<!-- <meta name="robots" content="noindex, nofollow"> -->';
html = data.demo ? html.replace(OFF, ON) : html.replace(new RegExp(`(^|\\n)${ON.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `$1${OFF}`);

writeFileSync(join(root, 'index.html'), html);
console.log(`Готово: index.html обновлён (${(Buffer.byteLength(html) / 1024).toFixed(1)} КБ).` +
  (data.demo ? ' Демо-режим: noindex включён.' : '') +
  (missing.length ? `\nНе найдены блоки в разметке: ${missing.join(', ')}` : ''));
