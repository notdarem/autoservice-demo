/* =====================================================================
   core/motion.js — движок анимаций. anime.js v4 (локально, vendor/).
   Характер движения — из CSS-переменных темы (themes/<id>/theme.css).

   Правила:
   - анимируем только transform / opacity / clip-path / filter;
   - прячем перед появлением только то, что СЕЙЧАС за пределами экрана
     (класс .m-pre ставится по первому ответу IntersectionObserver —
     без принудительных замеров) — контент никогда не скрыт до запуска JS;
   - anime.js грузится лениво: когда первая группа подъезжает к экрану
     (или при первой прокрутке) — первая отрисовка с ним не конкурирует;
   - motion: lite — anime.js не грузится вообще, только WAAPI;
   - prefers-reduced-motion → ничего не делаем, всё уже в финале;
   - счётчики восстанавливают исходный текст из источника.
   Первый экран анимирует CSS (core.css); здесь — его счётчики.
   ===================================================================== */
const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const level = html.dataset.motion || 'full';

const css = getComputedStyle(html);
const ms = (v, def) => { const s = (v || '').trim(); const n = parseFloat(s); return Number.isFinite(n) ? (s.endsWith('ms') ? n : s.endsWith('s') ? n * 1000 : n) : def; };
export const P = {
  dur: ms(css.getPropertyValue('--m-dur'), 300),
  durL: ms(css.getPropertyValue('--m-dur-l'), 450),
  shift: parseFloat(css.getPropertyValue('--m-shift')) || 20,
  stagger: ms(css.getPropertyValue('--m-stagger'), 60),
  blur: parseFloat(css.getPropertyValue('--m-blur')) || 0,
  ease: (css.getPropertyValue('--m-ease-js') || 'out(3)').trim(),
  easeCss: (css.getPropertyValue('--m-ease') || 'ease-out').trim()
};

/* ---------- ленивый anime.js ---------- */
let A = null, loading = null;
export function getA() {
  if (A) return Promise.resolve(A);
  if (level !== 'full') return Promise.resolve(null);
  return (loading ||= import('./vendor/anime.esm.min.js?v=fl093q').then((m) => (A = m)).catch(() => null));
}

/* ---------- наблюдатель: первый ответ = «за экраном или нет» ---------- */
export function watch(el, { onOff, onIn, margin = '0px 0px -12% 0px' }) {
  if (!('IntersectionObserver' in window)) return;
  let first = true;
  const io = new IntersectionObserver(([e]) => {
    if (first) { first = false; if (e.isIntersecting) { io.disconnect(); return; } onOff && onOff(); return; }
    if (e.isIntersecting) { io.disconnect(); onIn(); }
  /* верхняя граница зоны наблюдения поднята «в бесконечность»: элемент, который пролистали быстрее,
     чем сработал наблюдатель (он уже выше экрана), тоже считается показанным — ничего не остаётся скрытым */
  }, { rootMargin: ['100000px', ...margin.split(' ').slice(1)].join(' ') });
  io.observe(el);
}
export function once(el, cb, margin) {
  watch(el, { onIn: () => cb(el), margin });
}

/* Появление группы при прокрутке: контейнер → дети каскадом */
/* ПК («шикарный» режим): широкий экран + мышь + движение разрешено. Телефон и планшет — облегчённый. */
export const FX = matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;

/* Маска (clip-path) отсекает и область нажатия: пока блок раскрывается, по нему нельзя попасть.
   Поэтому маской раскрываются только блоки без кнопок/ссылок/полей, а интерактивные — сдвигом
   и прозрачностью (прозрачный элемент остаётся нажимаемым). */
const INTERACTIVE = 'a[href], button, summary, input, select, textarea, [tabindex]';
const hasInteractive = (el) => el.matches(INTERACTIVE) || !!el.querySelector(INTERACTIVE);

