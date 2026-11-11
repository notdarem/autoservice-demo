/* core/hours.js — часы работы и статус «Открыто до …» по часовому поясу бизнеса */
import { tpl, pad } from './util.js?v=fl093q';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const fmtTime = (m) => `${Math.floor(m / 60)}:${pad(m % 60)}`;

/* hours: массив из 7 элементов (пн…вс): [[startMin, endMin], …] или [] — выходной.
   endMin может быть > 1440 (работают за полночь). */
function weekIntervals(hours) {
  const out = [];
  hours.forEach((day, d) => day.forEach(([s, e]) => out.push([d * 1440 + s, d * 1440 + e])));
  out.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const iv of out) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]); else merged.push([...iv]);
  }
  return merged;
}

/* Текущее время в часовом поясе бизнеса: { day: 0..6 (пн=0), min } */
export function nowIn(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { day, min: (+get('hour') % 24) * 60 + +get('minute') };
}

/* Статус «Открыто до …» / «Закрыто, откроемся в …». null — часы неизвестны. */
export function hoursStatus(hours, tz, d, date) {
  if (!hours) return null;
  const W = 7 * 1440;
  const base = weekIntervals(hours);
  if (!base.length) return null;
  if (base.length === 1 && base[0][1] - base[0][0] >= W) return { open: true, text: d.open_24 };
  const ivs = [...base.map(([s, e]) => [s - W, e - W]), ...base, ...base.map(([s, e]) => [s + W, e + W])];
  const { day, min } = nowIn(tz, date);
  const now = day * 1440 + min;
  const cur = ivs.find(([s, e]) => s <= now && now < e);
  if (cur) {
    if (cur[1] - cur[0] >= W) return { open: true, text: d.open_24 };
    return { open: true, text: tpl(d.open_until, { time: fmtTime(((cur[1] % 1440) + 1440) % 1440) }) };
  }
  const next = ivs.find(([s]) => s > now);
  if (!next) return null;
  const nd = Math.floor(next[0] / 1440);
  const time = fmtTime(((next[0] % 1440) + 1440) % 1440);
  if (nd === day) return { open: false, text: tpl(d.closed_opens_today, { time }) };
  if (nd === day + 1) return { open: false, text: tpl(d.closed_opens_tomorrow, { time }) };
  return { open: false, text: tpl(d.closed_opens_day, { time, day: d.days_acc[((nd % 7) + 7) % 7] }) };
}

export const dayText = (iv, d) => !iv.length ? d.closed
  : (iv.length === 1 && iv[0][0] === 0 && iv[0][1] === 1440) ? d.around_clock
  : iv.map(([s, e]) => tpl(d.hours_range, { from: fmtTime(s), to: fmtTime(e % 1440 || (e === 1440 ? 1440 : 0)) })).join(', ');

/* «Пн–Сб 9:00–20:00, Вс 10:00–18:00» или «Ежедневно 9:00–20:00» */
export function hoursSummary(hours, d) {
  if (!hours) return '';
  const key = (iv) => JSON.stringify(iv);
  if (hours.every((x) => key(x) === key(hours[0]))) return `${d.daily} ${dayText(hours[0], d)}`;
  const groups = [];
  hours.forEach((iv, i) => {
    const g = groups[groups.length - 1];
    if (g && key(g.iv) === key(iv)) g.to = i; else groups.push({ from: i, to: i, iv });
  });
  return groups.map((g) => `${d.days[g.from]}${g.to > g.from ? '–' + d.days[g.to] : ''} ${dayText(g.iv, d)}`).join(', ');
}

