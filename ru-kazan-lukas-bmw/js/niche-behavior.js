/* =====================================================================
   niches/auto/behavior.js — прайс по сериям (переключатель серий + поиск).
   В готовом сайте лежит как js/niche-behavior.js; main.js подгружает его после загрузки.
   Данные берутся из статичной разметки прайса (таблицы по сериям — они же работают без JS):
   одинаковые услуги разных серий сводятся в одну строку, при смене серии цены
   перестраиваются (FLIP: только transform и opacity, без анимации размеров).
   ===================================================================== */
import data from './data.js?v=fl093q';

const root = document.querySelector('[data-series-root]');
if (root) init(root);

function init(root) {
  const html = document.documentElement;
  const lang = html.lang || data.lang[0];
  const d = Object.assign({}, data.i18n[lang] || data.i18n[data.lang[0]]);
  Object.assign(d, (d._variants || {})[data.meta.variant] || {});
  const t = (k, v) => String(d[k] || k).replace(/\{(\w+)\}/g, (_, x) => (v && v[x] != null ? v[x] : ''));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LIMIT = 14;

  const ui = root.querySelector('[data-series-ui]');
  const stat = root.querySelector('[data-series-static]');
  const board = root.querySelector('[data-series-board]');
  const panel = root.querySelector('[data-series-panel]');
  const tabs = [...root.querySelectorAll('[data-series]')];
  const q = root.querySelector('[data-series-q]');
  const count = root.querySelector('[data-series-count]');
  const empty = root.querySelector('[data-series-empty]');
  const more = root.querySelector('[data-series-more]');

  /* ---------- данные из статичных таблиц ---------- */
  const textOf = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const cats = [...stat.querySelectorAll('.pcat')];
  const rows = [];
  const byKey = new Map();
  cats.forEach((cat, s) => {
    cat.querySelectorAll('.prow').forEach((li) => {
      const nameEl = li.querySelector('.prow__name');
      const name = [...nameEl.childNodes].filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !n.matches('small'))).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
      const key = name.toLowerCase().replace(/ё/g, 'е');
      let r = byKey.get(key);
      if (!r) { r = { key, name, prices: [], notes: [] }; byKey.set(key, r); rows.push(r); }
      r.prices[s] = textOf(li.querySelector('.prow__price'));
      r.notes[s] = textOf(li.querySelector('.prow__note'));
    });
  });
  if (!rows.length) return;
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  rows.forEach((r) => { r.hay = norm(r.name + ' ' + r.notes.filter(Boolean).join(' ')); });

  /* ---------- строки витрины (создаются один раз) ---------- */
  const frag = document.createDocumentFragment();
  rows.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'srow';
    li.hidden = true;
    li.innerHTML = '<span class="srow__name"><span class="srow__t"></span><small class="srow__note"></small></span><span class="srow__lead" aria-hidden="true"></span><span class="srow__price"><span class="srow__val"></span></span>';
    li.querySelector('.srow__t').textContent = r.name;
    r.el = li; r.val = li.querySelector('.srow__val'); r.note = li.querySelector('.srow__note');
    frag.append(li);
  });
  board.append(frag);

  /* ползунок переключателя */
  const tablist = root.querySelector('.series__tabs');
  const thumb = document.createElement('span');
  thumb.className = 'series__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  tablist.prepend(thumb);

  let series = 0, query = '', expanded = false, first = true;

  const inView = (b) => b.bottom > -160 && b.top < innerHeight + 160;
  function placeThumb(animate) {
    const tab = tabs[series];
    thumb.style.width = tab.offsetWidth + 'px';
    thumb.style.height = tab.offsetHeight + 'px';
    thumb.style.transition = animate && !reduce ? '' : 'none';
    thumb.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
  }

  function render(animate) {
    const match = rows.filter((r) => r.prices[series] != null && (!query || r.hay.includes(query)));
    const limited = !query && !expanded && match.length > LIMIT + 2;
    const show = new Set(limited ? match.slice(0, LIMIT) : match);
    const anim = animate && !reduce;

    // FLIP: First — где строки были
    const before = new Map();
    if (anim) rows.forEach((r) => { if (!r.el.hidden) { const b = r.el.getBoundingClientRect(); if (inView(b)) before.set(r, b); } });

    // обновление
    const changed = [];
    rows.forEach((r) => {
      const on = show.has(r);
      r.el.hidden = !on;
      if (!on) return;
      const p = r.prices[series];
      if (r.val.textContent !== p) { if (r.val.textContent) changed.push(r); r.val.textContent = p; }
      const n = r.notes[series] || '';
      if (r.note.textContent !== n) r.note.textContent = n;
      r.note.hidden = !n;
    });

    // Last / Invert / Play
    if (anim) {
      let k = 0;
      rows.forEach((r) => {
        if (!show.has(r)) return;
        const a = r.el.getBoundingClientRect();
        if (!inView(a)) return;
        const b = before.get(r);
        if (b) {
          const dx = b.left - a.left, dy = b.top - a.top;
          if (dx || dy) r.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
        } else {
          r.el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: Math.min(k++, 14) * 22, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
        }
      });
      changed.forEach((r, i) => {
        if (!inView(r.el.getBoundingClientRect())) return;
        r.val.animate([{ opacity: 0, transform: 'translateY(55%)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 460, delay: Math.min(i, 16) * 16, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
      });
    }

    const label = tabs[series].querySelector('.series__tab-v').textContent;
    count.textContent = t(query ? 'series_found_q' : 'series_found', { n: match.length, s: label });
    empty.hidden = match.length > 0;
    const canMore = !query && match.length > LIMIT + 2;
    more.hidden = !canMore;
    more.textContent = expanded ? t('series_less') : t('series_more', { n: match.length });
    more.setAttribute('aria-expanded', String(expanded));
    first = false;
  }

  function select(i, focus) {
    if (i === series && !first) return;
    series = i;
    tabs.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    panel.setAttribute('aria-labelledby', tabs[i].id);
    if (focus) tabs[i].focus();
    placeThumb(true);
    render(true);
  }

  tabs.forEach((b, i) => b.addEventListener('click', () => select(i)));
  tablist.addEventListener('keydown', (e) => {
    const n = tabs.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((series + 1) % n, true); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select((series - 1 + n) % n, true); }
    if (e.key === 'Home') { e.preventDefault(); select(0, true); }
    if (e.key === 'End') { e.preventDefault(); select(n - 1, true); }
  });
  let timer;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { query = norm(q.value); render(true); }, 90); });
  more.addEventListener('click', () => {
    expanded = !expanded;
    render(!expanded ? false : true);
    if (!expanded) root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
  addEventListener('resize', () => placeThumb(false), { passive: true });

  // включаем витрину: таблицы без JS прячем (остаются в разметке для поисковиков)
  stat.hidden = true;
  ui.hidden = false;
  placeThumb(false);
  render(false);
}