export function reveal(container, childSel, opts = {}) {
  const els = () => (childSel ? [...container.querySelectorAll(childSel)] : [container]);
  const clip = FX && !els().some(hasInteractive);
  const pre = clip ? 'm-clip' : 'm-pre';
  watch(container, {
    onOff: () => els().forEach((el) => el.classList.add(pre)),
    onIn: () => getA().then((An) => {
      const list = els();
      if (!list.length) return;
      const shift = opts.shift != null ? opts.shift : P.shift;
      list.forEach((el) => el.classList.remove(pre));
      if (FX) {
        /* ПК: блок раскрывается маской снизу вверх и чуть поднимается — не «проявляется» прозрачностью.
           Отрицательные поля маски в конце не срезают тени и выносные элементы.
           Блоки с кнопками и ссылками — длинный мягкий подъём с прозрачностью (нажимаются сразу). */
        const dur = Math.max(opts.duration || P.durL, 760);
        const gap = Math.max(opts.stagger || P.stagger, 70);
        const lift = Math.max(shift, 18) * 1.4;
        list.forEach((el, i) => el.animate(clip
          ? [{ clipPath: 'inset(100% -4% -12% -4%)', transform: `translateY(${lift}px)` }, { clipPath: 'inset(-12% -4% -12% -4%)', transform: 'none' }]
          : [{ opacity: 0, transform: `translateY(${lift}px) scale(.985)` }, { opacity: 1, transform: 'none' }],
        { duration: dur, delay: i * gap, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
        return;
      }
      if (An) {
        An.animate(list, {
          opacity: [0, 1], y: [shift, 0], ...(P.blur ? { filter: [`blur(${P.blur}px)`, 'blur(0px)'] } : {}),
          duration: opts.duration || P.durL, ease: P.ease, delay: An.stagger(opts.stagger || P.stagger),
          onComplete: () => list.forEach((el) => { el.style.transform = ''; el.style.filter = ''; el.style.opacity = ''; })
        });
      } else {
        list.forEach((el, i) => el.animate(
          [{ opacity: 0, transform: `translateY(${shift / 2}px)` }, { opacity: 1, transform: 'none' }],
          { duration: P.dur, delay: i * (P.stagger / 2), easing: 'ease-out', fill: 'backwards' }));
      }
    })
  });
}

/* ---------- счётчики: лёгкий твин на rAF, финал — исходный текст ---------- */
const locale = () => (html.lang === 'kk' ? 'kk-KZ' : 'ru-RU');
/* Дёшево для главного потока: все счётчики идут в одном цикле; размеры снимаются одним проходом
   (без чередования «прочитал — записал»); на время счёта у цифры зафиксирована ширина — «0» → «412»
   не сдвигает соседей; текст меняется не чаще ~20 раз в секунду и только когда изменилась сама строка. */
const queue = [];
let active = [], ticking = false;
export function counter(el) {
  const target = parseFloat(el.dataset.count);
  if (!Number.isFinite(target) || target <= 0) return;
  const dec = +(el.dataset.dec || 0);
  queue.push({ el, target, finalText: el.dataset.text || el.textContent, last: '', fmt: new Intl.NumberFormat(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec }) });
  if (queue.length === 1) requestAnimationFrame(startBatch);
}
function startBatch(now) {
  const batch = queue.splice(0);
  const boxes = batch.map((c) => c.el.getBoundingClientRect());                    // чтение — одним проходом
  batch.forEach((c, i) => {                                                         // запись — одним проходом
    c.t0 = now; c.css = c.el.style.cssText;
    c.el.style.cssText += `;display:inline-block;min-width:${boxes[i].width}px;white-space:nowrap`;
  });
  active.push(...batch);
  if (!ticking) { ticking = true; requestAnimationFrame(tick); }
}
let lastPaint = 0;
function tick(now) {
  const dur = Math.max(900, P.durL * 2);
  if (now - lastPaint >= 48 || active.some((c) => now - c.t0 >= dur)) {
    lastPaint = now;
    active = active.filter((c) => {
      const k = Math.min(1, (now - c.t0) / dur);
      if (k >= 1) { c.el.textContent = c.finalText; c.el.style.cssText = c.css; return false; }
      const s = c.fmt.format(c.target * (1 - (1 - k) ** 3)); // outCubic
      if (s !== c.last) { c.last = s; c.el.textContent = s; }
      return true;
    });
  }
  if (active.length) requestAnimationFrame(tick); else ticking = false;
}
function counters() {
  document.querySelectorAll('.hero [data-count], .plats [data-count]').forEach((el) => {
    if (el.closest('.hero')) counter(el); else once(el, counter);
  });
}

/* Фолбэк для браузеров без CSS scroll-driven animations: деталь прорисовывается один раз */
function marksFallback() {
  if (CSS.supports('animation-timeline: view()')) return;
  document.querySelectorAll('.mark').forEach((m) => watch(m, {
    onOff: () => { m.style.clipPath = 'inset(0 100% 0 0)'; },
    onIn: () => {
      const a = m.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: P.durL * 2, easing: 'ease-in-out' });
      m.style.clipPath = '';
      return a;
    }
  }));
}

