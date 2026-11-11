/* =====================================================================
   core/render.js — рендер страницы из модели сайта (js/data.js).
   Один и тот же модуль работает:
   - в Node: tools/prerender.mjs пишет статичный index.html;
   - в браузере: js/main.js перерисовывает страницу, если data.js
     поменяли руками и prerender не запускали (хэш не совпал).
   Никаких фактов здесь нет: всё берётся из модели, пустое не выводится.
   ===================================================================== */

import { esc, pad, hash, tpl, plural } from './util.js';
import { DAYS, fmtTime, nowIn, hoursStatus, hoursSummary, dayText } from './hours.js';
export { esc, hash, tpl, plural, DAYS, fmtTime, nowIn, hoursStatus, hoursSummary };
const has = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length);

/* логотип студии (Re:Vyve) для плашки демо — рисуется цветом текста */
const STUDIO_LOGO = '<svg class="studio-logo" viewBox="0 0 1453 125" role="img" aria-label="Re:Vyve" focusable="false"><path fill="currentColor" d="M1288,100 1288,117 1452,117 1452,100ZM516,83 516,111 547,111 548,110 548,84 547,83ZM1288,50 1288,66 1450,66 1451,67 1452,66 1452,50ZM267,50 268,51 268,115 267,116 443,116 443,99 285,99 284,98 284,67 285,66 443,66 443,49 268,49ZM516,15 516,41 547,41 548,40 548,15ZM1288,1 1288,18 1451,18 1452,17 1452,1ZM1052,1 1053,4 1105,67 1108,72 1113,77 1120,87 1132,101 1134,105 1149,123 1152,121 1174,93 1180,87 1189,75 1226,32 1229,27 1251,2 1251,1 1229,1 1171,71 1155,92 1149,97 1144,92 1114,53 1105,43 1073,1ZM883,122 906,122 924,102 929,98 966,58 1002,22 1021,1 998,1 936,65 928,59 872,2 870,1 846,1 923,77 923,79ZM607,0 610,5 624,20 670,75 709,124 710,124 749,76 813,1 789,1 777,17 763,33 760,38 749,50 712,96 709,98 664,44 630,0ZM267,0 268,1 268,15 267,16 443,16 443,0ZM0,0 0,119 18,119 18,113 19,112 19,107 18,106 18,68 19,67 19,63 18,62 18,49 19,48 18,22 20,16 160,16 168,19 173,24 175,28 175,37 167,46 162,48 54,48 62,54 70,58 107,82 115,86 152,110 168,119 198,119 173,104 168,100 155,93 134,79 126,75 113,66 114,65 159,65 160,64 166,64 172,62 184,55 192,45 195,36 195,29 190,16 188,13 180,6 172,2 165,1 164,0Z"/></svg>';

/* ---------- иконки: один спрайт, одна толщина линии ---------- */
const ICONS = {
  phone: '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  whatsapp: '<path d="M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a5 5 0 0 1-2.2-2.2l.8-1-1-2z"/>',
  telegram: '<path d="M21 4L3 11l6 2.5M21 4l-3 16-9-6.5M21 4L9 13.5v5l3-3"/>',
  max: '<path d="M12 3.5a8.5 8.5 0 1 1-4.2 15.9L4 20.5l1.1-3.6A8.5 8.5 0 0 1 12 3.5z"/><path d="M8.5 14.5V10l3.5 3 3.5-3v4.5"/>',
  vk: '<path d="M3 7c.5 6 3.5 10 9 10h1v-3.5c2 .2 3.4 1.6 4 3.5h3c-.8-2.8-2.8-4.5-4-5 1.3-.8 3-2.8 3.5-5h-2.8c-.6 2-2.2 3.8-3.7 4V7h-2.8v7c-1.7-.4-3.6-2.6-3.7-7z"/>',
  viber: '<path d="M6 3.5h12A2.5 2.5 0 0 1 20.5 6v8a2.5 2.5 0 0 1-2.5 2.5h-6l-4 3.5v-3.5H6A2.5 2.5 0 0 1 3.5 14V6A2.5 2.5 0 0 1 6 3.5z"/><path d="M13 7.5a2.5 2.5 0 0 1 2.5 2.5"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  pin: '<path d="M12 21s-6.5-5.5-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.5 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  route: '<path d="M5 20v-6a4 4 0 0 1 4-4h10M15 6l4 4-4 4"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8 6.9 19.5l1-5.7-4.1-4 5.7-.8z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  no: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  parking: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
  waiting: '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5V6M11.5 3.5V6"/>',
  presence: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  payment: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
  tow: '<path d="M3 6.5h11v9H3zM14 10h4l3 3v2.5h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  wifi: '<path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.5a4 4 0 0 1 6 0M12 19.5v.01"/>',
  storage: '<path d="M4 7.5l8-4 8 4v9l-8 4-8-4zM4 7.5l8 4 8-4M12 11.5v9"/>',
  wash: '<path d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z"/>',
  other: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v.01M12 11v5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  map: '<path d="M3.5 6.5l5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2zM8.5 4.5v13M15.5 7v13"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>'
};
export const sprite = () => `<svg xmlns="http://www.w3.org/2000/svg" class="sprite" aria-hidden="true" focusable="false"><defs>${
  Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('')
}<filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="11" result="n"/><feGaussianBlur in="n" stdDeviation="3" result="s"/><feDisplacementMap in="SourceGraphic" in2="s" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>`;
export const icon = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${ICONS[name] ? name : 'other'}"/></svg>`;

