/* core/util.js — общие мелочи для render.js и main.js */
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const pad = (n) => String(n).padStart(2, '0');

/* Хэш модели: prerender пишет его в <html data-prerendered>, main.js сверяет.
   Не совпал (data.js правили руками) — страница перерисуется из данных. */
export function hash(obj) {
  const s = JSON.stringify(obj, (k, v) => (k === 'v' ? undefined : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

export function tpl(s, vars) {
  return String(s == null ? '' : s).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
}
export function plural(forms, n, lang) {
  if (!Array.isArray(forms)) return tpl(forms, { n });
  const a = Math.abs(n) % 100, b = a % 10;
  const i = lang === 'ru' ? (b === 1 && a !== 11 ? 0 : b >= 2 && b <= 4 && (a < 12 || a > 14) ? 1 : 2) : 2;
  return tpl(forms[i] || forms[forms.length - 1], { n });
}