/* Видеофон первого экрана: после load, не на мобильных, не при Save-Data */
function heroVideo() {
  const box = document.querySelector('.hero__video[data-video]');
  if (!box) return;
  const c = navigator.connection;
  if ((c && (c.saveData || /2g/.test(c.effectiveType || ''))) || !matchMedia('(min-width: 1024px) and (pointer: fine)').matches) return;
  const v = document.createElement('video');
  Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.src = box.dataset.video;
  box.append(v);
}

/* «Магнитные» кнопки (только ПК): кнопка мягко тянется к курсору на 6–8 px. Двигается CSS-свойством
   translate (не transform — его заняли эффекты наведения), отпускает пружинно (transition в core.css). */
function magnetic() {
  if (!FX) return;
  document.querySelectorAll('.btn, .mlink, .mbar__call').forEach((el) => {
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.translate = `${(dx * 8).toFixed(1)}px ${(dy * 6).toFixed(1)}px`;
      });
    });
    el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); el.style.translate = ''; });
  });
}

/* Общие группы появления — для всех ниш */
const GROUPS = [
  ['.sec__head', null],
  ['.plats', '.plat'],
  ['.rvs', '.rv'],
  ['.mosaic', '.mosaic__item'],
  ['.more', '.more__i'],
  ['.faq', '.faq__i'],
  ['.reach', '.reach__phones, .reach__msg'],
  ['.locs', '.loc__card'],
  ['.pnotes', '.pnote']
];

const nicheHooks = [];
export function register(fn) { nicheHooks.push(fn); }
const api = { P, FX, once, watch, reveal, counter, getA, get A() { return A; }, level };

function start() {
  if (reduce) return;
  GROUPS.forEach(([sel, child]) => document.querySelectorAll(sel).forEach((c) => reveal(c, child)));
  for (const fn of nicheHooks) { try { fn(api); } catch (e) { console.error('[motion]', e); } }
  counters();
  marksFallback();
  heroVideo();
  magnetic();
  // подогрев anime.js при первой прокрутке, в простое
  if (level === 'full') addEventListener('scroll', () => idle(getA), { once: true, passive: true });
  addEventListener('beforeprint', () => document.querySelectorAll('.m-pre, .m-clip').forEach((el) => el.classList.remove('m-pre', 'm-clip')));
}

/* старт после загрузки и в простое: моушн не конкурирует с первой отрисовкой.
   Первый экран к этому моменту уже доиграл CSS-анимацию. */
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(() => fn(), { timeout: 1200 }) : setTimeout(fn, 200));
const afterLoad = (fn) => (document.readyState === 'complete' ? idle(fn) : addEventListener('load', () => idle(fn), { once: true }));
queueMicrotask(() => afterLoad(() => (html.classList.contains('is-ready') ? start() : addEventListener('site:ready', start, { once: true }))));