/* ---------- создание рендерера под язык ---------- */
export function createRenderer(model, lang, nicheFactory) {
  const d = Object.assign({}, model.i18n[lang] || model.i18n[model.lang[0]]);
  const variantDict = (d._variants || {})[model.meta.variant] || {};
  Object.assign(d, variantDict);
  const contentLang = model.meta.contentLang || 'ru';
  const locale = d._locale || 'ru-RU';

  const t = (key, vars) => tpl(d[key] != null ? d[key] : key, vars);
  /* текст бизнеса: строка или {o: оригинал, kk: перевод} */
  const raw = (v) => (v && typeof v === 'object' ? (v[lang] || v.o || '') : (v || ''));
  const isOrig = (v) => !(v && typeof v === 'object' && v[lang]);
  const tx = (v) => {
    const s = esc(raw(v));
    if (!s) return '';
    return lang !== contentLang && isOrig(v) ? `<span lang="${contentLang}">${s}</span>` : s;
  };
  const num = (n, dec = 0) => new Intl.NumberFormat(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
  const plat = (p) => t('pl_' + p);
  const platName = (p) => t('pl_name_' + p);
  const ratingsN = (n) => plural(d.ratings_n, n, lang).replace(String(n), num(n));

  const pic = (img, o = {}) => {
    if (!img) return '';
    const a = (o.alt != null ? o.alt : raw(img.alt)) || '';
    const sizes = o.sizes || '100vw';
    return `<picture${o.cls ? ` class="${o.cls}"` : ''}>${img.avif ? `<source type="image/avif" srcset="${esc(img.avif)}" sizes="${sizes}">` : ''}${img.webp ? `<source type="image/webp" srcset="${esc(img.webp)}" sizes="${sizes}">` : ''}<img src="${esc(img.src)}" width="${img.w}" height="${img.h}" alt="${esc(a)}"${o.priority ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"'}></picture>`;
  };

  const phone0 = model.phones[0];
  const msgs = model.messengers;
  const primary = msgs.find((m) => m.type === model.primary) || msgs[0];

  const btnCall = (cls = '') => phone0 ? `<a class="btn btn--call${cls}" href="tel:${esc(phone0.tel)}">${icon('phone')}<span class="btn__t">${t('call')}</span><span class="btn__sub">${esc(phone0.display)}</span></a>` : '';
  const btnMsg = (m, cls = '') => m ? `<a class="btn btn--ghost${cls}" href="${esc(m.url)}" target="_blank" rel="noopener">${icon(m.type)}<span class="btn__t">${t('write_' + m.type)}</span></a>` : '';
  const msgLinks = (cls = 'mlink') => msgs.map((m) => `<li><a class="${cls}" href="${esc(m.url)}" target="_blank" rel="noopener">${icon(m.type)}<span>${t('m_' + m.type)}</span></a></li>`).join('');

  const mark = (cls = '') => `<div class="mark${cls ? ' ' + cls : ''}" aria-hidden="true"><span class="mark__line"></span></div>`;

  /* ---------- общие блоки ---------- */
  const B = {};

  B.hero = (m) => {
    const loc = m.locations[0];
    const heroFacts = m.facts.filter((f) => f.hero).slice(0, 3);
    const trust = m.ratings.map((r) => `<li><a class="trust__item" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="trust__score"><span class="vh">${esc(t('rating_word'))} </span><span data-count="${r.rating}" data-dec="1">${num(r.rating, 1)}</span><span class="vh"> ${esc(t('rating_of5'))}</span></span>${icon('star', 'trust__star')}<span class="trust__meta">${r.count ? `<span data-count="${r.count}">${num(r.count)}</span>${esc(ratingsN(r.count).replace(num(r.count), ''))} ` : ''}${esc(t('rating_on', { platform: plat(r.platform) }))}</span></a></li>`).join('');
    const facts = heroFacts.map((f) => `<div class="fact"><dt class="fact__label">${tx(f.label)}</dt><dd class="fact__fig"${f.count != null ? ` data-count="${f.count}" data-text="${esc(raw(f.figure))}"` : ''}>${tx(f.figure)}</dd></div>`).join('');
    const where = [m.biz.category ? tx(m.biz.category) : '', esc(lang === 'ru' ? m.meta.cityIn : m.meta.city)].filter(Boolean).join(' ');
    const addr = loc ? `<p class="hero__addr">${icon('pin')}<span>${tx(loc.address)}</span>${loc.hours ? `<span class="hero__hours">${icon('clock')}<span>${esc(hoursSummary(loc.hours, d))}</span></span>` : ''}</p>` : '';
    /* режим первого экрана (решает сборщик по разрешению фото): photo | weak | type */
    const mode = m.heroMode || (m.hero ? 'photo' : 'type');
    const chip = loc && loc.hours ? `<p class="status status--chip" data-status="0" hidden></p>` : '';
    const cap = m.hero && m.hero.caption ? `<figcaption class="hero__cap">${tx(m.hero.caption)}</figcaption>` : '';
    const photo = mode === 'photo' && m.hero
      ? `<figure class="hero__media panel">${m.heroVideo ? `<div class="hero__video" data-video="${esc(m.heroVideo)}"></div>` : ''}${pic(m.hero, { priority: true, sizes: '(min-width: 1024px) 80vw, 100vw', cls: 'hero__pic' })}${chip}${cap}<span class="hero__wipe" aria-hidden="true"></span></figure>`
      : mode === 'weak' && m.hero
        ? `<figure class="hero__media hero__media--weak panel">${m.heroBlur ? `<img class="hero__blur" src="${esc(m.heroBlur.src)}" width="${m.heroBlur.w}" height="${m.heroBlur.h}" alt="" decoding="async">` : ''}<span class="hero__frame">${pic(m.hero, { priority: true, sizes: '(min-width: 1024px) 30vw, 72vw', cls: 'hero__pic' })}</span>${chip}${cap}<span class="hero__wipe" aria-hidden="true"></span></figure>`
        : '';
    const extra = N.heroExtra ? N.heroExtra(m) : '';
    return `<section class="hero hero--${mode}${photo ? '' : ' hero--nophoto'}${photo && m.heroTone ? ' hero--tone-' + m.heroTone : ''}" id="hero" aria-labelledby="h1">
<div class="wrap hero__grid">
<div class="hero__text">
<div class="hero__card">
<h1 id="h1" class="hero__title"><span class="hero__name">${tx(m.biz.name)}</span>${where ? `<span class="hero__what">${where}</span>` : ''}</h1>
${trust ? `<ul class="trust" aria-label="${esc(t('sec_reviews'))}">${trust}</ul>` : ''}
${extra}
<div class="cta">${btnCall()}${btnMsg(primary)}</div>
</div>
<div class="hero__more">
${m.biz.description ? `<p class="hero__desc">${tx(m.biz.description)}</p>` : ''}
${addr}
${!m.hero && loc && loc.hours ? `<p class="status status--line" data-status="0" hidden></p>` : ''}
${facts ? `<dl class="facts">${facts}</dl>` : ''}
</div>
</div>
${photo}
</div>
${mark('mark--hero')}
</section>`;
  };

  B.prices = (m) => {
    if (!m.prices.length) return null;
    const cats = m.prices.map((c, ci) => `<details class="pcat card" open data-cat="${ci}">
<summary class="pcat__sum"><h3 class="pcat__name">${tx(c.category)}</h3><span class="pcat__n tag">${c.items.length}</span>${icon('chevron', 'pcat__chev')}</summary>
${c.note ? `<p class="pcat__note">${tx(c.note)}</p>` : ''}
<ul class="plist">${c.items.map((it) => `<li class="prow"><span class="prow__name">${tx(it.name)}${it.note ? `<small class="prow__note">${tx(it.note)}</small>` : ''}${it.duration ? `<small class="prow__dur"><span class="vh">${esc(t('duration'))}: </span>${tx(it.duration)}</small>` : ''}</span><span class="prow__lead" aria-hidden="true"></span><strong class="prow__price">${tx(it.price)}</strong></li>`).join('')}</ul>
</details>`).join('');
    const notes = m.priceNotes.map((n) => `<div class="pnote pnote--${n.kind} card"><h3 class="pnote__t">${esc(t('price_' + n.kind))}</h3><p>${tx(n.text)}</p></div>`).join('');
    return { title: t('sec_prices'), nav: t('sec_prices_nav'), body: `<div class="prices">${cats}</div>${notes ? `<div class="pnotes">${notes}</div>` : ''}` };
  };

  B.works = (m) => {
    if (!m.portfolio.length) return null;
    const types = [...new Set(m.portfolio.map((p) => raw(p.type)).filter(Boolean))];
    const filter = types.length > 1 && types.some((ty) => m.portfolio.filter((p) => raw(p.type) === ty).length > 1)
      ? `<div class="filter" role="group" aria-label="${esc(t('filter_label'))}" hidden><button type="button" class="chip" aria-pressed="true" data-filter="">${esc(t('filter_all'))}</button>${types.map((ty) => `<button type="button" class="chip" aria-pressed="false" data-filter="${esc(ty)}">${esc(ty)}</button>`).join('')}</div>` : '';
    const items = m.portfolio.map((p, i) => {
      const cap = raw(p.caption);
      const label = t('open_photo', { caption: cap || t('photo_n', { n: i + 1, total: m.portfolio.length }) });
      const alt = raw(p.alt) || cap;
      const sizes = i === 0 ? '(min-width: 1024px) 66vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw';
      const media = p.before
        ? `<span class="ba"><span class="ba__half ba__half--before">${pic(p.before, { alt: '', sizes })}<span class="ba__tag tag">${esc(t('before'))}</span></span> <span class="ba__half ba__half--after">${pic(p.img, { alt: '', sizes })}<span class="ba__tag tag">${esc(t('after'))}</span></span></span>`
        : pic(p.img, { alt: '', sizes });
      const href = p.before ? p.before.lg : p.img.lg;
      return `<li class="mosaic__item${i === 0 ? ' is-big' : ''}" data-type="${esc(raw(p.type))}"><a class="mosaic__link panel" href="${esc(href)}" data-lb="${i}"><span class="vh">${esc(label)}${alt && alt !== cap ? '. ' + esc(alt) : ''} </span>${media}</a>${cap ? `<p class="mosaic__cap">${tx(p.caption)}</p>` : ''}</li>`;
    }).join('');
    return { title: t('sec_works'), nav: t('sec_works_nav'), body: `${filter}<ul class="mosaic" data-count="${m.portfolio.length}">${items}</ul>` };
  };

  const stars = (r) => `<span class="stars" role="img" aria-label="${esc(t('stars', { n: num(r, r % 1 ? 1 : 0) }))}"><span class="stars__bg">${icon('star').repeat(5)}</span><span class="stars__fg" style="width:${Math.round((r / 5) * 100)}%">${icon('star').repeat(5)}</span></span>`;

  B.reviews = (m) => {
    if (!m.reviews.length && !m.ratings.length) return null;
    const plats = m.ratings.map((r) => `<li class="plat card"><p class="plat__score"><span data-count="${r.rating}" data-dec="1">${num(r.rating, 1)}</span>${stars(r.rating)}</p><p class="plat__meta">${r.count ? esc(ratingsN(r.count)) + ' ' : ''}${esc(t('rating_on', { platform: plat(r.platform) }))}</p><a class="plat__link" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(t('all_reviews_on', { platform: plat(r.platform) }))}</a></li>`).join('');
    const rv = m.reviews.slice(0, 6).map((r, i) => `<figure class="rv${i === 0 ? ' rv--lead' : ' card'}"><blockquote class="rv__q"><p>${tx(r.text)}</p></blockquote><figcaption class="rv__by"><span class="rv__author">${tx(r.author)}</span><span class="rv__src">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(platName(r.platform))}</a>` : esc(platName(r.platform))}, ${tx(r.date)}</span>${r.rating ? stars(r.rating) : ''}</figcaption></figure>`).join('');
    return { title: t('sec_reviews'), nav: t('sec_reviews_nav'), body: `${plats ? `<ul class="plats">${plats}</ul>` : ''}${rv ? `<div class="rvs">${rv}</div>` : ''}` };
  };

  B.more = (m) => {
    const rest = m.facts.filter((f) => !f.hero || m.facts.filter((x) => x.hero).indexOf(f) > 2);
    if (!rest.length) return null;
    return { title: t('sec_more'), body: `<dl class="more">${rest.map((f) => `<div class="more__i"><dt>${tx(f.figure)}</dt><dd>${tx(f.label)}</dd></div>`).join('')}</dl>` };
  };

  B.faq = (m) => {
    if (!m.faq.length) return null;
    return { title: t('sec_faq'), body: `<div class="faq card">${m.faq.map((f) => `<details class="faq__i"><summary class="faq__q"><span>${tx(f.q)}</span>${icon('chevron', 'faq__chev')}</summary><div class="faq__a"><p>${tx(f.a)}</p></div></details>`).join('')}</div>` };
  };

  const ymaps = ['RU', 'KZ', 'BY', 'UZ', 'KG'].includes(m0().meta.country);
  function m0() { return model; }
  const routeUrl = (l) => ymaps
    ? (l.geo ? `https://yandex.ru/maps/?rtext=~${l.geo.lat},${l.geo.lng}&rtt=auto` : `https://yandex.ru/maps/?text=${encodeURIComponent(raw(l.address))}`)
    : (l.geo ? `https://www.google.com/maps/dir/?api=1&destination=${l.geo.lat},${l.geo.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw(l.address))}`);
  const mapOpen = (l) => ymaps
    ? `https://yandex.ru/maps/?pt=${l.geo.lng},${l.geo.lat}&z=16&l=map`
    : `https://www.google.com/maps/search/?api=1&query=${l.geo.lat},${l.geo.lng}`;
  const mapEmbed = (l) => ymaps
    ? `https://yandex.ru/map-widget/v1/?ll=${l.geo.lng},${l.geo.lat}&z=16&pt=${l.geo.lng},${l.geo.lat},pm2rdm`
    : `https://www.google.com/maps?q=${l.geo.lat},${l.geo.lng}&z=16&output=embed`;

  B.contacts = (m) => {
    if (!m.locations.length && !m.phones.length) return null;
    const multi = m.locations.length > 1;
    const tabs = multi ? `<div class="loc__tabs" data-tabs hidden>${m.locations.map((l, i) => `<button type="button" class="loc__tab" id="loc-tab-${i}" data-tab="${i}">${tx(l.name || l.address)}</button>`).join('')}</div>` : '';
    const cards = m.locations.map((l, i) => {
      const rows = [
        l.district ? `<div><dt>${esc(t('address'))}</dt><dd>${tx(l.address)}<span class="loc__district">${tx(l.district)}</span></dd></div>` : `<div><dt>${esc(t('address'))}</dt><dd>${tx(l.address)}</dd></div>`,
        l.landmark ? `<div><dt>${esc(t('landmark'))}</dt><dd>${tx(l.landmark)}</dd></div>` : '',
        l.metro ? `<div><dt>${esc(t('transit'))}</dt><dd>${tx(l.metro)}</dd></div>` : '',
        l.phone ? `<div><dt>${esc(t('phones'))}</dt><dd><a class="tel" href="tel:${esc(l.phone.tel)}">${esc(l.phone.display)}</a></dd></div>` : ''
      ].join('');
      const hours = l.hours ? `<div class="hours"><h4 class="hours__t">${esc(t('hours'))}</h4><p class="status status--line" data-status="${i}" hidden></p><table class="hours__tb"><tbody>${l.hours.map((iv, di) => `<tr data-day="${di}"><th scope="row">${esc(d.days_full[di])}</th><td>${esc(dayText(iv, d))}</td></tr>`).join('')}</tbody></table></div>` : '';
      const map = l.geo ? `<div class="map panel" data-map="${esc(mapEmbed(l))}" data-map-title="${esc(t('map_title', { address: raw(l.address) }))}">${l.mapImg ? pic(l.mapImg, { alt: '', sizes: '(min-width:1024px) 40vw, 100vw', cls: 'map__img' }) : `<span class="map__art" aria-hidden="true">${icon('pin', 'map__pin')}</span>`}<a class="btn btn--ghost map__btn" href="${esc(mapOpen(l))}" target="_blank" rel="noopener">${icon('map')}<span class="btn__t">${esc(t('show_map'))}</span></a><p class="map__note">${esc(t('map_note', { service: t(ymaps ? 'map_yandex' : 'map_google') }))}</p></div>` : '';
      return `<div class="loc__card card" id="loc-${i}" data-panel="${i}">
<h3 class="loc__h" id="loc-h-${i}">${tx(l.name || l.address)}</h3>
<dl class="loc__dl">${rows}</dl>
${hours}
<p class="loc__acts"><a class="btn btn--route" href="${esc(routeUrl(l))}" target="_blank" rel="noopener" aria-label="${esc(t('route_aria', { address: raw(l.address) }))}">${icon('route')}<span class="btn__t">${esc(t('route'))}</span></a></p>
${map}
</div>`;
    }).join('');
    const reach = `<div class="reach">
${m.phones.length ? `<div class="reach__phones"><h3 class="vh">${esc(t('phones'))}</h3><ul>${m.phones.map((p) => `<li><a class="reach__tel" href="tel:${esc(p.tel)}">${esc(p.display)}</a>${p.label ? `<span class="reach__lbl">${tx(p.label)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
${msgs.length || m.email ? `<div class="reach__msg"><h3 class="vh">${esc(t('messengers'))}</h3><ul class="mlinks">${msgLinks()}${m.email ? `<li><a class="mlink" href="mailto:${esc(raw(m.email))}">${icon('mail')}<span>${tx(m.email)}</span></a></li>` : ''}</ul></div>` : ''}
</div>`;
    return { title: t('sec_contacts'), nav: t('sec_contacts_nav'), body: `${reach}${tabs}<div class="locs${multi ? ' locs--multi' : ''}" data-count="${m.locations.length}">${cards}</div>` };
  };

  /* ---------- ниша ---------- */
  const H = { esc, t, tx, raw, num, icon, pic, mark, plural, tpl, hoursSummary: (h) => hoursSummary(h, d), d, lang, locale, model, B, btnCall, btnMsg, stars };
  const N = nicheFactory ? nicheFactory(H) : { order: ['hero', 'prices', 'works', 'reviews', 'more', 'faq', 'contacts'], blocks: {} };
  const blockFn = (id) => (N.blocks && N.blocks[id]) || B[id];

  /* ---------- сборка страницы ---------- */
  function sections() {
    const out = [];
    for (const id of N.order) {
      if (id === 'hero') continue;
      const fn = blockFn(id);
      const r = fn ? fn(model) : null;
      if (r) out.push({ id, ...r });
    }
    return out;
  }

  function header(secs) {
    const prio = N.nav || secs.map((s) => s.id);
    const pick = prio.map((id) => secs.find((s) => s.id === id && s.nav)).filter(Boolean).slice(0, 5);
    const navItems = secs.filter((s) => pick.includes(s)).map((s) => `<li><a href="#s-${s.id}">${esc(s.nav)}</a></li>`).join('');
    const langs = model.lang.length > 1 ? `<div class="lang" role="group" aria-label="${esc(t('lang_switch'))}">${model.lang.map((L) => {
      const dd = model.i18n[L];
      const href = L === model.lang[0] ? 'index.html' : `index.${L}.html`;
      return L === lang ? `<span class="lang__i is-on" lang="${L}" aria-current="true">${esc(dd._lang_short)}</span>` : `<a class="lang__i" href="${href}" hreflang="${L}" lang="${L}" aria-label="${esc(dd._lang_short + ' — ' + dd._lang_name)}">${esc(dd._lang_short)}</a>`;
    }).join('')}</div>` : '';
    const logo = model.logo ? `<img class="hdr__logo-img" src="${esc(model.logo.src)}" width="${model.logo.w}" height="${model.logo.h}" alt="">` : '';
    return `<header class="hdr" data-hdr>
${model.meta.demo ? `<div class="hdr__demo"><p class="wrap"><span class="hdr__demo-t">${esc(t('demo_banner', { name: raw(model.biz.name) }))}</span><span class="hdr__demo-by">${esc(t('demo_by'))}${STUDIO_LOGO}</span></p></div>` : ''}
<div class="hdr__bar wrap">
<a class="hdr__logo" href="#top">${logo}<span>${tx(model.biz.name)}</span></a>
${navItems ? `<nav class="hdr__nav" aria-label="${esc(t('nav_label'))}"><ul>${navItems}</ul></nav>` : ''}
${langs}
${phone0 ? `<a class="hdr__phone" href="tel:${esc(phone0.tel)}">${esc(phone0.display)}</a><a class="btn btn--call btn--sm hdr__call" href="tel:${esc(phone0.tel)}" aria-label="${esc(t('call_to', { phone: phone0.display }))}">${icon('phone')}<span class="btn__t">${t('call')}</span></a>` : ''}
${navItems ? `<details class="hdr__menu"><summary class="hdr__menu-btn" aria-label="${esc(t('menu'))}">${icon('menu')}</summary><nav class="hdr__drawer" aria-label="${esc(t('nav_label'))}"><ul>${navItems}</ul></nav></details>` : ''}
</div>
</header>`;
  }

  function section(s, i) {
    const no = String(i + 1).padStart(2, '0');
    return `<section class="sec sec--${s.id}${s.cls ? ' ' + s.cls : ''}" id="s-${s.id}" aria-labelledby="h-${s.id}">
<div class="wrap">
<header class="sec__head" data-no="${no}"><p class="sec__no" aria-hidden="true"><span>${no}</span>${s.nav ? ' — ' + esc(s.nav) : ''}</p><h2 class="sec__title" id="h-${s.id}">${esc(s.title)}</h2>${s.lead ? `<p class="sec__lead">${s.lead}</p>` : ''}</header>
${s.body}
</div>
</section>`;
  }

  function footer() {
    const loc = model.locations[0];
    return `<footer class="ftr">
${mark('mark--ftr')}
<div class="wrap ftr__grid">
<p class="ftr__name">${tx(model.biz.name)}</p>
${phone0 ? `<p class="ftr__tel"><a href="tel:${esc(phone0.tel)}">${esc(phone0.display)}</a></p>` : ''}
${loc ? `<p class="ftr__addr">${tx(loc.address)}</p>` : ''}
${model.biz.legal ? `<p class="ftr__legal">${tx(model.biz.legal)}</p>` : ''}
<p class="ftr__copy">${esc(t('footer_rights', { year: model.meta.year, name: raw(model.biz.name) }))}</p>
${model.meta.demo ? `<p class="ftr__demo">${esc(t('demo_note'))}</p>` : ''}
<p class="ftr__top"><a href="#top">${icon('up')}<span>${esc(t('footer_top'))}</span></a></p>
</div>
</footer>`;
  }

  function mobileBar() {
    if (!phone0 && !msgs.length) return '';
    return `<nav class="mbar" aria-label="${esc(t('mobile_bar'))}" data-mbar>
${phone0 ? `<a class="mbar__call" href="tel:${esc(phone0.tel)}">${icon('phone')}<span>${t('call')}</span></a>` : ''}
${msgs.slice(0, 3).map((m) => `<a class="mbar__msg" href="${esc(m.url)}" target="_blank" rel="noopener" aria-label="${esc(t('write_' + m.type))}">${icon(m.type)}</a>`).join('')}
</nav>`;
  }

  function lightbox() {
    if (!model.portfolio.length) return '';
    return `<dialog class="lb" aria-label="${esc(t('lb_label'))}" data-lb-dialog>
<div class="lb__stage"><img class="lb__img" alt="" data-lb-img></div>
<p class="lb__cap" data-lb-cap aria-live="polite"></p>
<button type="button" class="lb__btn lb__prev" data-lb-prev aria-label="${esc(t('lb_prev'))}">${icon('left')}</button>
<button type="button" class="lb__btn lb__next" data-lb-next aria-label="${esc(t('lb_next'))}">${icon('right')}</button>
<button type="button" class="lb__btn lb__close" data-lb-close aria-label="${esc(t('lb_close'))}">${icon('close')}</button>
</dialog>`;
  }

  /* Слайды лайтбокса: пара до/после — два слайда подряд */
  function slides() {
    const out = [];
    model.portfolio.forEach((p, i) => {
      const cap = raw(p.caption);
      if (p.before) out.push({ i, src: p.before.lg, w: p.before.lgw, h: p.before.lgh, alt: `${raw(p.alt) || cap} — ${t('before')}`, cap: `${cap ? cap + ' — ' : ''}${t('before')}` });
      out.push({ i, src: p.img.lg, w: p.img.lgw, h: p.img.lgh, alt: p.before ? `${raw(p.alt) || cap} — ${t('after')}` : (raw(p.alt) || cap), cap: p.before ? `${cap ? cap + ' — ' : ''}${t('after')}` : cap });
    });
    return out;
  }

  function body() {
    const secs = sections();
    return `${sprite()}
<a class="skip" href="#main">${esc(t('skip'))}</a>
${header(secs)}
<main id="main" tabindex="-1">
${B.hero(model)}
${secs.map(section).join('\n')}
</main>
${footer()}
${mobileBar()}
${lightbox()}`;
  }

  /* ---------- SEO ---------- */
  function seo() {
    const loc = model.locations[0];
    const vars = {
      name: raw(model.biz.name),
      category: (raw(model.biz.category) || '').split(',')[0].trim().toLowerCase(),
      city_in: model.meta.cityIn, city: model.meta.city,
      address: loc ? raw(loc.address) : '',
      hours: loc && loc.hours ? hoursSummary(loc.hours, d) : '',
      phone: phone0 ? phone0.display : ''
    };
    const title = tpl(model.prices.length ? d.seo_title_prices : d.seo_title, vars).replace(/\s+—\s+$/, '');
    const desc = tpl(d.seo_desc, vars).replace(/(\.\s*){2,}/g, '. ').replace(/\s+Телефон\s*\.$/, '').replace(/^\s*[.,]\s*/, '');
    return { title, desc: desc.charAt(0).toUpperCase() + desc.slice(1) };
  }

  function jsonLd() {
    const L = model.locations;
    const toSpec = (hours) => hours.flatMap((iv, di) => iv.map(([s, e]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][di], opens: `${pad(Math.floor(s / 60))}:${pad(s % 60)}`, closes: e >= 1440 ? '23:59' : `${pad(Math.floor(e / 60))}:${pad(e % 60)}` })));
    const place = (l) => ({
      address: { '@type': 'PostalAddress', streetAddress: raw(l.address), addressLocality: model.meta.city, addressCountry: model.meta.country },
      ...(l.geo ? { geo: { '@type': 'GeoCoordinates', latitude: l.geo.lat, longitude: l.geo.lng } } : {}),
      ...(l.hours ? { openingHoursSpecification: toSpec(l.hours) } : {})
    });
    const best = [...model.ratings].sort((a, b) => (b.count || 0) - (a.count || 0))[0];
    const url = model.meta.siteUrl || undefined;
    const main = {
      '@context': 'https://schema.org',
      '@type': N.ldType || 'LocalBusiness',
      name: raw(model.biz.name),
      ...(model.biz.description ? { description: raw(model.biz.description) } : {}),
      ...(url ? { url } : {}),
      ...(phone0 ? { telephone: phone0.tel } : {}),
      ...(model.hero ? { image: url ? new URL(model.hero.src, url).href : model.hero.src } : {}),
      ...(L[0] ? place(L[0]) : {}),
      ...(best && best.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: best.rating, reviewCount: best.count, bestRating: 5 } } : {}),
      ...(model.meta.currency ? { currenciesAccepted: model.meta.currency } : {}),
      ...(L.length > 1 ? { department: L.slice(1).map((l) => ({ '@type': N.ldType || 'LocalBusiness', name: `${raw(model.biz.name)} — ${raw(l.name || l.address)}`, ...(l.phone ? { telephone: l.phone.tel } : {}), ...place(l) })) } : {}),
      sameAs: [...model.messengers.map((m) => m.url).filter((u) => /^https?:/.test(u)), ...model.ratings.map((r) => r.url)]
    };
    const out = [main];
    if (model.faq.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: model.faq.map((f) => ({ '@type': 'Question', name: raw(f.q), acceptedAnswer: { '@type': 'Answer', text: raw(f.a) } })) });
    return JSON.stringify(out).replace(/</g, '\\u003c');
  }

  /* для отчёта сборщика: какие блоки выведены и какие скрыты */
  function blocksReport() {
    return N.order.map((id) => {
      if (id === 'hero') return { id, shown: true };
      const fn = blockFn(id);
      return { id, shown: !!(fn && fn(model)), ask: (N.ask && N.ask[id]) || null };
    });
  }

  return { body, seo, jsonLd, slides, blocksReport, niche: N, t, d, lang };
}
