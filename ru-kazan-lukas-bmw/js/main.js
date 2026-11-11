/* =====================================================================
   core/main.js — поведение страницы. Подключается type="module",
   рендер не блокирует. Всё, что здесь делается, — улучшение:
   без JS статичная разметка уже полная и рабочая.
   ===================================================================== */
import data from './data.js?v=fl093q';
import { hash, tpl } from './util.js?v=fl093q';
import { hoursStatus, nowIn } from './hours.js?v=fl093q';

const html = document.documentElement;
const lang = html.lang || data.lang[0];
const d = Object.assign({}, data.i18n[lang] || data.i18n[data.lang[0]]);
const mqDesk = matchMedia('(min-width: 1024px)');
/* «жидкое стекло»: преломление фона через SVG-фильтр умеет только Chromium (userAgentData есть только в нём) */
if (navigator.userAgentData && (navigator.userAgentData.brands || []).some((b) => b.brand === 'Chromium')) html.classList.add('lg-refract');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* 0. data.js правили руками и prerender не запускали → перерисовать из данных */
async function ensureFresh() {
  if (html.dataset.prerendered === hash(data)) return;
  const [{ createRenderer }, niche] = await Promise.all([import('./render.js?v=fl093q'), import('./niche.js?v=fl093q')]);
  const R = createRenderer(data, lang, niche.default);
  $('#app').innerHTML = R.body();
  const s = R.seo();
  document.title = s.title;
  html.dataset.prerendered = hash(data);
  console.info('[site] страница перерисована из data.js — запустите prerender, чтобы обновить статичный HTML');
}

/* 1. Часы: статус «Открыто до …», сегодняшний день */
function hours() {
  const run = () => {
    $$('[data-status]').forEach((el) => {
      const loc = data.locations[+el.dataset.status];
      const st = loc && hoursStatus(loc.hours, data.meta.timezone, d);
      if (!st) return;
      el.textContent = st.text;
      el.classList.toggle('is-open', st.open);
      el.hidden = false;
    });
    const { day } = nowIn(data.meta.timezone);
    $$('.hours__tb tr').forEach((tr) => {
      const on = +tr.dataset.day === day;
      tr.classList.toggle('is-today', on);
      const th = tr.querySelector('th');
      let tag = th.querySelector('.today');
      if (on && !tag) { tag = document.createElement('span'); tag.className = 'today'; tag.textContent = d.today; th.append(tag); }
      if (!on && tag) tag.remove();
    });
  };
  run();
  setInterval(run, 60_000);
}

