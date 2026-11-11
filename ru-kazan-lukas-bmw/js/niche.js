/* =====================================================================
   niches/auto/blocks.js — блоки автосервиса.
   Фабрика получает помощники ядра (h) и ничего не импортирует: в готовом
   сайте файл лежит как js/niche.js рядом с js/render.js.
   Порядок = порядок вопросов клиента. Нет данных — блок не выводится.
   ===================================================================== */
export default function auto(h) {
  const { esc, t, tx, raw, icon, mark, pic, B } = h;

  const listBlock = (lst, cls) => lst && lst.items.length
    ? `<ul class="${cls}">${lst.items.map((s) => `<li class="tag">${tx(s)}</li>`).join('')}</ul>` : '';

  const blocks = {
    /* 1. Возьмут ли мою? — марки текстом, типы, чего не делаем */
    makes(m) {
      const n = m.niche;
      if (!(n.makes || n.car_types || n.not_do || n.services)) return null;
      const parts = [];
      if (n.makes) parts.push(`<div class="makes__g makes__g--makes"><h3 class="makes__h">${esc(t('makes_label'))}</h3>${listBlock(n.makes, 'makes__list')}</div>`);
      if (n.car_types) parts.push(`<div class="makes__g"><h3 class="makes__h">${esc(t('types_label'))}</h3>${listBlock(n.car_types, 'chips')}</div>`);
      if (n.services) parts.push(`<div class="makes__g makes__g--services"><h3 class="makes__h">${esc(t('services_label'))}</h3>${listBlock(n.services, 'chips')}</div>`);
      if (n.not_do) parts.push(`<div class="makes__g makes__g--no"><h3 class="makes__h">${esc(t('not_do_label'))}</h3><ul class="nolist">${n.not_do.items.map((s) => `<li>${icon('no')}<span>${tx(s)}</span></li>`).join('')}</ul></div>`);
      return { title: t('sec_makes'), nav: t('sec_makes_nav'), body: `<div class="makes">${parts.join('')}</div>${n.makes_note ? `<p class="makes__note">${tx(n.makes_note)}</p>` : ''}` };
    },

    /* 2. Сколько стоит. Обычный прайс — доска ядра. Если категории прайса — серии моделей
       (niche.price_layout = "series"): переключатель серий + поиск (niches/auto/behavior.js).
       Без JS — все серии таблицами (статичная разметка ниже), с JS она же служит источником данных. */
    prices(m) {
      const base = B.prices(m);
      if (!base || m.niche.price_layout !== 'series') return base;
      const short = (c) => raw(c).replace(/^Серии\s+/i, '');
      const total = m.prices.reduce((s, c) => s + c.items.length, 0);
      const ui = `<div class="series__ui" data-series-ui hidden>
<div class="series__tabs" role="tablist" aria-label="${esc(t('series_label'))}">${m.prices.map((c, i) => `<button type="button" class="series__tab" role="tab" id="series-tab-${i}" aria-controls="series-board" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-series="${i}"><span class="series__tab-k">${esc(t('series_word'))}</span><span class="series__tab-v">${tx(short(c.category))}</span></button>`).join('')}</div>
<div class="series__tools"><label class="series__search"><span class="vh">${esc(t('series_search'))}</span><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-search"/></svg><input type="search" placeholder="${esc(t('series_search_ph'))}" autocomplete="off" data-series-q></label><p class="series__count" aria-live="polite" data-series-count></p></div>
<div class="series__panel" id="series-board" role="tabpanel" aria-labelledby="series-tab-0" data-series-panel><ul class="series__board" data-series-board></ul></div>
<p class="series__empty" data-series-empty hidden>${esc(t('series_empty'))}</p>
<button type="button" class="btn btn--ghost series__more" data-series-more hidden></button>
</div>`;
      // оговорки к ценам («что входит», «не является офертой») — вне скрываемой части: видны и с JS, и без
      const cut = base.body.indexOf('<div class="pnotes">');
      const tables = cut < 0 ? base.body : base.body.slice(0, cut);
      const notes = cut < 0 ? '' : base.body.slice(cut);
      return { ...base, lead: esc(t('series_lead', { n: h.num(total), k: m.prices.length })), cls: 'sec--series', body: `<div class="series" data-series-root>${ui}<div class="series__static" data-series-static>${tables}</div></div>${notes}` };
    },

    /* 3. Как проходит визит. Нейтральные шаги (запись → осмотр → ремонт → выдача) есть всегда:
       они ничего не обещают. Всё конкретное — пояснения к шагам и шаг «Согласование цены» —
       только если это есть в источниках (lead.niche.visit с source_url). */
    visit(m) {
      const src = Object.fromEntries((m.niche.visit || []).map((s) => [s.kind, s]));
      const NEUTRAL = ['booking', 'intake', 'repair', 'handover'];
      const kinds = ['booking', 'intake', 'approval', 'repair', 'handover'].filter((k) => NEUTRAL.includes(k) || src[k]);
      const photos = kinds.map((k) => src[k] && src[k].photo).filter(Boolean);
      const story = photos.length >= 2;
      const stepPic = (k, cls, sizes) => (src[k] && src[k].photo ? pic(src[k].photo, { alt: raw(src[k].alt) || '', sizes, cls }) : '');
      const steps = `<ol class="steps${story ? ' steps--story' : ''}" style="--n:${kinds.length}">${kinds.map((k, i) => `<li class="step" data-step="${i}"><span class="step__no" aria-hidden="true">${i + 1}</span><h3 class="step__t">${esc(t('step_' + k))}</h3>${src[k] && src[k].text ? `<p class="step__d">${tx(src[k].text)}</p>` : ''}${story ? stepPic(k, 'step__pic', '(min-width: 1024px) 1px, 92vw') : ''}</li>`).join('')}</ol>`;
      /* ПК: колонка с фото закреплена (position: sticky), активный кадр меняется по шагу — niches/auto/motion.js.
         Фото в колонке дублируют фото шагов: на телефоне колонка скрыта (lazy-картинки не грузятся), на ПК — фото шагов. */
      const media = story ? `<div class="story__media panel" aria-hidden="true">${kinds.map((k, i) => (src[k] && src[k].photo ? `<div class="story__frame${i === 0 ? ' is-on' : ''}" data-frame="${i}">${pic(src[k].photo, { alt: '', sizes: '(min-width: 1024px) 46vw, 1px', cls: 'story__pic' })}</div>` : '')).join('')}</div>` : '';
      return {
        title: t('sec_visit'), nav: t('sec_visit_nav'), cls: story ? 'sec--story' : '',
        body: story ? `<div class="story">${media}${steps}</div>` : steps
      };
    },

    /* 4. Гарантия и документы — штамп только если есть срок со stamp */
    warranty(m) {
      const w = m.niche.warranty || [];
      if (!w.length) return null;
      const term = w.find((x) => x.kind === 'term' && x.stamp);
      const stamp = term ? `<div class="stamp" aria-hidden="true"><svg viewBox="0 0 200 200" class="stamp__svg"><defs><path id="stamp-arc" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0"/></defs><circle cx="100" cy="100" r="94" class="stamp__ring"/><circle cx="100" cy="100" r="56" class="stamp__ring stamp__ring--in"/><text class="stamp__arc"><textPath href="#stamp-arc" startOffset="0" textLength="446" lengthAdjust="spacing">${esc((t('w_stamp_top') + ' • ').repeat(3))}</textPath></text></svg><span class="stamp__lbl">${esc(t('w_stamp_top'))}</span><span class="stamp__val">${tx(term.stamp)}</span></div>` : '';
      return {
        title: t('sec_warranty'),
        body: `<div class="warranty${stamp ? '' : ' warranty--nostamp'}">${stamp}<dl class="wlist card">${w.map((x) => `<div class="wlist__i"><dt>${icon(x.kind === 'term' ? 'shield' : x.kind === 'documents' ? 'check' : 'other')}<span>${esc(t('w_' + x.kind))}</span></dt><dd>${tx(x.text)}</dd></div>`).join('')}</dl></div>`
      };
    },

    /* 5. Мастера */
    team(m) {
      const team = m.niche.team || [];
      if (!team.length) return null;
      const initials = (n) => raw(n).split(/\s+/).filter((w) => !/^тест/i.test(w)).map((w) => w[0]).join('').slice(0, 2) || raw(n)[0];
      return {
        title: t('sec_team'),
        body: `<ul class="team card">${team.map((p) => `<li class="person">${p.photo ? pic(p.photo, { alt: raw(p.name), sizes: '160px', cls: 'person__ph' }) : `<span class="person__mono" aria-hidden="true">${esc(initials(p.name))}</span>`}<div class="person__b"><h3 class="person__n">${tx(p.name)}</h3>${p.role ? `<p class="person__r">${tx(p.role)}</p>` : ''}${p.experience ? `<p class="person__x">${tx(p.experience)}</p>` : ''}${p.quote ? `<blockquote class="person__q"><p>${tx(p.quote)}</p></blockquote>` : ''}</div></li>`).join('')}</ul>`
      };
    },

    /* 6. Примеры работ — общая мозаика ядра */
    works: (m) => B.works(m),

    /* 7. Удобства и условия — единственная «сетка карточек» на сайте */
    amenities(m) {
      const a = m.niche.amenities || [];
      if (!a.length) return null;
      return {
        title: t('sec_amenities'),
        body: `<ul class="amen">${a.map((x) => `<li class="amen__i card">${icon(x.kind, 'amen__ic')}<h3 class="amen__t">${x.title ? tx(x.title) : esc(t('a_' + x.kind))}</h3><p>${tx(x.text)}</p></li>`).join('')}</ul>`
      };
    }
  };

  return {
    ldType: 'AutoRepair',
    /* якоря шапки: приоритет (берутся первые 5 выведенных, в порядке страницы) */
    nav: ['reviews', 'works', 'prices', 'contacts', 'makes', 'visit'],
    /* что уточнить у клиента, даже если блок выведен (неполные данные) */
    asks: (m) => [
      ...(!(m.niche.visit || []).length ? [{ block: 'visit', ask: 'Как проходит визит: запись, осмотр при клиенте, согласование цены, выдача? Сейчас на сайте только нейтральные шаги без пояснений.' }] : [])
    ],
    /* отзывы и работы — сразу после первого экрана (доверие), дальше «возьмут ли мою, сколько, как, где» */
    order: ['hero', 'reviews', 'works', 'makes', 'prices', 'visit', 'warranty', 'team', 'amenities', 'more', 'faq', 'contacts'],
    blocks,
    /* что спросить у клиента, если блок скрыт */
    ask: {
      makes: 'С какими марками и типами машин работаете? Чего не делаете?',
      prices: 'Прайс на основные работы (как у вас в прайсе: «от», диапазон, за что цена).',
      warranty: 'Есть ли гарантия, какой срок, что выдаёте на руки, можно ли со своими запчастями?',
      team: 'Кто мастера: имя, роль, стаж, можно ли фото?',
      works: 'Фото работ (до/после) с подписями.',
      reviews: 'Ссылки на карточки с отзывами (Яндекс, 2ГИС, Google).',
      amenities: 'Парковка, где подождать, можно ли смотреть за ремонтом, способы оплаты, эвакуатор.',
      faq: 'Частые вопросы клиентов и ваши ответы.',
      contacts: 'Адрес, часы работы, как найти вход.'
    }
  };
}
