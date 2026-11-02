/* =====================================================================
   motion.js — три точечных эффекта на anime.js v4. Больше нигде.
   Финальное состояние всегда задано в CSS/HTML: если этот файл не
   загрузился, сайт выглядит готовым. Анимация только «доезжает».
   ===================================================================== */
import { animate, stagger, utils } from './vendor/anime.esm.min.js';

const html = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (v, d) => d
  ? utils.round(v, d).toFixed(d).replace('.', ',')
  : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function once(el, cb, opts) {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } });
  }, opts || { rootMargin: '0px 0px -10% 0px' });
  io.observe(el);
}

/* 1) Счётчик рейтинга и числа оценок в полосе под первым экраном.
   Числа — из config.js (ratings[i].value / .count). Пусто → не запускаем. */
function counters(cfg) {
  const ratings = Array.isArray(cfg.ratings) ? cfg.ratings : [];
  const els = [...document.querySelectorAll('.strip [data-count]')];
  const jobs = els.map((el) => {
    const [i, key] = el.dataset.count.split('.');
    const target = Number(ratings[+i] && ratings[+i][key]);
    return Number.isFinite(target) && target > 0 ? { el, target, d: +(el.dataset.decimals || 0) } : null;
  }).filter(Boolean);
  if (!jobs.length) return;
  const hero = document.querySelector('.strip');
  const run = () => jobs.forEach(({ el, target, d }) => {
    const o = { v: 0 };
    el.textContent = fmt(0, d);
    animate(o, {
      v: target, duration: 1100, ease: 'outCubic',
      onUpdate: () => { el.textContent = fmt(o.v, d); },
      onComplete: () => { el.textContent = fmt(target, d); }
    });
  });
  // первый экран обычно уже виден — запускаем сразу
  const r = hero.getBoundingClientRect();
  if (r.top < innerHeight && r.bottom > 0) run(); else once(hero, run, { threshold: 0.2 });
}

/* 2) Каскад строк прайс-доски при первом показе категории */
function priceRows() {
  document.querySelectorAll('.pcat').forEach((cat) => {
    let done = false;
    const play = () => {
      if (done || !cat.open) return;
      done = true;
      animate(cat.querySelectorAll('.prow'), {
        opacity: [0, 1], y: [10, 0], duration: 320, ease: 'outQuad', delay: stagger(45)
      });
    };
    once(cat, play, { rootMargin: '0px 0px -15% 0px' });
    cat.addEventListener('toggle', play);
  });
}

/* 3) Фирменная деталь: линия техпроцесса прорисовывается слева направо,
   шаг за шагом; красный отрезок «контроля» — тоже. Один раз. */
function stepsLine() {
  const lines = document.querySelectorAll('.steps__line');
  if (!lines.length) return;
  once(lines[0].closest('.steps'), () => {
    animate(lines, { scaleX: [0, 1], duration: 420, ease: 'inOutQuad', delay: stagger(140) });
  }, { rootMargin: '0px 0px -15% 0px' });
}

function start() {
  const cfg = window.SITE_CONFIG;
  if (reduce || !cfg) return; // reduced-motion: ничего не делаем, всё уже в финальном виде
  counters(cfg);
  priceRows();
  stepsLine();
}

if (html.classList.contains('is-ready')) start();
else window.addEventListener('site:ready', start, { once: true });