/* 2. Шапка: компактная при прокрутке; меню закрывается по ссылке/Esc/клику мимо */
function header() {
  const hdr = $('[data-hdr]');
  if (!hdr) return;
  if ($('.hdr__demo', hdr)) html.classList.add('has-demo');
  let ticking = false;
  const upd = () => { hdr.classList.toggle('is-scrolled', scrollY > 24); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
  const menu = $('.hdr__menu', hdr);
  if (menu) {
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setTimeout(() => { menu.open = false; }, 0); }); // закрыть после перехода по якорю
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
    document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  }
  /* Подсветка пункта меню: раздел, который занимает верх экрана сразу под шапкой. Смотрим ВСЕ секции
     страницы (не только те, что в меню): если сверху раздел, которого в меню нет (например «Гарантия»),
     не подсвечивается ничего — иначе висела бы подсветка предыдущего пункта. Чтения размеров — раз в кадр,
     записей в DOM — только когда раздел сменился. */
  const links = $$('.hdr__nav a');
  if (links.length) {
    const bar = $('.hdr__bar', hdr);
    const secs = $$('main > section[id]');
    let current = null, queued = false;
    const update = () => {
      queued = false;
      const line = bar.getBoundingClientRect().bottom + 8; // чуть ниже нижнего края шапки
      const top = secs.find((s) => { const r = s.getBoundingClientRect(); return r.top <= line && r.bottom > line; });
      const id = top ? top.id : null;
      if (id === current) return;
      current = id;
      links.forEach((a) => { if (a.hash === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    requestAnimationFrame(update);
  }
}

/* 3. Мобильная панель: появляется после первого экрана */
function mobileBar() {
  const bar = $('[data-mbar]'), hero = $('#hero');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  bar.classList.add('is-hidden');
  new IntersectionObserver(([e]) => bar.classList.toggle('is-hidden', e.isIntersecting), { rootMargin: '0px 0px -40% 0px' }).observe(hero);
}

/* 4. Лайтбокс: свайп, Esc, стрелки; пара до/после — два слайда */
function lightbox() {
  const dlg = $('[data-lb-dialog]');
  const links = $$('[data-lb]');
  if (!dlg || !links.length || typeof dlg.showModal !== 'function') return;
  const img = $('[data-lb-img]', dlg), cap = $('[data-lb-cap]', dlg);
  const slides = [];
  data.portfolio.forEach((p, i) => {
    const c = typeof p.caption === 'object' ? (p.caption[lang] || p.caption.o) : p.caption;
    const alt = p.alt || c;
    if (p.before) slides.push({ i, src: p.before.lg, alt: `${alt} — ${d.before}`, cap: `${c ? c + ' — ' : ''}${d.before}` });
    slides.push({ i, src: p.img.lg, alt: p.before ? `${alt} — ${d.after}` : alt, cap: p.before ? `${c ? c + ' — ' : ''}${d.after}` : c });
  });
  let cur = 0, opener = null;
  const visible = () => slides.filter((s) => !links[s.i].closest('[hidden]'));
  const show = (n, dir = 1) => {
    const list = visible();
    cur = (n + list.length) % list.length;
    const s = list[cur];
    img.classList.remove('is-in'); void img.offsetWidth;
    img.style.setProperty('--dir', dir);
    img.src = s.src; img.alt = s.alt;
    img.classList.add('is-in');
    cap.textContent = `${s.cap ? s.cap + ' · ' : ''}${tpl(d.photo_n, { n: cur + 1, total: list.length })}`;
    const nx = list[(cur + 1) % list.length]; if (nx) { const pre = new Image(); pre.src = nx.src; }
  };
  links.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    opener = a;
    const list = visible();
    show(Math.max(0, list.findIndex((s) => s.i === +a.dataset.lb)));
    dlg.showModal();
  }));
  $('[data-lb-prev]', dlg).addEventListener('click', () => show(cur - 1, -1));
  $('[data-lb-next]', dlg).addEventListener('click', () => show(cur + 1, 1));
  $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(cur - 1, -1);
    if (e.key === 'ArrowRight') show(cur + 1, 1);
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lb__stage')) dlg.close(); });
  dlg.addEventListener('close', () => { if (opener) opener.focus(); });
  let x0 = null;
  const stage = $('.lb__stage', dlg);
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
}

/* 5. Ленивая карта: iframe только по клику */
function maps() {
  $$('[data-map]').forEach((box) => {
    const btn = $('.map__btn', box);
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (box.classList.contains('is-loaded')) return;
      const f = document.createElement('iframe');
      f.src = box.dataset.map;
      f.title = box.dataset.mapTitle;
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.allowFullscreen = true;
      box.append(f);
      box.classList.add('is-loaded');
      f.focus();
    });
  });
}

/* 6. Несколько точек: табы на мобильном, колонки на ПК */
function locTabs() {
  const tabs = $('[data-tabs]');
  if (!tabs) return;
  const btns = $$('[data-tab]', tabs);
  const panels = btns.map((b) => document.getElementById('loc-' + b.dataset.tab));
  let cur = 0;
  const select = (i, focus) => {
    cur = i;
    btns.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    panels.forEach((p, j) => { p.hidden = j !== i; });
    if (focus) btns[i].focus();
  };
  const apply = () => {
    if (mqDesk.matches) {
      tabs.hidden = true; tabs.removeAttribute('role');
      btns.forEach((b) => { b.removeAttribute('role'); b.removeAttribute('aria-selected'); b.removeAttribute('aria-controls'); });
      panels.forEach((p) => { p.hidden = false; p.removeAttribute('role'); p.removeAttribute('aria-labelledby'); });
    } else {
      tabs.hidden = false; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', d.locations_label);
      btns.forEach((b, j) => { b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'loc-' + j); });
      panels.forEach((p, j) => { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'loc-tab-' + j); });
      select(cur);
    }
  };
  btns.forEach((b, i) => b.addEventListener('click', () => select(i)));
  tabs.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') select((cur + 1) % btns.length, true);
    if (e.key === 'ArrowLeft') select((cur - 1 + btns.length) % btns.length, true);
  });
  mqDesk.addEventListener('change', apply);
  apply();
}

