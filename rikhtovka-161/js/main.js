/* =====================================================================
   main.js — рендер сайта из config.js + поведение страницы.
   Без зависимостей. Тот же файл использует tools/prerender.mjs в Node,
   поэтому функции рендера возвращают строки HTML и не трогают DOM.
   ===================================================================== */
(function (root) {
  'use strict';

  /* ---------------- утилиты ---------------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function has(v) {
    if (v === undefined || v === null || v === false) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }
  function arr(a) { return Array.isArray(a) ? a.filter(function (x) { return x !== null && x !== undefined && x !== ''; }) : []; }
  function ic(name, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>'; }
  var NB = ' ';
  function fmtInt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function fmtDec(n, d) { return Number(n).toFixed(d).replace('.', ','); }
  function plural(n, f) {
    n = Math.abs(n) % 100; var n1 = n % 10;
    if (n > 10 && n < 20) return f[2];
    if (n1 > 1 && n1 < 5) return f[1];
    if (n1 === 1) return f[0];
    return f[2];
  }
  function telHref(cfg) { return cfg.phone && has(cfg.phone.tel) ? 'tel:' + cfg.phone.tel.replace(/[^\d+]/g, '') : ''; }
  function msgs(cfg) { return arr(cfg.messengers).filter(function (m) { return m && has(m.url); }); }
  var MSG_ICON = { telegram: 'tg', whatsapp: 'wa', viber: 'viber', vk: 'chat', max: 'chat' };
  function msgIcon(m) { return MSG_ICON[m.type] || 'chat'; }
  function extAttrs(url) { return /^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ''; }

  /* картинка: o = {src, srcset, width, height, alt} */
  function img(o, opt) {
    if (!o || !has(o.src)) return '';
    opt = opt || {};
    var a = '<img src="' + esc(o.src) + '"';
    if (has(o.srcset)) a += ' srcset="' + esc(o.srcset) + '" sizes="' + esc(opt.sizes || '100vw') + '"';
    if (o.width) a += ' width="' + o.width + '"';
    if (o.height) a += ' height="' + o.height + '"';
    a += ' alt="' + esc(o.alt || '') + '"';
    if (opt.priority) a += ' fetchpriority="high" decoding="async"';
    else a += ' loading="lazy" decoding="async"';
    if (opt.cls) a += ' class="' + opt.cls + '"';
    return a + '>';
  }

  /* djb2 — для проверки, совпадает ли пререндер с текущим конфигом */
  function hash(cfg) {
    var s = JSON.stringify(cfg), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  var DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var DAYS_FULL = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];
  function parseHours(s) {
    var m = /^\s*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*$/.exec(s || '');
    if (!m) return null;
    var o = +m[1] * 60 + +m[2], c = +m[3] * 60 + +m[4];
    if (c <= o) c += 1440; // через полночь / круглосуточно
    return { o: o, c: c };
  }
  function hm(min) { min = ((min % 1440) + 1440) % 1440; var h = Math.floor(min / 60), m = min % 60; return h + ':' + (m < 10 ? '0' : '') + m; }
  function hoursText(s) {
    var p = parseHours(s);
    if (!p) return 'выходной';
    if (p.c - p.o >= 1440) return 'круглосуточно';
    return hm(p.o) + '–' + (p.c === 1440 ? '24:00' : hm(p.c));
  }

  /* ---------------- порядок секций и номера ---------------- */
  var SECTIONS = [
    ['cars', 'Машины'], ['prices', 'Цены'], ['process', 'Техпроцесс'], ['warranty', 'Гарантия'],
    ['team', 'Мастер'], ['works', 'Разборы'], ['reviews', 'Отзывы'], ['amenities', 'На месте'],
    ['faq', 'Вопросы'], ['contacts', 'Контакты']
  ];
  function sectionExists(cfg, id) {
    switch (id) {
      case 'cars': return cfg.cars && (has(arr(cfg.cars.makes)) || has(arr(cfg.cars.types)) || has(arr(cfg.cars.notDo)));
      case 'prices': return cfg.prices && arr(cfg.prices.categories).some(function (c) { return arr(c.items).length; });
      case 'process': return arr(cfg.process).filter(function (s) { return has(s.title); }).length > 0;
      case 'warranty': var w = cfg.warranty || {}; return has(w.term) || has(arr(w.covers)) || has(arr(w.docs)) || has(w.ownParts);
      case 'team': return arr(cfg.team).filter(function (p) { return has(p.name); }).length > 0;
      case 'works': return arr(cfg.works).filter(function (w) { return w.after && has(w.after.src); }).length > 0;
      case 'reviews': return arr(cfg.reviews).filter(function (r) { return has(r.text); }).length > 0 || arr(cfg.ratings).some(function (r) { return has(r.value); });
      case 'amenities': return amenGroups(cfg).length > 0;
      case 'faq': return faqItems(cfg).length > 0;
      case 'contacts': return arr(cfg.locations).filter(function (l) { return has(l.address); }).length > 0;
    }
    return false;
  }
  function numbering(cfg) {
    var map = {}, n = 0;
    SECTIONS.forEach(function (s) { if (sectionExists(cfg, s[0])) { n++; map[s[0]] = (n < 10 ? '0' : '') + n + ' — ' + s[1]; } });
    return map;
  }
  function head(ctx, id, title, extra) {
    return '<header class="sec__head">' +
      '<p class="sec-num">' + esc(ctx.num[id]) + '</p>' +
      '<h2 class="h2" id="' + id + '-h">' + esc(title) + '</h2>' + (extra || '') + '</header>';
  }
  function faqItems(cfg) { return arr(cfg.faq).filter(function (f) { return f && has(f.q) && has(f.a); }); }

  /* ---------------- блоки ---------------- */
  var R = {};

  R.demo = function (cfg) {
    if (!cfg.demo) return '';
    return '<div class="demo" role="note">Демо-версия сайта · данные тестовые</div>';
  };

  R.header = function (cfg, ctx) {
    var tel = telHref(cfg);
    var links = [['prices', 'Цены'], ['works', 'Разборы'], ['process', 'Как работаем'], ['reviews', 'Отзывы'], ['contacts', 'Контакты']]
      .filter(function (l) { return ctx.num[l[0]]; });
    var h = '<header class="hdr" id="top"><div class="wrap hdr__in">';
    var lg = cfg.logo && has(cfg.logo.src) ? '<img class="hdr__mark" src="' + esc(cfg.logo.src) + '" width="' + (cfg.logo.width || '') + '" height="' + (cfg.logo.height || '') + '" alt="">' : '';
    h += '<a class="hdr__logo" href="#top">' + lg + '<span>' + esc(cfg.name) + '</span></a>';
    if (links.length) {
      h += '<nav class="hdr__nav" id="nav" aria-label="Разделы сайта"><ul>' +
        links.map(function (l) { return '<li><a href="#' + l[0] + '">' + l[1] + '</a></li>'; }).join('') + '</ul></nav>';
    }
    if (tel) {
      h += '<a class="hdr__phone num" href="' + tel + '">' + esc(cfg.phone.display) + '</a>';
      h += '<a class="btn btn--accent hdr__call" href="' + tel + '">' + ic('phone') + '<span>Позвонить</span></a>';
    }
    if (links.length) {
      h += '<button class="hdr__burger" type="button" aria-expanded="false" aria-controls="nav" aria-label="Открыть меню">' +
        ic('menu', 'i--open') + ic('close', 'i--close') + '</button>';
    }
    return h + '</div></header>';
  };

  function ratingsList(cfg) { return arr(cfg.ratings).filter(function (r) { return has(r.value); }); }

  R.hero = function (cfg) {
    var hr = cfg.hero || {};
    if (!has(hr.offer)) return '';
    var tel = telHref(cfg), ms = msgs(cfg), hasPrices = !!(cfg.prices && arr(cfg.prices.categories).some(function (c) { return arr(c.items).length; }));
    var h = '<section class="hero" aria-labelledby="hero-h">';
    if (hr.photo && has(hr.photo.src)) h += '<figure class="hero__bg">' + img(hr.photo, { priority: true, sizes: '100vw' }) + '</figure>';
    h += '<div class="wrap hero__in">';
    if (has(hr.tag)) h += '<p class="hero__tag label num">' + esc(hr.tag) + '</p>';
    h += '<div class="hero__body">';
    if (has(hr.eyebrow)) h += '<p class="label hero__eyebrow"><span class="dot" aria-hidden="true"></span>' + esc(hr.eyebrow) + '</p>';
    h += '<h1 class="h1" id="hero-h">' + esc(hr.offer) + '</h1>';
    h += '<div class="hero__row">';
    if (has(hr.sub)) h += '<p class="hero__sub">' + esc(hr.sub) + '</p>';
    if (tel || ms.length) {
      h += '<div class="hero__cta">';
      if (tel) h += '<a class="btn btn--accent btn--lg" href="' + tel + '">' + ic('phone') + '<span>Позвонить <span class="num nowrap">' + esc(cfg.phone.display) + '</span></span></a>';
      if (ms.length) h += '<a class="btn btn--line btn--lg" href="' + esc(ms[0].url) + '"' + extAttrs(ms[0].url) + '>' + ic(msgIcon(ms[0])) + '<span>Написать в ' + esc(ms[0].labelIn || ms[0].label) + '</span></a>';
      h += '</div>';
    }
    h += '</div>';
    var foot = [];
    if (has(hr.addressLine)) foot.push('<span class="hero__addr">' + ic('pin') + '<span>' + esc(hr.addressLine) + '</span></span>');
    if (hasPrices) foot.push('<a class="link" href="#prices">Цены на работы' + ic('arrow', 'i--down') + '</a>');
    if (foot.length) h += '<p class="hero__foot">' + foot.join('') + '</p>';
    h += '</div>';
    if (hr.photo && has(hr.photo.caption)) h += '<p class="hero__cap cap">' + esc(hr.photo.caption) + '</p>';
    return h + '</div></section>';
  };

  R.strip = function (cfg) {
    var hr = cfg.hero || {}, items = [];
    var r0 = ratingsList(cfg)[0];
    if (r0) {
      var i = arr(cfg.ratings).indexOf(r0);
      var lab = esc(r0.name) + (has(r0.count) ? ', <span class="num" data-count="' + i + '.count">' + fmtInt(r0.count) + '</span> ' + plural(r0.count, ['оценка', 'оценки', 'оценок']) : '');
      var val = '<b class="num" data-count="' + i + '.value" data-decimals="1">' + fmtDec(r0.value, 1) + '</b>';
      items.push('<li>' + (has(r0.url) ? '<a href="' + esc(r0.url) + '"' + extAttrs(r0.url) + '>' + val + '<span>' + lab + '</span></a>' : val + '<span>' + lab + '</span>') + '</li>');
    }
    arr(hr.facts).filter(function (f) { return has(f.value); }).slice(0, r0 ? 3 : 4).forEach(function (f) {
      items.push('<li><b class="num">' + esc(f.value) + '</b>' + (has(f.label) ? '<span>' + esc(f.label) + '</span>' : '') + '</li>');
    });
    if (!items.length) return '';
    return '<section class="strip" aria-label="Коротко о сервисе"><ul class="wrap strip__list">' + items.join('') + '</ul></section>';
  };

  R.cars = function (cfg, ctx) {
    if (!ctx.num.cars) return '';
    var c = cfg.cars, makes = arr(c.makes), types = arr(c.types), no = arr(c.notDo);
    var h = '<section class="sec cars" id="cars" aria-labelledby="cars-h"><div class="wrap">';
    h += head(ctx, 'cars', 'Какие машины берём');
    h += '<div class="cars__grid' + (no.length ? '' : ' cars__grid--solo') + '"><div class="cars__yes">';
    if (makes.length) h += '<p class="cars__makes">' + makes.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join(' <i aria-hidden="true">/</i> ') + '</p>';
    if (types.length) h += '<ul class="cars__types">' + types.map(function (t) { return '<li>' + ic('check') + esc(t) + '</li>'; }).join('') + '</ul>';
    if (has(c.note)) h += '<p class="muted">' + esc(c.note) + '</p>';
    h += '</div>';
    if (no.length) {
      h += '<div class="cars__no"><h3 class="h3">Не делаем</h3><ul>' +
        no.map(function (t) { return '<li>' + ic('x') + '<span>' + esc(t) + '</span></li>'; }).join('') +
        '</ul></div>';
    }
    return h + '</div></div></section>';
  };

  function priceText(it) {
    if (has(it.priceText)) return esc(it.priceText);
    if (typeof it.price === 'number') return (it.from ? 'от' + NB : '') + fmtInt(it.price) + NB + '₽';
    if (has(it.price)) return (it.from ? 'от' + NB : '') + esc(it.price);
    return '';
  }

  R.prices = function (cfg, ctx) {
    if (!ctx.num.prices) return '';
    var p = cfg.prices;
    var cats = arr(p.categories).filter(function (c) { return arr(c.items).length; });
    var all = []; cats.forEach(function (c) { all = all.concat(arr(c.items)); });
    var anyTime = all.some(function (it) { return has(it.time); }), anyPrice = all.some(function (it) { return priceText(it) !== ''; });
    var h = '<section class="sec prices" id="prices" aria-labelledby="prices-h"><div class="wrap">';
    h += head(ctx, 'prices', 'Сколько стоит', (has(p.caption) ? '<p class="muted sec__note">' + esc(p.caption) + '</p>' : ''));
    if (p.approximate) h += '<p class="notice">' + ic('info') + '<span>' + esc(p.approximateText || 'Цены ориентировочные — точную сумму называем после осмотра.') + '</span></p>';
    h += '<div class="prices__board' + (anyTime ? '' : ' no-time') + (anyPrice ? '' : ' no-price') + '">';
    h += '<div class="phead label" aria-hidden="true"><span>Поз.</span><span>Работа</span>' + (anyTime ? '<span>Время</span>' : '') + (anyPrice ? '<span>Цена</span>' : '') + '</div>';
    h += cats.map(function (c, ci) {
      var items = arr(c.items).filter(function (it) { return has(it.name); });
      return '<details class="pcat" open><summary><h3 class="h3">' + esc(c.name) + '</h3>' +
        '<span class="pcat__count">' + items.length + ' ' + plural(items.length, ['позиция', 'позиции', 'позиций']) + '</span>' + ic('chevron', 'pcat__chev') + '</summary>' +
        '<ul class="plist">' + items.map(function (it, ii) {
          return '<li class="prow"><span class="prow__pos num">' + (ci + 1) + '.' + (ii + 1) + '</span>' +
            '<span class="prow__name">' + esc(it.name) + (has(it.note) ? '<small>' + esc(it.note) + '</small>' : '') + '</span>' +
            (anyTime ? '<span class="prow__time num">' + (has(it.time) ? esc(it.time) : '') + '</span>' : '') +
            (anyPrice ? (priceText(it) !== '' ? '<span class="prow__price num">' + priceText(it) + '</span>' : '<span class="prow__price prow__price--ask">по звонку</span>') : '') + '</li>';
        }).join('') + '</ul></details>';
    }).join('');
    h += '</div>';
    var inc = arr(p.included);
    if (inc.length || has(p.changes)) {
      h += '<div class="prices__terms">';
      if (inc.length) h += '<div><h3 class="label">Что входит в цену</h3>' + inc.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>';
      if (has(p.changes)) h += '<div><h3 class="label">Когда цена меняется</h3><p>' + esc(p.changes) + '</p></div>';
      h += '</div>';
    }
    return h + '</div></section>';
  };
  R.process = function (cfg, ctx) {
    if (!ctx.num.process) return '';
    var steps = arr(cfg.process).filter(function (s) { return has(s.title); }).slice(0, 6);
    return '<section class="sec process" id="process" aria-labelledby="process-h"><div class="wrap">' +
      head(ctx, 'process', 'От звонка до выдачи') +
      '<ol class="steps steps--' + steps.length + '">' + steps.map(function (s, i) {
        var n = (i + 1 < 10 ? '0' : '') + (i + 1);
        return '<li' + (s.control ? ' class="is-control"' : '') + '><span class="steps__line" aria-hidden="true"></span><span class="steps__n num">' + n + (s.control ? ' · контроль' : '') + '</span><h3 class="h3">' + esc(s.title) + '</h3>' +
          (has(s.text) ? '<p>' + esc(s.text) + '</p>' : '') + '</li>';
      }).join('') + '</ol></div></section>';
  };

  R.warranty = function (cfg, ctx) {
    if (!ctx.num.warranty) return '';
    var w = cfg.warranty, covers = arr(w.covers), docs = arr(w.docs);
    var h = '<section class="sec warranty" id="warranty" aria-labelledby="warranty-h"><div class="wrap">';
    h += head(ctx, 'warranty', 'Если что-то пойдёт не так');
    h += '<div class="warranty__grid">';
    if (has(w.term)) {
      h += '<div class="warranty__term"><p class="warranty__big num">' + esc(w.term) + '</p><p class="warranty__unit">' + esc(w.unit || '') + ' гарантии</p>' +
        (has(w.termNote) ? '<p class="muted">' + esc(w.termNote) + '</p>' : '') + '</div>';
    }
    h += '<div class="warranty__lists">';
    if (covers.length) h += '<div><h3 class="label">На что распространяется</h3><ul class="ticks">' + covers.map(function (t) { return '<li>' + ic('check') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>';
    if (docs.length) h += '<div><h3 class="label">Что даём на руки</h3><ul class="ticks">' + docs.map(function (t) { return '<li>' + ic('doc') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>';
    if (has(w.ownParts)) h += '<div class="warranty__own"><h3 class="label">Со своими запчастями</h3><p>' + esc(w.ownParts) + '</p></div>';
    h += '</div></div></div></section>';
    return h;
  };

  R.team = function (cfg, ctx) {
    if (!ctx.num.team) return '';
    var t = arr(cfg.team).filter(function (p) { return has(p.name); });
    return '<section class="sec team" id="team" aria-labelledby="team-h"><div class="wrap">' +
      head(ctx, 'team', 'Кто будет чинить') +
      '<div class="team__list team__list--' + Math.min(t.length, 3) + '">' + t.map(function (p) {
        var meta = [p.role, p.years].filter(has).map(esc).join(' · ');
        return '<figure class="person">' +
          (p.photo && has(p.photo.src) ? '<div class="person__ph">' + img(p.photo, { sizes: '(min-width: 768px) 40vw, 100vw' }) + '</div>' : '') +
          '<figcaption>' + (has(p.quote) ? '<blockquote class="person__q"><p>' + esc(p.quote) + '</p></blockquote>' : '') +
          '<p class="person__name">' + esc(p.name) + '</p>' + (meta ? '<p class="muted">' + meta + '</p>' : '') + '</figcaption></figure>';
      }).join('') + '</div></div></section>';
  };

  R.works = function (cfg, ctx) {
    if (!ctx.num.works) return '';
    var ws = arr(cfg.works).filter(function (w) { return w.after && has(w.after.src); });
    var lead = ws[0], rest = ws.slice(1);
    var h = '<section class="sec works" id="works" aria-labelledby="works-h"><div class="wrap">';
    h += head(ctx, 'works', 'Разборы работ');
    var pair = lead.before && has(lead.before.src);
    h += '<div class="case">';
    h += '<div class="case__top"><h3 class="h3 case__t">' + esc([lead.car, lead.problem].filter(has).join(': ')) + '</h3>' +
      '<span class="muted num">Работа 1 из ' + ws.length + (has(lead.date) ? ' · ' + esc(lead.date) : '') + '</span></div>';
    h += '<div class="case__grid">';
    if (pair) h += '<figure class="case__fig"><a class="work__img" href="' + esc(lead.before.src) + '" data-work="0">' + img(lead.before, { sizes: '(min-width: 1024px) 33vw, 100vw' }) + '<span class="work__tag">До</span></a></figure>';
    h += '<figure class="case__fig"><a class="work__img" href="' + esc(lead.after.src) + '" data-work="0" aria-label="Открыть фото: ' + esc(lead.car || 'работа') + '">' + img(lead.after, { sizes: '(min-width: 1024px) 33vw, 100vw' }) + '<span class="work__tag work__tag--on">После</span></a></figure>';
    var rows = [['Машина', lead.car], ['Жалоба', lead.problem], ['Сделали', lead.done], ['Время', lead.time]].filter(function (r) { return has(r[1]); });
    h += '<dl class="case__dl num">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
    h += '</div></div>';
    if (rest.length) {
      h += '<ul class="mosaic">' + rest.map(function (w, k) {
        var i = k + 1, line = [w.time, w.date].filter(has).map(esc).join(' · ');
        return '<li class="work reveal"><a class="work__img" href="' + esc(w.after.src) + '" data-work="' + i + '" aria-label="Открыть фото: ' + esc(w.car || 'работа ' + (i + 1)) + '">' +
          img(w.after, { sizes: '(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw' }) +
          (w.before && has(w.before.src) ? '<span class="work__tag">до / после</span>' : '') + '</a>' +
          '<div class="cap work__cap">' + (has(w.car) ? '<b>' + esc(w.car) + '</b>' : '') +
          (has(w.problem) ? '<span>Было: ' + esc(w.problem) + '</span>' : '') +
          (has(w.done) ? '<span>Сделали: ' + esc(w.done) + '</span>' : '') +
          (line ? '<span class="num">' + line + '</span>' : '') + '</div></li>';
      }).join('') + '</ul>';
    }
    return h + '</div></section>';
  };

  R.reviews = function (cfg, ctx) {
    if (!ctx.num.reviews) return '';
    var rs = ratingsList(cfg);
    var items = arr(cfg.reviews).filter(function (r) { return has(r.text); }).slice(0, 6);
    var h = '<section class="sec reviews" id="reviews" aria-labelledby="reviews-h"><div class="wrap">';
    h += head(ctx, 'reviews', 'Что говорят те, кто уже был');
    if (rs.length) {
      h += '<ul class="rstrip">' + rs.map(function (r) {
        var inner = '<span class="rstrip__name">' + esc(r.name) + '</span><b class="num rstrip__val">' + fmtDec(r.value, 1) + '</b>' +
          (has(r.count) ? '<span class="muted num">' + fmtInt(r.count) + ' ' + plural(r.count, ['оценка', 'оценки', 'оценок']) + '</span>' : '');
        if (has(r.url)) inner += '<a class="link" href="' + esc(r.url) + '"' + extAttrs(r.url) + '>Все отзывы ' + esc(r.nameIn || '') + ic('arrow') + '</a>';
        return '<li>' + inner + '</li>';
      }).join('') + '</ul>';
    }
    if (items.length) {
      h += '<div class="quotes">' + items.map(function (r) {
        var short = r.text.length < 60;
        var meta = [r.name, r.car].filter(has).map(esc).join(', ');
        var src = [r.source, r.date].filter(has).map(esc).join(', ');
        return '<figure class="quote reveal' + (short ? ' quote--short' : '') + '"><blockquote><p>' + esc(r.text) + '</p></blockquote>' +
          '<figcaption><b>' + meta + '</b>' + (src ? '<span class="muted">' + src + '</span>' : '') + '</figcaption></figure>';
      }).join('') + '</div>';
    }
    return h + '</div></section>';
  };

  /* amenities: группы { group, items: [{ icon, title, text }] } или старый плоский список { icon, text } */
  function amenGroups(cfg) {
    var src = arr(cfg.amenities), out = [], flat = [];
    src.forEach(function (x) {
      if (x && Array.isArray(x.items)) {
        var it = x.items.filter(function (i) { return i && (has(i.title) || has(i.text)); });
        if (it.length) out.push({ group: x.group || '', items: it });
      } else if (x && (has(x.title) || has(x.text))) flat.push(x);
    });
    if (flat.length) out.push({ group: '', items: flat });
    return out;
  }

  R.amenities = function (cfg, ctx) {
    if (!ctx.num.amenities) return '';
    var g = amenGroups(cfg);
    return '<section class="sec amen" id="amenities" aria-labelledby="amenities-h"><div class="wrap">' +
      head(ctx, 'amenities', has(cfg.amenitiesTitle) ? cfg.amenitiesTitle : 'Что есть в сервисе') +
      '<div class="amen__groups">' + g.map(function (grp) {
        return '<div class="amen__grp">' + (has(grp.group) ? '<h3 class="amen__h">' + esc(grp.group) + '</h3>' : '') +
          '<ul class="amen__list">' + grp.items.map(function (x) {
            var t = has(x.title) ? x.title : x.text, d = has(x.title) && has(x.text) ? x.text : '';
            return '<li>' + ic(x.icon || 'check') + '<div><b class="amen__t">' + esc(t) + '</b>' + (d ? '<span class="amen__d">' + esc(d) + '</span>' : '') + '</div></li>';
          }).join('') + '</ul></div>';
      }).join('') + '</div></div></section>';
  };

  R.faq = function (cfg, ctx) {
    if (!ctx.num.faq) return '';
    return '<section class="sec faq" id="faq" aria-labelledby="faq-h"><div class="wrap faq__wrap">' +
      head(ctx, 'faq', 'Частые вопросы') +
      '<div class="faq__list">' + faqItems(cfg).map(function (f) {
        return '<details class="qa"><summary>' + esc(f.q) + ic('plus', 'qa__ic') + '</summary><p>' + esc(f.a) + '</p></details>';
      }).join('') + '</div></div></section>';
  };

  function routeUrl(l) { return l.coords && l.coords.length === 2 ? 'https://yandex.ru/maps/?rtext=~' + l.coords[0] + '%2C' + l.coords[1] + '&rtt=auto' : ''; }

  R.contacts = function (cfg, ctx) {
    if (!ctx.num.contacts) return '';
    var locs = arr(cfg.locations).filter(function (l) { return has(l.address); });
    var multi = locs.length > 1, ms = msgs(cfg);
    var h = '<section class="sec contacts" id="contacts" aria-labelledby="contacts-h"><div class="wrap">';
    h += head(ctx, 'contacts', locs.length > 1 ? 'Как до нас добраться' : 'Как до нас добраться');
    if (multi) {
      h += '<div class="loc-tabs" role="tablist" aria-label="Адреса">' + locs.map(function (l, i) {
        return '<button type="button" role="tab" id="loc-tab-' + i + '" aria-controls="loc-' + i + '" aria-selected="' + (i === 0) + '"' + (i ? ' tabindex="-1"' : '') + '>' + esc(l.name || 'Точка ' + (i + 1)) + '</button>';
      }).join('') + '</div>';
    }
    h += '<div class="locs locs--' + Math.min(locs.length, 3) + '">' + locs.map(function (l, i) {
      var tel = has(l.phone) ? 'tel:' + l.phone.replace(/[^\d+]/g, '') : telHref(cfg);
      var phoneShow = has(l.phone) ? l.phone : (cfg.phone && cfg.phone.display);
      var hours = Array.isArray(l.hours) && l.hours.length === 7 ? l.hours : null;
      var route = routeUrl(l);
      var s = '<article class="loc' + (multi ? ' loc--multi' : '') + '" id="loc-' + i + '"' + (multi ? ' role="tabpanel" aria-labelledby="loc-tab-' + i + '"' : '') +
        ' data-hours="' + esc(hours ? hours.join('|') : '') + '">';
      s += '<div class="loc__info">';
      if (multi && has(l.name)) s += '<h3 class="h3">' + esc(l.name) + '</h3>';
      s += '<p class="loc__addr">' + esc(l.address) + '</p>';
      if (has(l.landmark)) s += '<p class="loc__line">' + ic('gate') + '<span>' + esc(l.landmark) + '</span></p>';
      if (has(l.metro)) s += '<p class="loc__line">' + ic('metro') + '<span>' + esc(l.metro) + '</span></p>';
      if (hours) {
        s += '<p class="status" data-status hidden></p>';
        s += '<table class="hours"><caption class="sr">Часы работы</caption><tbody>' + hours.map(function (x, d) {
          return '<tr data-day="' + d + '"><th scope="row">' + DAYS[d] + '</th><td class="num">' + hoursText(x) + '</td></tr>';
        }).join('') + '</tbody></table>';
      }
      s += '<div class="loc__cta">';
      if (tel) s += '<a class="btn btn--accent" href="' + tel + '">' + ic('phone') + '<span class="num">' + esc(phoneShow) + '</span></a>';
      if (route) s += '<a class="btn btn--line" href="' + route + '" target="_blank" rel="noopener">' + ic('route') + '<span>Построить маршрут</span></a>';
      s += '</div>';
      if (ms.length) s += '<ul class="msgs">' + ms.map(function (m) {
        return '<li><a href="' + esc(m.url) + '"' + extAttrs(m.url) + '>' + ic(msgIcon(m)) + '<span>' + esc(m.label) + '</span></a></li>';
      }).join('') + '</ul>';
      s += '</div>';
      if (l.coords && l.coords.length === 2) {
        s += '<div class="map" data-lat="' + l.coords[0] + '" data-lon="' + l.coords[1] + '">' +
          (l.mapImage && has(l.mapImage.src) ? img(l.mapImage, { sizes: '(min-width: 1024px) 55vw, 100vw', cls: 'map__img' }) :
            '<div class="map__ph">' + ic('pin') + '<span>' + esc(l.address) + '</span></div>') +
          '<button type="button" class="btn btn--solid map__btn">' + ic('map') + '<span>Показать карту</span></button></div>';
      }
      return s + '</article>';
    }).join('') + '</div>';
    return h + '</div></section>';
  };

  R.footer = function (cfg) {
    var lg = cfg.legal || {}, tel = telHref(cfg), year = new Date().getFullYear();
    var req = [lg.entity, has(lg.inn) ? 'ИНН ' + lg.inn : '', has(lg.ogrn) ? (String(lg.ogrn).length === 15 ? 'ОГРНИП ' : 'ОГРН ') + lg.ogrn : ''].filter(has).map(esc).join(' · ');
    return '<footer class="ftr"><div class="wrap ftr__in">' +
      '<p class="ftr__name">' + esc(cfg.nameFull || cfg.name) + (has(cfg.cityIn) ? ' ' + esc(cfg.cityIn) : '') + '</p>' +
      (tel ? '<a class="ftr__phone num" href="' + tel + '">' + esc(cfg.phone.display) + '</a>' : '') +
      (req ? '<p class="muted ftr__req">' + req + '</p>' : '') +
      '<p class="muted">© <span data-year>' + year + '</span> ' + esc(cfg.name) + '</p></div></footer>';
  };

  R.mbar = function (cfg) {
    var tel = telHref(cfg), ms = msgs(cfg);
    if (!tel && !ms.length) return '';
    return '<div class="mbar" id="mbar">' +
      (tel ? '<a class="btn btn--accent mbar__call" href="' + tel + '">' + ic('phone') + '<span>Позвонить</span></a>' : '') +
      ms.slice(0, 3).map(function (m) { return '<a class="mbar__ic" href="' + esc(m.url) + '"' + extAttrs(m.url) + ' aria-label="Написать в ' + esc(m.labelIn || m.label) + '">' + ic(msgIcon(m)) + '</a>'; }).join('') +
      '</div>';
  };

  /* ---------------- JSON-LD ---------------- */
  function jsonLd(cfg) {
    var graph = [], url = cfg.seo && cfg.seo.url;
    var r0 = ratingsList(cfg)[0];
    arr(cfg.locations).filter(function (l) { return has(l.address); }).forEach(function (l, i) {
      var o = { '@type': 'AutoRepair', '@id': (url || '') + '#loc-' + i, name: cfg.nameFull || cfg.name };
      if (cfg.logo && has(cfg.logo.src)) o.logo = (url || '') + cfg.logo.src;
      if (url) o.url = url;
      if (cfg.seo && has(cfg.seo.ogImage)) o.image = cfg.seo.ogImage;
      var tel = has(l.phone) ? l.phone : (cfg.phone && cfg.phone.tel);
      if (has(tel)) o.telephone = tel;
      o.address = { '@type': 'PostalAddress', streetAddress: l.address, addressCountry: 'RU' };
      if (has(cfg.city)) o.address.addressLocality = cfg.city;
      if (l.coords && l.coords.length === 2) o.geo = { '@type': 'GeoCoordinates', latitude: l.coords[0], longitude: l.coords[1] };
      if (Array.isArray(l.hours) && l.hours.length === 7) {
        var names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        o.openingHoursSpecification = l.hours.map(function (x, d) {
          var p = parseHours(x); if (!p) return null;
          return { '@type': 'OpeningHoursSpecification', dayOfWeek: names[d], opens: hm(p.o), closes: p.c >= 1440 ? '23:59' : hm(p.c) };
        }).filter(Boolean);
      }
      if (r0 && has(r0.count)) o.aggregateRating = { '@type': 'AggregateRating', ratingValue: r0.value, reviewCount: r0.count, bestRating: 5 };
      graph.push(o);
    });
    var fq = faqItems(cfg);
    if (fq.length) graph.push({ '@type': 'FAQPage', mainEntity: fq.map(function (f) { return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }; }) });
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1).replace(/</g, '\\u003c');
  }

  var REGIONS = ['demo', 'header', 'hero', 'strip', 'cars', 'prices', 'process', 'warranty', 'team', 'works', 'reviews', 'amenities', 'faq', 'contacts', 'footer', 'mbar'];
  function renderAll(cfg) {
    var ctx = { num: numbering(cfg) }, out = {};
    REGIONS.forEach(function (k) { out[k] = R[k](cfg, ctx); });
    out.ld = jsonLd(cfg);
    return out;
  }

  var API = { renderAll: renderAll, hash: hash, REGIONS: REGIONS, esc: esc, has: has, parseHours: parseHours, hm: hm };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.SiteRender = API;

  /* =====================================================================
     БРАУЗЕР: поведение
     ===================================================================== */
  var doc = document, html = doc.documentElement;
  var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqMobile = root.matchMedia('(max-width: 767.98px)');
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

  function applyRender(cfg) {
    var out = renderAll(cfg);
    REGIONS.forEach(function (k) {
      var el = doc.getElementById('r-' + k);
      if (el) el.innerHTML = out[k];
    });
    var ld = doc.getElementById('ld-json'); if (ld) ld.textContent = out.ld;
    var s = cfg.seo || {};
    if (has(s.title)) doc.title = s.title;
    function meta(sel, v) { var m = $(sel); if (m && has(v)) m.setAttribute('content', v); }
    meta('meta[name="description"]', s.description);
    meta('meta[property="og:title"]', s.title);
    meta('meta[property="og:description"]', s.description);
    meta('meta[property="og:url"]', s.url);
    meta('meta[property="og:image"]', s.ogImage);
    var can = $('link[rel="canonical"]'); if (can && has(s.url)) can.href = s.url;
  }

  /* ---- шапка ---- */
  function initHeader() {
    var hdr = $('.hdr'); if (!hdr) return;
    var on = false;
    function onScroll() { var v = root.scrollY > 24; if (v !== on) { on = v; hdr.classList.toggle('is-compact', v); } }
    root.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    var b = $('.hdr__burger'), nav = $('#nav');
    if (!b || !nav) return;
    function set(open) {
      b.setAttribute('aria-expanded', String(open));
      b.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      if (open) nav.style.top = Math.max(0, hdr.getBoundingClientRect().bottom) + 'px';
      html.classList.toggle('nav-open', open);
    }
    b.addEventListener('click', function () { set(b.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && html.classList.contains('nav-open')) { set(false); b.focus(); } });
  }

  /* ---- прайс: на мобильном аккордеон, открыта первая категория ---- */
  function initPrices() {
    var cats = $$('.pcat'); if (!cats.length) return;
    function apply() {
      cats.forEach(function (d, i) { d.open = mqMobile.matches ? i === 0 : true; });
    }
    apply();
    mqMobile.addEventListener && mqMobile.addEventListener('change', apply);
    // на ПК категории не сворачиваются
    cats.forEach(function (d) {
      d.querySelector('summary').addEventListener('click', function (e) { if (!mqMobile.matches) e.preventDefault(); });
    });
  }

  /* ---- часы работы: сегодня + статус ---- */
  function nowIn(tz) {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      var day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(o.weekday);
      return { day: day, min: (+o.hour % 24) * 60 + +o.minute };
    } catch (e) {
      var d = new Date(); return { day: (d.getDay() + 6) % 7, min: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function statusText(hours, now) {
    var P = hours.map(parseHours), t = now.min, d = now.day;
    var y = P[(d + 6) % 7];
    if (y && y.c > 1440 && t < y.c - 1440) return { open: true, text: 'Открыто до ' + hm(y.c) };
    var p = P[d];
    if (p && t >= p.o && t < p.c) return { open: true, text: p.c - p.o >= 1440 ? 'Открыто круглосуточно' : 'Открыто до ' + (p.c === 1440 ? '24:00' : hm(p.c)) };
    if (p && t < p.o) return { open: false, text: 'Закрыто, откроемся в ' + hm(p.o) };
    for (var k = 1; k <= 7; k++) {
      var n = P[(d + k) % 7];
      if (n) {
        var when = k === 1 ? 'завтра' : 'в ' + DAYS_FULL[(d + k) % 7];
        return { open: false, text: n.c - n.o >= 1440 ? 'Закрыто, ' + when + ' работаем круглосуточно' : 'Закрыто, откроемся ' + when + ' в ' + hm(n.o) };
      }
    }
    return null;
  }
  function initHours(cfg) {
    $$('.loc').forEach(function (loc) {
      var raw = loc.getAttribute('data-hours'); if (!raw) return;
      var hours = raw.split('|'); if (hours.length !== 7) return;
      var now = nowIn(cfg.timezone || 'Europe/Moscow');
      var row = loc.querySelector('tr[data-day="' + now.day + '"]');
      if (row) { row.classList.add('is-today'); row.querySelector('th').insertAdjacentHTML('beforeend', '<span class="sr"> (сегодня)</span>'); }
      var st = statusText(hours, now), el = loc.querySelector('[data-status]');
      if (st && el) { el.textContent = st.text; el.classList.toggle('is-open', st.open); el.hidden = false; }
    });
  }

  /* ---- табы точек ---- */
  function initTabs() {
    var tl = $('.loc-tabs'); if (!tl) return;
    var tabs = $$('[role="tab"]', tl);
    function sel(i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        var p = doc.getElementById(t.getAttribute('aria-controls')); if (p) p.classList.toggle('is-active', on);
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); sel((i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true); }
      });
    });
    html.classList.add('has-tabs');
    sel(0);
  }

  /* ---- карта по клику ---- */
  function initMaps() {
    $$('.map').forEach(function (m) {
      var b = m.querySelector('.map__btn'); if (!b) return;
      b.addEventListener('click', function () {
        var lat = m.getAttribute('data-lat'), lon = m.getAttribute('data-lon');
        var f = doc.createElement('iframe');
        f.src = 'https://yandex.ru/map-widget/v1/?ll=' + lon + '%2C' + lat + '&z=16&pt=' + lon + '%2C' + lat + '%2Cpm2rdm';
        f.title = 'Яндекс Карта'; f.loading = 'lazy'; f.allowFullscreen = true; f.className = 'map__frame';
        m.appendChild(f); m.classList.add('is-live'); b.remove(); f.focus();
      });
    });
  }

  /* ---- лайтбокс работ ---- */
  function initLightbox(cfg) {
    var links = $$('[data-work]'); if (!links.length || typeof HTMLDialogElement !== 'function') return;
    var works = arr(cfg.works).filter(function (w) { return w.after && has(w.after.src); });
    var dlg = doc.createElement('dialog');
    dlg.className = 'lb'; dlg.setAttribute('aria-label', 'Фото работы');
    dlg.innerHTML = '<div class="lb__stage"></div><div class="lb__bar"><p class="lb__cap cap"></p><p class="lb__n num"></p>' +
      '<button type="button" class="lb__btn lb__prev" aria-label="Предыдущая работа">' + ic('arrow', 'i--flip') + '</button>' +
      '<button type="button" class="lb__btn lb__next" aria-label="Следующая работа">' + ic('arrow') + '</button>' +
      '<button type="button" class="lb__btn lb__close" aria-label="Закрыть">' + ic('close') + '</button></div>';
    doc.body.appendChild(dlg);
    var stage = $('.lb__stage', dlg), cap = $('.lb__cap', dlg), cnt = $('.lb__n', dlg), cur = 0;
    function fig(o, label) { return '<figure class="lb__fig">' + img(o, { sizes: '(min-width: 1024px) 45vw, 100vw' }).replace(' loading="lazy"', '') + '<figcaption class="label">' + label + '</figcaption></figure>'; }
    function show(i) {
      cur = (i + works.length) % works.length; var w = works[cur];
      stage.innerHTML = (w.before && has(w.before.src) ? fig(w.before, 'До') : '') + fig(w.after, 'После');
      stage.classList.toggle('lb__stage--pair', !!(w.before && has(w.before.src)));
      cap.innerHTML = [w.car && '<b>' + esc(w.car) + '</b>', w.done && esc(w.done), [w.time, w.date].filter(has).map(esc).join(' · ')].filter(Boolean).join('<br>');
      cnt.textContent = (cur + 1) + ' / ' + works.length;
    }
    var lastFocus = null;
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); lastFocus = a; show(+a.getAttribute('data-work')); dlg.showModal(); html.classList.add('lb-open');
      });
    });
    var single = works.length < 2;
    $('.lb__prev', dlg).hidden = single; $('.lb__next', dlg).hidden = single;
    $('.lb__prev', dlg).addEventListener('click', function () { show(cur - 1); });
    $('.lb__next', dlg).addEventListener('click', function () { show(cur + 1); });
    $('.lb__close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () { html.classList.remove('lb-open'); if (lastFocus) lastFocus.focus(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (single) return;
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'ArrowLeft') show(cur - 1);
    });
    var x0 = null, y0 = null;
    stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    stage.addEventListener('pointerup', function (e) {
      if (x0 === null || single) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(cur + (dx < 0 ? 1 : -1));
    });
  }

  /* ---- мобильная панель: после первого экрана ---- */
  function initMbar() {
    var bar = $('#mbar'), hero = $('.hero'); if (!bar) return;
    html.classList.add('has-mbar');
    if (!hero || !('IntersectionObserver' in root)) { bar.classList.add('is-on'); return; }
    new IntersectionObserver(function (es) { bar.classList.toggle('is-on', !es[0].isIntersecting); }, { threshold: 0 }).observe(hero);
  }

  /* ---- появление некоторых блоков (CSS-переходы) ----
     Контент без JS виден всегда; класс is-pre ставим только тем
     элементам, что сейчас ниже экрана. */
  function initReveal() {
    if (reduce || !('IntersectionObserver' in root)) return;
    var vh = root.innerHeight;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.remove('is-pre'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el) {
      if (el.getBoundingClientRect().top > vh) { el.classList.add('is-pre'); io.observe(el); }
    });
  }

  function boot() {
    var cfg = root.SITE_CONFIG; if (!cfg) return;
    if (html.getAttribute('data-prerendered') !== hash(cfg)) applyRender(cfg);
    $$('[data-year]').forEach(function (y) { y.textContent = new Date().getFullYear(); });
    initHeader(); initPrices(); initHours(cfg); initTabs(); initMaps(); initLightbox(cfg); initMbar(); initReveal();
    html.classList.add('is-ready');
    root.dispatchEvent(new CustomEvent('site:ready'));
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
