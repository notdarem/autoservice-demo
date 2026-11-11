/* =====================================================================
   niches/auto/motion.js — движение автосервиса.
   В готовом сайте лежит как js/niche-motion.js рядом с js/motion.js,
   поэтому импорт относительный './motion.js?v=fl093q' (в исходниках не запускается).
   Характер (быстро/с ударом для street, плавно для premium) — из темы.
   ===================================================================== */
import { register } from './motion.js?v=fl093q';

register(({ P, FX, reveal, watch, getA }) => {
  const $$ = (s) => [...document.querySelectorAll(s)];
  const punchy = P.durL < 500; // street — «удар», premium — мягко

  /* марки, удобства, мастера, гарантия — каскадом */
  $$('.makes').forEach((c) => reveal(c, '.makes__list li, .chips li, .nolist li', { stagger: P.stagger * 0.6 }));
  $$('.amen').forEach((c) => reveal(c, '.amen__i'));
  $$('.team').forEach((c) => reveal(c, '.person'));
  $$('.wlist').forEach((c) => reveal(c, '.wlist__i'));

  /* витрина прайса по сериям раскрывается целиком; её статичные таблицы (для режима без JS) не трогаем:
     они скрыты, наблюдатель за ними не сработает, и строки остались бы помеченными «ждут появления» */
  $$('[data-series-ui]').forEach((ui) => reveal(ui, null));
  /* прайс-доска: строки «ложатся» на доску при первом показе категории */
  $$('.pcat').filter((c) => !c.closest('[data-series-static]')).forEach((cat) => {
    reveal(cat, '.prow', { stagger: P.stagger * 0.5, shift: P.shift * 0.5, duration: P.dur * 1.4 });
    cat.addEventListener('toggle', () => {
      if (!cat.open) return;
      getA().then((A) => A && A.animate(cat.querySelectorAll('.prow'), { opacity: [0, 1], x: [-8, 0], duration: P.dur, ease: 'outQuad', delay: A.stagger(25) }));
    });
  });

  /* визит: шаги «встают» на линию по очереди */
  const steps = document.querySelector('.steps');
  if (steps) reveal(steps, '.step', { stagger: P.stagger * 2 });

  /* штамп гарантии: удар (street) или мягкое проявление (premium) */
  const stamp = document.querySelector('.stamp');
  if (stamp) watch(stamp, {
    margin: '0px 0px -25% 0px',
    onOff: () => stamp.classList.add('m-pre'),
    onIn: () => getA().then((A) => {
      stamp.classList.remove('m-pre');
      if (!A) return;
      A.animate(stamp, {
        opacity: [0, 1], scale: [punchy ? 1.7 : 1.08, 1], rotate: [punchy ? -24 : -4, -8],
        duration: punchy ? 420 : P.durL * 1.2, ease: P.ease,
        onComplete: () => { stamp.style.transform = ''; stamp.style.opacity = ''; }
      });
    })
  });

  /* визит-история (только ПК): фото слева закреплено, при прокрутке сменяется кадр того шага,
     который сейчас в середине экрана. Скролл не перехватывается — просто следим за положением шагов. */
  const story = document.querySelector('.story');
  if (story && FX && 'IntersectionObserver' in window) {
    const frames = [...story.querySelectorAll('[data-frame]')];
    const stepsEl = [...story.querySelectorAll('.step')];
    const activate = (i) => {
      stepsEl.forEach((s) => s.classList.toggle('is-active', +s.dataset.step === i));
      frames.forEach((f) => f.classList.toggle('is-on', +f.dataset.frame === i));
    };
    story.classList.add('is-live');
    activate(0);
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) activate(+e.target.dataset.step); }), { rootMargin: '-45% 0px -45% 0px' });
    stepsEl.forEach((s) => io.observe(s));
  }
});