/* 7. Прайс: на мобильном — аккордеон (открыта первая категория) */
function priceAccordion() {
  const cats = $$('.pcat');
  if (cats.length < 2) return;
  const sec = cats[0].closest('section');
  const below = sec && sec.getBoundingClientRect().top > innerHeight;
  const apply = () => {
    if (mqDesk.matches) cats.forEach((c) => { c.open = true; c.querySelector('summary').tabIndex = -1; });
    else cats.forEach((c, i) => { c.querySelector('summary').removeAttribute('tabindex'); if (below) c.open = i === 0; });
  };
  apply();
  mqDesk.addEventListener('change', apply);
}

/* 8. Фильтр работ по типам */
function worksFilter() {
  const f = $('.filter');
  if (!f) return;
  f.hidden = false;
  const items = $$('.mosaic__item');
  f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    $$('[data-filter]', f).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    items.forEach((it) => { it.hidden = !!b.dataset.filter && it.dataset.type !== b.dataset.filter; });
    document.dispatchEvent(new CustomEvent('site:filter'));
  });
}

/* 9. Год в подвале — текущий */
function year() {
  const y = new Date().getFullYear();
  $$('.ftr__copy').forEach((p) => { p.textContent = p.textContent.replace(String(data.meta.year), String(y)); });
}

/* 10. Точные якоря. Секции ниже экрана сначала не раскладываются (content-visibility: auto в core.css —
   быстрая первая отрисовка), их высота до показа — оценка. Чтобы переход по якорю попадал точно в начало
   секции, все секции раскладываются по-настоящему (класс .cv-off) в момент, когда человек собрался
   переходить: навёл курсор или фокус на меню, открыл мобильное меню, коснулся ссылки-якоря.
   Дорисовка идёт после отрисовки отклика на само действие — нажатие не подтормаживает.
   Не успели (сразу Enter по ссылке) — дорисовываем синхронно прямо перед прокруткой. */
function sections() {
  let done = false;
  const all = () => { if (!done) { done = true; html.classList.add('cv-off'); } };
  const soon = () => { if (!done) requestAnimationFrame(() => setTimeout(all, 0)); };
  const isAnchor = (e) => e.target.closest && e.target.closest('a[href^="#"]');
  const hdr = $('[data-hdr]');
  if (hdr) {
    hdr.addEventListener('pointerenter', soon, { once: true });
    hdr.addEventListener('focusin', soon, { once: true });
    const menu = $('.hdr__menu', hdr);
    if (menu) menu.addEventListener('toggle', soon, { once: true });
  }
  document.addEventListener('pointerdown', (e) => { if (isAnchor(e)) soon(); }, { passive: true });
  document.addEventListener('focusin', (e) => { if (isAnchor(e)) soon(); });
  document.addEventListener('click', (e) => { if (isAnchor(e)) all(); }, true);
  if (location.hash.length > 1) {
    all();
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ behavior: 'instant' });
  }
}

async function init() {
  await ensureFresh();
  const run = (fns) => fns.forEach((fn) => { try { fn(); } catch (e) { console.error('[site]', fn.name, e); } });
  /* сразу — то, что видно на первом экране; остальное — в простое после загрузки */
  run([header, hours, mobileBar, sections]);
  await new Promise((ok) => {
    const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(ok, { timeout: 1500 }) : setTimeout(ok, 150));
    if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
  });
  run([lightbox, maps, locTabs, priceAccordion, worksFilter, year]);
  if (html.dataset.nicheJs) import('./niche-behavior.js?v=fl093q').catch((e) => console.error('[site] niche-behavior', e));
  html.classList.add('is-ready');
  dispatchEvent(new Event('site:ready'));
}
init();
