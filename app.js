// PlanPress – printable planner maker. Offline: settings stay in this browser profile.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const INT = Math.floor;

// ---------- Pro (Microsoft Store add-on via Digital Goods API) ----------
const STORE_BILLING = 'https://store.microsoft.com/billing';
const PRO_SKU = 'planpress_pro';
const PRO_IDS = [PRO_SKU];
let STORE_URL = 'https://apps.microsoft.com/detail/9MWM5PWSHH2F';
let proAvailable = false; // limits apply only when the Store actually sells the add-on
let proSku = PRO_SKU;
let isPro = false;
try { isPro = localStorage.getItem('planpress-pro') === '1'; } catch (_) {}
const unlocked = () => isPro || !proAvailable;
async function billing() {
  if (!('getDigitalGoodsService' in window)) return null;
  try { return await window.getDigitalGoodsService(STORE_BILLING); } catch (_) { return null; }
}
function setPro(v) {
  isPro = v;
  try { localStorage.setItem('planpress-pro', v ? '1' : '0'); } catch (_) {}
  const b = $('proBtn');
  b.textContent = v ? '★ Pro' : '★ Get Pro';
  b.classList.toggle('is-pro', v);
  b.hidden = !proAvailable && !v;
  renderUI();
}
async function checkPro() {
  const svc = await billing();
  if (!svc) return false;
  try {
    const details = await svc.getDetails(PRO_IDS).catch(() => []);
    proAvailable = details.length > 0;
    if (details[0]) { proSku = details[0].itemId; if (!PRO_IDS.includes(proSku)) PRO_IDS.push(proSku); }
    const list = await svc.listPurchases();
    const owned = list.some((p) => PRO_IDS.includes(p.itemId));
    setPro(owned);
    return owned;
  } catch (_) { return isPro; }
}
function proMessage(text) { const m = $('proMsg'); m.hidden = !text; m.textContent = text || ''; }
async function openPro(reason) {
  proMessage(reason || '');
  const svc = await billing();
  if (!svc) { $('buyBtn').textContent = 'Get PlanPress on Microsoft Store'; $('restoreBtn').hidden = true; }
  else {
    $('restoreBtn').hidden = false;
    try {
      const [d] = await svc.getDetails([proSku]);
      const price = d && d.price ? new Intl.NumberFormat(undefined, { style: 'currency', currency: d.price.currency }).format(Number(d.price.value)) : '';
      $('buyBtn').textContent = price ? `Unlock Pro – ${price}` : 'Unlock Pro';
    } catch (_) { $('buyBtn').textContent = 'Unlock Pro'; }
  }
  if (!$('proDialog').open) $('proDialog').showModal();
}
async function buyPro() {
  const svc = await billing();
  if (!svc) { window.open(STORE_URL, '_blank'); return; }
  const methods = [{ supportedMethods: STORE_BILLING, data: { sku: proSku } }];
  try {
    let req;
    try { req = new PaymentRequest(methods); }
    catch (_) { req = new PaymentRequest(methods, { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }); }
    const res = await req.show();
    await res.complete('success');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    proMessage('Purchase could not be completed: ' + (e.message || e));
    return;
  }
  if (await checkPro()) { proMessage('Thank you! Pro is unlocked. ★'); setTimeout(() => $('proDialog').close(), 1500); }
}

// ---------- dates and holidays ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
function nth(y, m, wd, n) { // n-th weekday of a month; n = -1 for the last one
  if (n > 0) { const first = new Date(y, m, 1).getDay(); return 1 + ((wd - first + 7) % 7) + (n - 1) * 7; }
  const last = daysIn(y, m); return last - ((new Date(y, m, last).getDay() - wd + 7) % 7);
}
function easter(y) {
  const a = y % 19, b = INT(y / 100), c = y % 100, d = INT(b / 4), e = b % 4, f = INT((b + 8) / 25), g = INT((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = INT(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = INT((a + 11 * h + 22 * l) / 451);
  return [INT((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1];
}
const HOLIDAY_SETS = [['none', 'No holidays'], ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['IE', 'Ireland'], ['NZ', 'New Zealand']];
const holCache = new Map();
function holidays(country, y) {
  const key = country + y;
  if (holCache.has(key)) return holCache.get(key);
  const h = {};
  const add = (m, d, t) => { const k = `${m}-${d}`; h[k] = h[k] ? h[k] + ' · ' + t : t; };
  const [em, ed] = easter(y);
  const fromEaster = (n, t) => { const dt = new Date(y, em, ed + n); add(dt.getMonth(), dt.getDate(), t); };
  if (country === 'US') {
    add(0, 1, "New Year's Day"); add(0, nth(y, 0, 1, 3), 'MLK Day'); add(1, 14, "Valentine's Day"); add(1, nth(y, 1, 1, 3), "Presidents' Day");
    fromEaster(0, 'Easter'); add(4, nth(y, 4, 0, 2), "Mother's Day"); add(4, nth(y, 4, 1, -1), 'Memorial Day'); add(5, nth(y, 5, 0, 3), "Father's Day"); add(5, 19, 'Juneteenth');
    add(6, 4, 'Independence Day'); add(8, nth(y, 8, 1, 1), 'Labor Day'); add(9, nth(y, 9, 1, 2), 'Columbus Day'); add(9, 31, 'Halloween');
    add(10, 11, 'Veterans Day'); add(10, nth(y, 10, 4, 4), 'Thanksgiving'); add(11, 24, 'Christmas Eve'); add(11, 25, 'Christmas Day'); add(11, 31, "New Year's Eve");
  } else if (country === 'GB' || country === 'IE') {
    add(0, 1, "New Year's Day"); add(1, 14, "Valentine's Day"); fromEaster(-21, "Mother's Day"); fromEaster(-2, 'Good Friday'); fromEaster(0, 'Easter Sunday'); fromEaster(1, 'Easter Monday');
    if (country === 'GB') { add(4, nth(y, 4, 1, 1), 'Early May bank holiday'); add(4, nth(y, 4, 1, -1), 'Spring bank holiday'); add(7, nth(y, 7, 1, -1), 'Summer bank holiday'); add(10, 5, 'Bonfire Night'); add(10, nth(y, 10, 0, 2), 'Remembrance Sunday'); }
    else { add(1, nth(y, 1, 1, 1), "St Brigid's Day"); add(2, 17, "St Patrick's Day"); add(4, nth(y, 4, 1, 1), 'May bank holiday'); add(5, nth(y, 5, 1, 1), 'June bank holiday'); add(7, nth(y, 7, 1, 1), 'August bank holiday'); add(9, nth(y, 9, 1, -1), 'October bank holiday'); }
    add(5, nth(y, 5, 0, 3), "Father's Day"); add(9, 31, 'Halloween'); add(11, 25, 'Christmas Day'); add(11, 26, country === 'GB' ? 'Boxing Day' : "St Stephen's Day");
  } else if (country === 'CA') {
    add(0, 1, "New Year's Day"); add(1, 14, "Valentine's Day"); add(1, nth(y, 1, 1, 3), 'Family Day'); fromEaster(-2, 'Good Friday'); fromEaster(0, 'Easter Sunday');
    add(4, nth(y, 4, 0, 2), "Mother's Day"); { const d = new Date(y, 4, 24); add(4, 24 - ((d.getDay() + 6) % 7), 'Victoria Day'); } add(5, nth(y, 5, 0, 3), "Father's Day");
    add(6, 1, 'Canada Day'); add(7, nth(y, 7, 1, 1), 'Civic Holiday'); add(8, nth(y, 8, 1, 1), 'Labour Day'); add(8, 30, 'Truth and Reconciliation Day'); add(9, nth(y, 9, 1, 2), 'Thanksgiving');
    add(9, 31, 'Halloween'); add(10, 11, 'Remembrance Day'); add(11, 25, 'Christmas Day'); add(11, 26, 'Boxing Day');
  } else if (country === 'AU' || country === 'NZ') {
    add(0, 1, "New Year's Day"); add(1, 14, "Valentine's Day"); fromEaster(-2, 'Good Friday'); fromEaster(0, 'Easter Sunday'); fromEaster(1, 'Easter Monday');
    if (country === 'AU') { add(0, 26, 'Australia Day'); add(5, nth(y, 5, 1, 2), "King's Birthday"); add(8, nth(y, 8, 0, 1), "Father's Day"); }
    else { add(0, 2, 'Day after New Year'); add(1, 6, 'Waitangi Day'); add(5, nth(y, 5, 1, 1), "King's Birthday"); add(8, nth(y, 8, 0, 1), "Father's Day"); add(9, nth(y, 9, 1, 4), 'Labour Day'); }
    add(3, 25, 'Anzac Day'); add(4, nth(y, 4, 0, 2), "Mother's Day"); add(9, 31, 'Halloween'); add(11, 25, 'Christmas Day'); add(11, 26, 'Boxing Day');
  }
  holCache.set(key, h);
  return h;
}

// ---------- settings ----------
const SECTIONS = [
  { k: 'cover', n: 'Cover', d: 'Your title, name and year' },
  { k: 'year', n: 'Year at a glance', d: 'All 12 months on one page' },
  { k: 'goals', n: 'Yearly goals', d: 'Goals for every part of life', pro: true },
  { k: 'dates', n: 'Birthdays & important dates', d: 'Month by month' },
  { k: 'monthly', n: 'Monthly calendars', d: '12 months with holidays and your dates' },
  { k: 'weekly', n: 'Weekly pages', d: 'Every week of the year', opt: { key: 'weeklyLayout', vals: [['days', '7 day boxes'], ['list', 'Days + to-do list']] } },
  { k: 'habit', n: 'Habit tracker', d: 'One for each month' },
  { k: 'budget', n: 'Monthly budget', d: 'Income, bills and spending', pro: true },
  { k: 'meal', n: 'Meal planner + grocery list', d: 'Undated weeks', pro: true, count: true },
  { k: 'daily', n: 'Daily pages', d: 'Undated: schedule, priorities, to-do', pro: true, count: true },
  { k: 'cleaning', n: 'Cleaning schedule', d: 'Daily, weekly, monthly jobs', pro: true },
  { k: 'todo', n: 'To-do lists', d: 'Checklist pages', count: true },
  { k: 'notes', n: 'Notes', d: 'Extra pages at the back', count: true, opt: { key: 'notesType', vals: [['lined', 'Lined'], ['dots', 'Dot grid'], ['grid', 'Squares']] } },
];
const DEFAULT_HABITS = 'Drink 8 glasses of water\nExercise 30 minutes\nRead 20 pages\nWalk 10,000 steps\nNo sugar\nSleep by 11 pm\nMeditate\nJournal';
const thisYear = () => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); };
const blank = () => ({
  title: 'My Planner', owner: '', year: thisYear(), start: 0, weekStart: 0, holidays: 'US', style: 'simple', paper: 'letter', twoUp: true, holes: false,
  on: { cover: true, year: true, goals: false, dates: true, monthly: true, weekly: true, habit: true, budget: false, meal: false, daily: false, cleaning: false, todo: true, notes: true },
  counts: { meal: 4, daily: 7, todo: 2, notes: 4 }, weeklyLayout: 'days', notesType: 'lined', dates: '', habits: DEFAULT_HABITS,
});
let S = blank();
function load() {
  try { const t = localStorage.getItem('planpress'); if (t) { const o = JSON.parse(t), b = blank(); S = Object.assign(b, o, { on: Object.assign(b.on, o.on || {}), counts: Object.assign(b.counts, o.counts || {}) }); } } catch (_) {}
}
let saveTimer = 0;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem('planpress', JSON.stringify(S)); } catch (_) {} }, 250); }

// important dates: "Mar 14 Mom's birthday", "March 14: ...", "3/14 ...", "14/3 ...", "2027-03-14 ..."
function parseDates() {
  const out = {};
  const dm = S.holidays !== 'US' && S.holidays !== 'CA' && S.holidays !== 'none' ? true : false;
  String(S.dates || '').split('\n').forEach((raw) => {
    const line = raw.trim(); if (!line) return;
    let m, d, rest, r;
    if ((r = line.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*[:\-–]?\s*(.*)$/))) { m = +r[2] - 1; d = +r[3]; rest = r[4]; }
    else if ((r = line.match(/^(\d{1,2})[\/.](\d{1,2})(?:[\/.]\d{2,4})?\s*[:\-–]?\s*(.*)$/))) { let a = +r[1], b = +r[2]; if (dm ? b > 12 : a > 12) [a, b] = [b, a]; if (dm) { d = a; m = b - 1; } else { m = a - 1; d = b; } rest = r[3]; }
    else if ((r = line.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*[:\-–]?\s*(.*)$/))) { m = MON3.findIndex((x) => x.toLowerCase() === r[1].slice(0, 3).toLowerCase()); d = +r[2]; rest = r[3]; }
    else if ((r = line.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s*[:\-–]?\s*(.*)$/))) { m = MON3.findIndex((x) => x.toLowerCase() === r[2].slice(0, 3).toLowerCase()); d = +r[1]; rest = r[3]; }
    if (m == null || m < 0 || m > 11 || !(d >= 1 && d <= 31)) return;
    const k = `${m}-${d}`; out[k] = out[k] ? out[k] + ' · ' + (rest || '★') : (rest || '★');
  });
  return out;
}

// ---------- styles ----------
const SANS = "'Segoe UI', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const SCRIPT = "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
const STYLES = {
  simple: { name: 'Simple', accent: '#2f2f2f', soft: '#efefef', mid: '#bdbdbd', head: SANS, hw: 700, caps: true },
  sage: { name: 'Sage', accent: '#4f7a68', soft: '#e7f0eb', mid: '#a9c4b6', head: SERIF, hw: 400 },
  blush: { name: 'Blush', accent: '#b8697e', soft: '#f8e8ec', mid: '#e5b7c3', head: SCRIPT, hw: 400, pro: true, flower: true },
  navy: { name: 'Navy & gold', accent: '#1f3a5f', soft: '#e6ecf4', mid: '#c9a54c', head: SERIF, hw: 700, caps: true, pro: true },
  terracotta: { name: 'Terracotta', accent: '#b8603a', soft: '#f6e6dc', mid: '#e0b294', head: SERIF, hw: 400, pro: true, arch: true },
  lavender: { name: 'Lavender', accent: '#7a5fa8', soft: '#efeaf7', mid: '#c8b8e3', head: SCRIPT, hw: 400, pro: true, flower: true },
};
const st = () => STYLES[S.style] || STYLES.simple;
const INK = '#2b2b2b', MUTED = '#8a8a8a', LINE = '#d4d4d4';
const PAPERS = {
  letter: { name: 'Letter (8.5 × 11 in)', w: 612, h: 792, sheet: 'letter' },
  a4: { name: 'A4', w: 595.3, h: 841.9, sheet: 'A4' },
  half: { name: 'Half Letter (5.5 × 8.5 in)', w: 396, h: 612, sheet: 'letter', pair: 'letter', pro: true },
  a5: { name: 'A5', w: 419.5, h: 595.3, sheet: 'A5', pair: 'A4', pro: true },
};
const paper = () => PAPERS[S.paper] || PAPERS.letter;

// ---------- svg helpers ----------
const f1 = (n) => (Math.round(n * 10) / 10).toString();
function T(x, y, s, size, o) {
  o = o || {};
  const a = [`x="${f1(x)}"`, `y="${f1(y)}"`, `font-size="${f1(size)}"`, `font-family="${o.font || SANS}"`, `fill="${o.fill || INK}"`];
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.italic) a.push('font-style="italic"');
  if (o.ls) a.push(`letter-spacing="${o.ls}"`);
  return `<text ${a.join(' ')}>${esc(s)}</text>`;
}
const R = (x, y, w, h, o) => { o = o || {}; return `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"${o.rx ? ` rx="${o.rx}"` : ''} fill="${o.fill || 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 0.7}"` : ''}/>`; };
const L = (x1, y1, x2, y2, c, w, dash) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${c || LINE}" stroke-width="${w || 0.6}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const C = (x, y, r, o) => { o = o || {}; return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${o.fill || 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 0.7}"` : ''}/>`; };
const box = (x, y, s) => R(x, y, s, s, { stroke: '#9a9a9a', sw: 0.7, rx: 1.5 });
function ruled(x, y, w, h, gap, o) { let s = ''; for (let yy = y + gap; yy <= y + h + 0.1; yy += gap) s += L(x, yy, x + w, yy, LINE, 0.5); return s; }
const fit = (txt, maxW, base, ratio) => Math.min(base, maxW / Math.max(1, String(txt).length * (ratio || 0.52)));
const clip = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : s);
function flower(x, y, r, c, c2) { let s = `<g transform="translate(${f1(x)},${f1(y)})">`; for (let k = 0; k < 5; k++) { const a = (k * 72 - 90) * Math.PI / 180, cx = Math.cos(a) * r * 0.55, cy = Math.sin(a) * r * 0.55; s += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(r * 0.45)}" ry="${f1(r * 0.32)}" transform="rotate(${k * 72 - 90} ${f1(cx)} ${f1(cy)})" fill="${c}" opacity=".8"/>`; } return s + `<circle r="${f1(r * 0.22)}" fill="${c2}"/></g>`; }
function leafSprig(x, y, len, rot, c) { let s = `<g transform="translate(${f1(x)},${f1(y)}) rotate(${rot})"><path d="M0,0 Q${f1(len * 0.12)},${f1(len * 0.5)} 0,${f1(len)}" stroke="${c}" stroke-width="${f1(len * 0.025)}" fill="none"/>`; for (let k = 1; k <= 6; k++) { const yy = len * k / 7, sd = k % 2 ? 1 : -1; s += `<ellipse cx="${f1(sd * len * 0.1)}" cy="${f1(yy)}" rx="${f1(len * 0.09)}" ry="${f1(len * 0.04)}" transform="rotate(${sd * 35} ${f1(sd * len * 0.1)} ${f1(yy)})" fill="${c}"/>`; } return s + '</g>'; }

// page frame: returns { x, y, w, h, u } – the area below the heading
function frame(title, sub) {
  const P = paper(), s = st(), u = P.w / 612;
  const m = 34 * Math.max(0.78, u), left = m + (S.holes ? 22 * Math.max(0.8, u) : 0);
  const x = left, w = P.w - left - m;
  let b = `<rect width="${f1(P.w)}" height="${f1(P.h)}" fill="#fff"/>`;
  const hs = 26 * u * (s.head === SCRIPT ? 1.25 : 1);
  const ttl = s.caps ? title.toUpperCase() : title;
  const size = fit(ttl, w * (sub ? 0.62 : 0.95), hs, s.caps ? 0.68 : 0.55);
  const ty = m + size * 0.95;
  b += T(x, ty, ttl, size, { font: s.head, weight: s.hw, fill: s.accent, ls: s.caps ? 1.5 * u : 0 });
  if (sub) b += T(x + w, ty, sub, 11 * u, { anchor: 'end', fill: MUTED, ls: 0.5 });
  b += L(x, ty + 9 * u, x + w, ty + 9 * u, s.mid, 1.2 * u);
  if (s.flower) b += flower(x + w - 8 * u, ty - size - 2 * u, 8 * u, s.mid, s.accent);
  const y = ty + 22 * u;
  return { b, x, y, w, h: P.h - y - m, u, P };
}
const page = (label, body) => { const P = paper(); return { label, w: P.w, h: P.h, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(P.w)} ${f1(P.h)}" width="${f1(P.w)}" height="${f1(P.h)}">${body}</svg>` }; };

// ---------- calendar pieces ----------
const span = () => Array.from({ length: 12 }, (_, i) => { const k = S.start + i; return { y: S.year + INT(k / 12), m: k % 12 }; });
const spanTitle = () => (S.start ? `${S.year}–${S.year + 1}` : String(S.year));
const dayKey = (m, d) => `${m}-${d}`;
const dows = () => Array.from({ length: 7 }, (_, i) => (i + Number(S.weekStart)) % 7);
function miniMonth(x, y, w, yr, m, o) {
  o = o || {}; const s = st(), cw = w / 7, fs = cw * 0.42, hol = holidays(S.holidays, yr), mine = o.mine || {};
  let b = T(x + w / 2, y, o.title || MONTHS[m] + (o.withYear ? ' ' + yr : ''), fs * 1.35, { anchor: 'middle', font: s.head === SCRIPT ? SERIF : s.head, weight: 700, fill: s.accent });
  const dw = dows();
  dw.forEach((d, i) => { b += T(x + cw * (i + 0.5), y + fs * 2.2, DAYS[d][0], fs * 0.85, { anchor: 'middle', fill: MUTED, weight: 600 }); });
  const first = (new Date(yr, m, 1).getDay() - Number(S.weekStart) + 7) % 7;
  for (let d = 1; d <= daysIn(yr, m); d++) {
    const i = first + d - 1, cx = x + cw * ((i % 7) + 0.5), cy = y + fs * 2.2 + (INT(i / 7) + 1) * fs * 1.75;
    const k = dayKey(m, d);
    if (mine[k]) b += C(cx, cy - fs * 0.33, fs * 0.78, { fill: s.soft });
    b += T(cx, cy, d, fs, { anchor: 'middle', fill: hol[k] ? s.accent : INK, weight: hol[k] ? 700 : 400 });
  }
  return b;
}

// ---------- page makers ----------
function coverPage() {
  const P = paper(), s = st(), u = P.w / 612;
  let b = `<rect width="${f1(P.w)}" height="${f1(P.h)}" fill="#fff"/>`;
  const cx = P.w / 2 + (S.holes ? 10 * u : 0);
  if (s.arch) b += `<path d="M${f1(cx - 170 * u)},${f1(P.h * 0.78)} V${f1(P.h * 0.38)} A${f1(170 * u)},${f1(170 * u)} 0 0 1 ${f1(cx + 170 * u)},${f1(P.h * 0.38)} V${f1(P.h * 0.78)} Z" fill="${s.soft}"/>` + C(P.w * 0.18, P.h * 0.2, 30 * u, { fill: s.mid }) + C(P.w * 0.84, P.h * 0.86, 22 * u, { fill: s.mid });
  else if (s.flower) { b += flower(cx - 120 * u, P.h * 0.3, 34 * u, s.mid, s.accent) + flower(cx - 70 * u, P.h * 0.26, 20 * u, s.soft, s.mid) + flower(cx + 120 * u, P.h * 0.72, 34 * u, s.mid, s.accent) + flower(cx + 72 * u, P.h * 0.76, 20 * u, s.soft, s.mid) + leafSprig(cx - 160 * u, P.h * 0.33, 80 * u, -20, s.mid) + leafSprig(cx + 160 * u, P.h * 0.69, 80 * u, 160, s.mid); }
  else if (S.style === 'sage') b += leafSprig(cx - 150 * u, P.h * 0.26, 110 * u, -35, s.mid) + leafSprig(cx + 150 * u, P.h * 0.26, 110 * u, 35, s.mid) + leafSprig(cx - 140 * u, P.h * 0.78, 90 * u, 215, s.soft) + leafSprig(cx + 140 * u, P.h * 0.78, 90 * u, 145, s.soft);
  else if (S.style === 'navy') b += R(28 * u, 28 * u, P.w - 56 * u, P.h - 56 * u, { stroke: s.mid, sw: 2 * u }) + R(36 * u, 36 * u, P.w - 72 * u, P.h - 72 * u, { stroke: s.mid, sw: 0.6 * u });
  else b += R(cx - 150 * u, P.h * 0.36, 300 * u, P.h * 0.3, { stroke: s.accent, sw: 1.5 * u });
  const big = String(spanTitle());
  b += T(cx, P.h * 0.47, big, fit(big, 260 * u, 76 * u, 0.6), { anchor: 'middle', font: s.head === SCRIPT ? SERIF : s.head, weight: 700, fill: s.accent });
  const ttl = S.title || 'My Planner', tt = s.caps ? ttl.toUpperCase() : ttl;
  b += T(cx, P.h * 0.55, tt, fit(tt, 270 * u, 34 * u * (s.head === SCRIPT ? 1.3 : 1), s.caps ? 0.7 : 0.5), { anchor: 'middle', font: s.head, weight: s.hw, fill: INK, ls: s.caps ? 3 * u : 0 });
  if (S.owner) b += T(cx, P.h * 0.6, S.owner, fit(S.owner, 260 * u, 15 * u, 0.55), { anchor: 'middle', fill: MUTED, ls: 1 * u });
  return page('Cover', b);
}
function yearPage() {
  const F = frame('Year at a glance', spanTitle()), sp = span(), cols = F.P.w > F.P.h ? 4 : 3, rows = 12 / cols;
  const cw = F.w / cols, ch = F.h / rows, mine = parseDates();
  let b = F.b;
  sp.forEach((o, i) => { const x = F.x + (i % cols) * cw + cw * 0.06, y = F.y + INT(i / cols) * ch + 6 * F.u; b += miniMonth(x, y + cw * 0.08, cw * 0.88, o.y, o.m, { mine, withYear: S.start > 0 && (o.m === 0 || i === 0) }); });
  return page('Year at a glance', b);
}
function datesPage() {
  const F = frame('Birthdays & important dates', spanTitle()), sp = span(), mine = parseDates(), s = st();
  const cols = 2, rows = 6, cw = F.w / cols, ch = F.h / rows, lh = 13 * F.u;
  let b = F.b;
  sp.forEach((o, i) => {
    const x = F.x + (i % cols) * cw, y = F.y + INT(i / cols) * ch, iw = cw - 10 * F.u;
    b += R(x, y, iw, ch - 8 * F.u, { fill: s.soft, rx: 4 }) + T(x + 8 * F.u, y + 15 * F.u, MONTHS[o.m], 11 * F.u, { weight: 700, fill: s.accent });
    const items = []; for (let d = 1; d <= daysIn(o.y, o.m); d++) { const t = mine[dayKey(o.m, d)]; if (t) items.push(`${d}  ${t}`); }
    let yy = y + 20 * F.u;
    const max = INT((ch - 34 * F.u) / lh);
    for (let k = 0; k < max; k++) { yy += lh; b += L(x + 8 * F.u, yy + 3 * F.u, x + iw - 8 * F.u, yy + 3 * F.u, '#fff', 1); if (items[k]) b += T(x + 10 * F.u, yy, clip(items[k], INT(iw / (4.6 * F.u))), 8.5 * F.u); }
  });
  return page('Birthdays & dates', b);
}
function goalsPage() {
  const F = frame('Goals for ' + spanTitle()), s = st();
  const areas = ['Health & body', 'Family & friends', 'Work & learning', 'Money', 'Home', 'Fun & adventure'];
  let b = F.b;
  b += T(F.x, F.y + 10 * F.u, 'My word for the year', 10 * F.u, { fill: MUTED, weight: 600 }) + R(F.x, F.y + 16 * F.u, F.w, 32 * F.u, { stroke: s.mid, rx: 6 });
  const top = F.y + 64 * F.u, ch = (F.h - (top - F.y)) / 3, cw = F.w / 2;
  areas.forEach((a, i) => {
    const x = F.x + (i % 2) * cw, y = top + INT(i / 2) * ch, iw = cw - 10 * F.u;
    b += T(x, y + 10 * F.u, a, 11 * F.u, { weight: 700, fill: s.accent });
    for (let yy = y + 30 * F.u; yy < y + ch - 12 * F.u; yy += 19 * F.u) b += box(x, yy - 8 * F.u, 8 * F.u) + L(x + 13 * F.u, yy, x + iw, yy);
  });
  return page('Yearly goals', b);
}
function monthPage(o) {
  const F = frame(MONTHS[o.m], String(o.y)), s = st(), hol = holidays(S.holidays, o.y), mine = parseDates(), dw = dows();
  const first = (new Date(o.y, o.m, 1).getDay() - Number(S.weekStart) + 7) % 7, n = daysIn(o.y, o.m), rows = Math.ceil((first + n) / 7);
  const notesH = 70 * F.u, gh = F.h - notesH - 14 * F.u, cw = F.w / 7, hh = 16 * F.u, ch = (gh - hh) / rows;
  let b = F.b;
  b += R(F.x, F.y, F.w, hh, { fill: s.soft });
  dw.forEach((d, i) => { b += T(F.x + cw * (i + 0.5), F.y + hh * 0.68, (F.w < 360 ? DAYS[d].slice(0, 3) : DAYS[d]).toUpperCase(), 7.5 * F.u, { anchor: 'middle', weight: 700, fill: s.accent, ls: 0.6 }); });
  const gy = F.y + hh;
  for (let r = 0; r <= rows; r++) b += L(F.x, gy + r * ch, F.x + F.w, gy + r * ch, '#c9c9c9', 0.7);
  for (let c = 0; c <= 7; c++) b += L(F.x + c * cw, gy, F.x + c * cw, gy + rows * ch, '#c9c9c9', 0.7);
  const maxc = Math.max(8, INT(cw / (3.9 * F.u)));
  for (let d = 1; d <= n; d++) {
    const i = first + d - 1, x = F.x + (i % 7) * cw, y = gy + INT(i / 7) * ch, k = dayKey(o.m, d);
    b += T(x + 5 * F.u, y + 13 * F.u, d, 10.5 * F.u, { weight: 700, fill: hol[k] ? s.accent : INK });
    let ly = y + 24 * F.u;
    [hol[k], mine[k] ? '♥ ' + mine[k] : ''].filter(Boolean).forEach((t) => { if (ly < y + ch - 3) { b += T(x + 5 * F.u, ly, clip(t, maxc), 6.6 * F.u, { fill: t.startsWith('♥') ? INK : s.accent, italic: !t.startsWith('♥') }); ly += 9 * F.u; } });
  }
  // grey out the empty cells
  for (let i = 0; i < rows * 7; i++) if (i < first || i >= first + n) b += R(F.x + (i % 7) * cw + 0.5, gy + INT(i / 7) * ch + 0.5, cw - 1, ch - 1, { fill: '#f6f6f6' });
  const ny = gy + rows * ch + 14 * F.u;
  b += T(F.x, ny + 6 * F.u, 'NOTES', 8 * F.u, { weight: 700, fill: s.accent, ls: 1 }) + ruled(F.x, ny + 6 * F.u, F.w, notesH - 8 * F.u, 16 * F.u);
  return page(`${MONTHS[o.m]} ${o.y}`, b);
}
function weeksOfSpan() {
  const sp = span(), start = new Date(sp[0].y, sp[0].m, 1), end = new Date(sp[11].y, sp[11].m, daysIn(sp[11].y, sp[11].m));
  const ws = new Date(start); ws.setDate(ws.getDate() - ((ws.getDay() - Number(S.weekStart) + 7) % 7));
  const out = [];
  for (let d = new Date(ws); d <= end; d.setDate(d.getDate() + 7)) {
    const first = d < start ? start : d;
    const idx = sp.findIndex((o) => o.y === first.getFullYear() && o.m === first.getMonth());
    out.push({ start: new Date(d), month: idx });
  }
  return out;
}
const fmtShort = (d) => `${MON3[d.getMonth()]} ${d.getDate()}`;
function weekPage(w) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(w.start); d.setDate(d.getDate() + i); return d; });
  const last = days[6], s = st();
  const title = days[0].getMonth() === last.getMonth() ? `${MONTHS[days[0].getMonth()]} ${days[0].getDate()} – ${last.getDate()}` : `${fmtShort(days[0])} – ${fmtShort(last)}`;
  const F = frame(title, String(last.getFullYear()));
  const mine = parseDates();
  let b = F.b;
  const dayBox = (d, x, y, w, h) => {
    const hol = holidays(S.holidays, d.getFullYear()), k = dayKey(d.getMonth(), d.getDate());
    let r = R(x, y, w, 16 * F.u, { fill: s.soft }) + T(x + 6 * F.u, y + 11.5 * F.u, DAYS[d.getDay()].toUpperCase(), 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 }) + T(x + w - 6 * F.u, y + 11.5 * F.u, d.getDate(), 10 * F.u, { anchor: 'end', weight: 700, fill: s.accent });
    const tags = [hol[k], mine[k] ? '♥ ' + mine[k] : ''].filter(Boolean).join(' · ');
    let top = y + 16 * F.u;
    if (tags) { r += T(x + 6 * F.u, top + 10 * F.u, clip(tags, INT(w / (3.8 * F.u))), 7 * F.u, { fill: s.accent, italic: true }); top += 12 * F.u; }
    r += ruled(x + 4 * F.u, top, w - 8 * F.u, y + h - top - 2 * F.u, 15 * F.u) + R(x, y, w, h, { stroke: '#cfcfcf' });
    return r;
  };
  const gap = 8 * F.u;
  if (S.weeklyLayout === 'list') {
    const lw = F.w * 0.64, rh = (F.h - 6 * gap) / 7;
    days.forEach((d, i) => { b += dayBox(d, F.x, F.y + i * (rh + gap), lw, rh); });
    const tx = F.x + lw + gap * 1.5, tw = F.w - lw - gap * 1.5;
    b += miniMonth(tx + 4 * F.u, F.y + 12 * F.u, tw - 8 * F.u, days[3].getFullYear(), days[3].getMonth(), { mine });
    const ty = F.y + tw * 1.05;
    b += T(tx, ty, 'TO DO', 9 * F.u, { weight: 700, fill: s.accent, ls: 1 });
    for (let yy = ty + 20 * F.u; yy < F.y + F.h - 70 * F.u; yy += 18 * F.u) b += box(tx, yy - 8 * F.u, 8 * F.u) + L(tx + 13 * F.u, yy, tx + tw, yy);
    b += T(tx, F.y + F.h - 54 * F.u, 'NOTES', 9 * F.u, { weight: 700, fill: s.accent, ls: 1 }) + R(tx, F.y + F.h - 46 * F.u, tw, 46 * F.u, { stroke: '#cfcfcf' });
  } else {
    const cw = (F.w - gap) / 2, rh = (F.h - 3 * gap) / 4;
    days.forEach((d, i) => { const c = i < 4 ? 0 : 1, r = i < 4 ? i : i - 4; b += dayBox(d, F.x + c * (cw + gap), F.y + r * (rh + gap), cw, rh); });
    const x = F.x + cw + gap, y = F.y + 3 * (rh + gap);
    b += R(x, y, cw, rh, { stroke: '#cfcfcf' }) + T(x + 6 * F.u, y + 12 * F.u, 'TO DO THIS WEEK', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 });
    for (let yy = y + 30 * F.u; yy < y + rh - 4; yy += 16 * F.u) b += box(x + 6 * F.u, yy - 8 * F.u, 7.5 * F.u) + L(x + 18 * F.u, yy, x + cw - 6 * F.u, yy);
  }
  return page(`Week of ${fmtShort(days[0])}`, b);
}
function habitPage(o) {
  const F = frame('Habit tracker', `${MONTHS[o.m]} ${o.y}`), s = st();
  const habits = String(S.habits || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12);
  while (habits.length < 8) habits.push('');
  const n = daysIn(o.y, o.m), nameW = F.w * 0.25, cw = (F.w - nameW) / n, hh = 18 * F.u, rh = Math.min(30 * F.u, (F.h * 0.72 - hh) / habits.length);
  let b = F.b;
  for (let d = 1; d <= n; d++) {
    const x = F.x + nameW + (d - 0.5) * cw, wd = new Date(o.y, o.m, d).getDay();
    b += T(x, F.y + 8 * F.u, DAYS[wd][0], 6 * F.u, { anchor: 'middle', fill: MUTED }) + T(x, F.y + 16 * F.u, d, 6.5 * F.u, { anchor: 'middle', weight: 700, fill: wd === 0 || wd === 6 ? s.accent : INK });
  }
  habits.forEach((h, i) => {
    const y = F.y + hh + i * rh;
    if (i % 2 === 0) b += R(F.x, y, F.w, rh, { fill: s.soft });
    b += h ? T(F.x + 5 * F.u, y + rh * 0.62, clip(h, INT(nameW / (4.4 * F.u))), 8.5 * F.u) : L(F.x + 5 * F.u, y + rh * 0.72, F.x + nameW - 8 * F.u, y + rh * 0.72);
    for (let d = 1; d <= n; d++) b += C(F.x + nameW + (d - 0.5) * cw, y + rh / 2, Math.min(cw, rh) * 0.32, { fill: '#fff', stroke: s.mid, sw: 0.6 });
  });
  const ty = F.y + hh + habits.length * rh + 26 * F.u, bw = (F.w - 12 * F.u) / 2, bh = F.y + F.h - ty;
  b += T(F.x, ty, 'WINS THIS MONTH', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 }) + ruled(F.x, ty + 2, bw, bh - 4, 16 * F.u);
  b += T(F.x + bw + 12 * F.u, ty, 'NEXT MONTH I WILL…', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 }) + ruled(F.x + bw + 12 * F.u, ty + 2, bw, bh - 4, 16 * F.u);
  return page(`Habits – ${MON3[o.m]}`, b);
}
function table(x, y, w, title, cols, rows, F, rh) {
  const s = st(); rh = rh || 17 * F.u;
  let b = R(x, y, w, 18 * F.u, { fill: s.soft }) + T(x + 6 * F.u, y + 12.5 * F.u, title, 8.5 * F.u, { weight: 700, fill: s.accent, ls: 0.6 });
  let cx = x; const ws = cols.map((c) => c[1] * w);
  cols.forEach((c, i) => { if (i) b += T(cx + ws[i] - 5 * F.u, y + 12.5 * F.u, c[0], 7 * F.u, { anchor: 'end', fill: s.accent, weight: 600 }); cx += ws[i]; });
  rows.forEach((r, i) => {
    const yy = y + 18 * F.u + (i + 1) * rh;
    b += L(x, yy, x + w, yy);
    if (r) b += T(x + 6 * F.u, yy - 5 * F.u, r, 8 * F.u, { fill: r === 'Total' ? s.accent : INK, weight: r === 'Total' ? 700 : 400 });
  });
  let vx = x; ws.slice(0, -1).forEach((cw) => { vx += cw; b += L(vx, y + 18 * F.u, vx, y + 18 * F.u + rows.length * rh, '#e2e2e2'); });
  return { b, h: 18 * F.u + rows.length * rh };
}
function budgetPage(o) {
  const F = frame('Budget', `${MONTHS[o.m]} ${o.y}`), s = st();
  let b = F.b;
  const half = (F.w - 14 * F.u) / 2;
  const inc = table(F.x, F.y, half, 'INCOME', [['', 0.6], ['Amount', 0.4]], ['Pay', 'Pay', 'Other', '', 'Total'], F);
  const sav = table(F.x + half + 14 * F.u, F.y, half, 'SAVINGS & DEBT', [['', 0.6], ['Amount', 0.4]], ['Savings', 'Emergency fund', 'Credit card', '', 'Total'], F);
  b += inc.b + sav.b;
  const y2 = F.y + inc.h + 16 * F.u;
  const bills = ['Rent / mortgage', 'Electricity', 'Water', 'Gas / heating', 'Phone & internet', 'Insurance', 'Car / transport', 'Subscriptions', '', '', 'Total'];
  const spend = ['Groceries', 'Eating out', 'Fuel', 'Kids', 'Health', 'Clothes', 'Gifts', 'Fun', '', '', 'Total'];
  const sumH = 64 * F.u, rh = Math.min(34 * F.u, (F.y + F.h - y2 - 18 * F.u - 18 * F.u - sumH) / bills.length);
  const t1 = table(F.x, y2, half, 'BILLS', [['', 0.5], ['Due', 0.2], ['Paid', 0.3]], bills, F, rh);
  const t2 = table(F.x + half + 14 * F.u, y2, half, 'SPENDING', [['', 0.5], ['Budget', 0.25], ['Spent', 0.25]], spend, F, rh);
  b += t1.b + t2.b;
  const y3 = y2 + Math.max(t1.h, t2.h) + 18 * F.u, bh = Math.min(sumH, F.y + F.h - y3);
  b += R(F.x, y3, F.w, bh, { stroke: s.mid, rx: 6 });
  const items = ['Total income', 'Total bills', 'Total spending', 'Saved', 'Left over'];
  items.forEach((t, i) => { const x = F.x + (i + 0.5) * F.w / items.length; b += T(x, y3 + 16 * F.u, t.toUpperCase(), 7 * F.u, { anchor: 'middle', weight: 700, fill: s.accent, ls: 0.5 }) + L(x - F.w / 12, y3 + bh - 14 * F.u, x + F.w / 12, y3 + bh - 14 * F.u, '#bbb'); });
  return page(`Budget – ${MON3[o.m]}`, b);
}
function mealPage(i) {
  const F = frame('Meal planner', 'Week of ____________'), s = st();
  let b = F.b;
  const gw = F.w * 0.68, meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'], lw = 52 * F.u, cw = (gw - lw) / meals.length, hh = 16 * F.u, rh = (F.h - hh) / 7;
  meals.forEach((m, k) => { b += R(F.x + lw + k * cw, F.y, cw - 2, hh, { fill: s.soft }) + T(F.x + lw + (k + 0.5) * cw, F.y + hh * 0.7, m.toUpperCase(), 7 * F.u, { anchor: 'middle', weight: 700, fill: s.accent, ls: 0.5 }); });
  dows().forEach((d, r) => {
    const y = F.y + hh + r * rh;
    b += T(F.x + 2, y + rh / 2 + 3 * F.u, DAYS[d].slice(0, 3).toUpperCase(), 8.5 * F.u, { weight: 700, fill: s.accent, ls: 0.8 });
    meals.forEach((_, k) => { b += R(F.x + lw + k * cw, y + 2, cw - 2, rh - 4, { stroke: '#d0d0d0', rx: 3 }); });
  });
  const gx = F.x + gw + 12 * F.u, gwid = F.w - gw - 12 * F.u;
  b += R(gx, F.y, gwid, hh, { fill: s.soft }) + T(gx + 6 * F.u, F.y + hh * 0.7, 'GROCERY LIST', 7.5 * F.u, { weight: 700, fill: s.accent, ls: 0.6 });
  for (let yy = F.y + hh + 18 * F.u; yy < F.y + F.h; yy += 15 * F.u) b += box(gx + 2, yy - 7.5 * F.u, 7 * F.u) + L(gx + 13 * F.u, yy, gx + gwid, yy);
  return page(`Meal planner ${i + 1}`, b);
}
function dailyPage(i) {
  const F = frame('Today', 'Date ____________'), s = st();
  let b = F.b;
  const lw = F.w * 0.56, rx = F.x + lw + 14 * F.u, rw = F.w - lw - 14 * F.u;
  b += T(F.x, F.y + 8 * F.u, 'SCHEDULE', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 });
  const hours = 17, hh = (F.h - 18 * F.u) / hours;
  for (let k = 0; k < hours; k++) { const y = F.y + 18 * F.u + k * hh, hr = 6 + k, lab = `${((hr + 11) % 12) + 1} ${hr < 12 ? 'am' : 'pm'}`; b += T(F.x, y + hh * 0.6, lab, 7.5 * F.u, { fill: MUTED }) + L(F.x + 34 * F.u, y + hh, F.x + lw, y + hh) + L(F.x + 34 * F.u, y + hh / 2, F.x + lw, y + hh / 2, '#ececec', 0.5); }
  let y = F.y;
  b += T(rx, y + 8 * F.u, 'TOP 3 PRIORITIES', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 });
  for (let k = 0; k < 3; k++) { const yy = y + 30 * F.u + k * 20 * F.u; b += T(rx, yy, k + 1, 10 * F.u, { weight: 700, fill: s.accent }) + L(rx + 12 * F.u, yy + 2, rx + rw, yy + 2); }
  y += 104 * F.u;
  b += T(rx, y, 'TO DO', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 });
  for (let k = 0; k < 9; k++) { const yy = y + 20 * F.u + k * 16 * F.u; b += box(rx, yy - 8 * F.u, 7.5 * F.u) + L(rx + 12 * F.u, yy, rx + rw, yy); }
  y += 172 * F.u;
  b += T(rx, y, 'WATER', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 });
  for (let k = 0; k < 8; k++) b += R(rx + k * (rw / 8), y + 8 * F.u, rw / 8 - 4 * F.u, 14 * F.u, { stroke: s.mid, rx: 3 });
  y += 42 * F.u;
  b += T(rx, y, 'NOTES & GRATITUDE', 8 * F.u, { weight: 700, fill: s.accent, ls: 0.8 }) + ruled(rx, y + 2, rw, F.y + F.h - y - 4, 15 * F.u);
  return page(`Daily page ${i + 1}`, b);
}
function cleaningPage() {
  const F = frame('Cleaning schedule'), s = st();
  const lists = [['DAILY', ['Make the beds', 'Wash the dishes', 'Wipe kitchen counters', 'Quick tidy up', 'Take out trash if full', 'Sweep the kitchen']], ['WEEKLY', ['Vacuum all floors', 'Mop floors', 'Clean bathrooms', 'Change bed sheets', 'Dust surfaces', 'Laundry', 'Clean the fridge', 'Empty all bins']], ['MONTHLY', ['Clean the oven', 'Wash windows', 'Clean the microwave', 'Wipe doors & switches', 'Clean under furniture', 'Declutter one drawer']], ['EVERY SEASON', ['Wash curtains', 'Clean the gutters', 'Flip the mattress', 'Deep clean the carpets', 'Swap seasonal clothes', 'Check smoke alarms']]];
  const cw = (F.w - 14 * F.u) / 2, ch = (F.h - 14 * F.u) / 2;
  let b = F.b;
  lists.forEach(([t, items], i) => {
    const x = F.x + (i % 2) * (cw + 14 * F.u), y = F.y + INT(i / 2) * (ch + 14 * F.u);
    b += R(x, y, cw, ch, { stroke: s.mid, rx: 6 }) + R(x, y, cw, 20 * F.u, { fill: s.soft, rx: 6 }) + T(x + 8 * F.u, y + 14 * F.u, t, 9 * F.u, { weight: 700, fill: s.accent, ls: 1 });
    let yy = y + 40 * F.u;
    for (let k = 0; yy < y + ch - 8 * F.u; k++, yy += 18 * F.u) { b += box(x + 8 * F.u, yy - 8 * F.u, 8 * F.u) + L(x + 21 * F.u, yy + 2, x + cw - 8 * F.u, yy + 2); if (items[k]) b += T(x + 22 * F.u, yy - 1, items[k], 8.5 * F.u); }
  });
  return page('Cleaning schedule', b);
}
function todoPage(i) {
  const F = frame('To do'), s = st();
  let b = F.b; const cw = (F.w - 16 * F.u) / 2;
  for (let c = 0; c < 2; c++) { const x = F.x + c * (cw + 16 * F.u); for (let yy = F.y + 14 * F.u; yy < F.y + F.h; yy += 19 * F.u) b += box(x, yy - 8.5 * F.u, 8.5 * F.u) + L(x + 14 * F.u, yy + 1, x + cw, yy + 1); }
  return page(`To-do list ${i + 1}`, b);
}
function notesPage(i) {
  const F = frame('Notes'), s = st();
  let b = F.b, g = 14 * F.u;
  if (S.notesType === 'dots') { for (let y = F.y + 4; y <= F.y + F.h; y += g) for (let x = F.x; x <= F.x + F.w + 0.1; x += g) b += C(x, y, 0.75, { fill: '#a8a8a8' }); }
  else if (S.notesType === 'grid') { for (let y = F.y; y <= F.y + F.h + 0.1; y += g) b += L(F.x, y, F.x + F.w, y, '#dedede', 0.4); for (let x = F.x; x <= F.x + F.w + 0.1; x += g) b += L(x, F.y, x, F.y + F.h, '#dedede', 0.4); }
  else b += ruled(F.x, F.y, F.w, F.h, 18 * F.u);
  return page(`Notes ${i + 1}`, b);
}

// ---------- assemble ----------
const isProSection = (k) => (SECTIONS.find((s) => s.k === k) || {}).pro;
function buildPages() {
  const on = S.on, out = [], cnt = (k) => Math.max(1, Math.min(60, Number(S.counts[k]) || 1));
  if (on.cover) out.push(coverPage());
  if (on.year) out.push(yearPage());
  if (on.goals) out.push(goalsPage());
  if (on.dates) out.push(datesPage());
  const weeks = on.weekly ? weeksOfSpan() : [];
  span().forEach((o, i) => {
    if (on.monthly) out.push(monthPage(o));
    if (on.habit) out.push(habitPage(o));
    if (on.budget) out.push(budgetPage(o));
    weeks.filter((w) => w.month === i).forEach((w) => out.push(weekPage(w)));
  });
  if (on.meal) for (let i = 0; i < cnt('meal'); i++) out.push(mealPage(i));
  if (on.daily) for (let i = 0; i < cnt('daily'); i++) out.push(dailyPage(i));
  if (on.cleaning) out.push(cleaningPage());
  if (on.todo) for (let i = 0; i < cnt('todo'); i++) out.push(todoPage(i));
  if (on.notes) for (let i = 0; i < cnt('notes'); i++) out.push(notesPage(i));
  if (!out.length) out.push(page('Empty', `<rect width="${paper().w}" height="${paper().h}" fill="#fff"/>` + T(paper().w / 2, paper().h / 2, 'Tick some pages on the left', 16, { anchor: 'middle', fill: MUTED })));
  return out;
}

// ---------- UI ----------
let toastTimer = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4500); }
let pages = [], cur = 0;
const proTag = (pro) => (pro && !unlocked() ? ' (Pro)' : '');
function renderUI() {
  const y0 = new Date().getFullYear();
  $('year').innerHTML = Array.from({ length: 8 }, (_, i) => y0 - 1 + i).map((y) => `<option>${y}</option>`).join('');
  $('start').innerHTML = MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  $('holidays').innerHTML = HOLIDAY_SETS.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('');
  $('style').innerHTML = Object.entries(STYLES).map(([k, s]) => `<option value="${k}">${esc(s.name)}${proTag(s.pro)}</option>`).join('');
  $('paper').innerHTML = Object.entries(PAPERS).map(([k, p]) => `<option value="${k}">${esc(p.name)}${proTag(p.pro)}</option>`).join('');
  $('sections').innerHTML = SECTIONS.map((s) => `<label class="sec"><input type="checkbox" data-sec="${s.k}"${S.on[s.k] ? ' checked' : ''}><span>${esc(s.n)}${s.pro && !unlocked() ? '<span class="badge">PRO</span>' : ''}<small>${esc(s.d)}</small></span><span class="ctl">${s.opt ? `<select class="cnt sel" data-opt="${s.opt.key}">${s.opt.vals.map(([v, n]) => `<option value="${v}"${S[s.opt.key] === v ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}${s.count ? `<input class="cnt" type="number" min="1" max="60" data-cnt="${s.k}" value="${S.counts[s.k]}" title="How many pages">` : ''}</span></label>`).join('');
  $('title').value = S.title; $('owner').value = S.owner; $('year').value = S.year; $('start').value = S.start; $('weekStart').value = S.weekStart;
  $('holidays').value = S.holidays; $('style').value = S.style; $('paper').value = S.paper; $('twoUp').checked = !!S.twoUp; $('holes').checked = !!S.holes;
  $('twoUpRow').hidden = !paper().pair;
  if (document.activeElement !== $('dates')) $('dates').value = S.dates;
  if (document.activeElement !== $('habits')) $('habits').value = S.habits;
  render();
}
function render() {
  pages = buildPages();
  cur = Math.max(0, Math.min(cur, pages.length - 1));
  $('pgSel').innerHTML = pages.map((p, i) => `<option value="${i}">${i + 1}. ${esc(p.label)}</option>`).join('');
  $('pgSel').value = cur;
  $('pgCount').textContent = `${pages.length} pages`;
  $('preview').innerHTML = pages[cur].svg.replace(/ width="[\d.]+" height="[\d.]+"/, ' preserveAspectRatio="xMidYMid meet"');
  $('pgPrev').disabled = cur === 0; $('pgNext').disabled = cur >= pages.length - 1;
  const P = paper(), sheets = P.pair && S.twoUp ? Math.ceil(pages.length / 2) : pages.length;
  $('info').textContent = `${pages.length} pages · ${sheets} sheets of ${P.pair && S.twoUp ? (P.pair === 'A4' ? 'A4' : 'Letter') : P.sheet === 'A4' ? 'A4' : P.sheet === 'A5' ? 'A5' : P.sheet === 'letter' && P.w < 500 ? 'Half Letter' : 'Letter'} paper` + (P.pair && S.twoUp ? ' – cut each sheet in half' : '') + '. Tip: choose “Save as PDF” in the print window to keep a PDF copy.';
}
let renderTimer = 0;
const soon = () => { clearTimeout(renderTimer); renderTimer = setTimeout(render, 200); };

function proProblems() {
  if (unlocked()) return '';
  const used = [];
  if (st().pro) used.push(`the ${st().name} style`);
  if (paper().pro) used.push(`the ${paper().name} size`);
  SECTIONS.filter((s) => s.pro && S.on[s.k]).forEach((s) => used.push(s.n.toLowerCase()));
  return used.length ? `Your planner uses ${used.join(', ')} – part of PlanPress Pro. Unlock Pro, or untick the Pro pages and pick the Simple or Sage style.` : '';
}
function printNow() {
  const why = proProblems(); if (why) { openPro(why); return; }
  const P = paper(); let out, size;
  const ids = (svg, i) => svg.replace(/id="([^"]+)"/g, `id="$1_p${i}"`).replace(/url\(#([^)]+)\)/g, `url(#$1_p${i})`);
  if (P.pair && S.twoUp) {
    const [sw, sh] = P.pair === 'A4' ? [841.9, 595.3] : [792, 612];
    size = `${P.pair} landscape`; out = [];
    for (let i = 0; i < pages.length; i += 2) {
      const inner = (p, x) => (p ? `<svg x="${x}" y="${f1((sh - P.h) / 2)}" width="${f1(P.w)}" height="${f1(P.h)}" viewBox="0 0 ${f1(P.w)} ${f1(P.h)}">${p.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>` : '');
      out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sw} ${sh}" style="width:${f1(sw / 72)}in;height:${f1(sh / 72)}in;display:block;page-break-after:always">${inner(pages[i], f1(sw / 2 - P.w))}${inner(pages[i + 1], f1(sw / 2))}${L(sw / 2, 4, sw / 2, 18, '#999', 0.6)}${L(sw / 2, sh - 18, sw / 2, sh - 4, '#999', 0.6)}</svg>`);
    }
  } else {
    size = P.w < 500 ? `${f1(P.w / 72)}in ${f1(P.h / 72)}in` : `${P.sheet} portrait`;
    if (S.paper === 'a5') size = 'A5 portrait';
    out = pages.map((p) => p.svg.replace(/ width="([\d.]+)" height="([\d.]+)"/, (_, w, h) => ` style="width:${(w / 72).toFixed(3)}in;height:${(h / 72).toFixed(3)}in;display:block;page-break-after:always"`));
  }
  out = out.map(ids);
  $('pageRule').textContent = `@page { size: ${size}; margin: 0; }`;
  $('printArea').innerHTML = out.join('');
  window.print();
  setTimeout(() => { $('pageRule').textContent = ''; $('printArea').innerHTML = ''; }, 1500);
}

// ---------- wiring ----------
const bindText = (id, key) => $(id).addEventListener('input', (e) => { S[key] = e.target.value; save(); soon(); });
bindText('title', 'title'); bindText('owner', 'owner'); bindText('dates', 'dates'); bindText('habits', 'habits');
['year', 'start', 'weekStart'].forEach((id) => { $(id).onchange = (e) => { S[id] = Number(e.target.value); save(); render(); }; });
$('holidays').onchange = (e) => { S.holidays = e.target.value; save(); render(); };
$('style').onchange = (e) => { S.style = e.target.value; save(); render(); if (st().pro && !unlocked()) toast('This style is part of Pro – look around freely; printing it needs Pro.'); };
$('paper').onchange = (e) => { S.paper = e.target.value; save(); $('twoUpRow').hidden = !paper().pair; render(); if (paper().pro && !unlocked()) toast('This size is part of Pro – you can preview it; printing it needs Pro.'); };
$('twoUp').onchange = (e) => { S.twoUp = e.target.checked; save(); render(); };
$('holes').onchange = (e) => { S.holes = e.target.checked; save(); render(); };
$('sections').addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.sec) { S.on[t.dataset.sec] = t.checked; if (t.checked && isProSection(t.dataset.sec) && !unlocked()) toast('These pages are part of Pro – you can preview them; printing them needs Pro.'); }
  else if (t.dataset.cnt) S.counts[t.dataset.cnt] = Math.max(1, Math.min(60, Number(t.value) || 1));
  else if (t.dataset.opt) S[t.dataset.opt] = t.value;
  save(); render();
  if (t.dataset.sec && t.checked) { const i = pages.findIndex((p) => p.label.toLowerCase().startsWith((SECTIONS.find((s) => s.k === t.dataset.sec).n.split(' ')[0]).toLowerCase())); if (i >= 0) { cur = i; render(); } }
});
$('pgSel').onchange = (e) => { cur = Number(e.target.value); render(); };
$('pgPrev').onclick = () => { cur -= 1; render(); };
$('pgNext').onclick = () => { cur += 1; render(); };
document.addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if (e.key === 'ArrowRight' && cur < pages.length - 1) { cur++; render(); } if (e.key === 'ArrowLeft' && cur > 0) { cur--; render(); } });
$('printBtn').onclick = printNow;
$('moreBtn').onclick = (e) => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
document.addEventListener('click', () => { $('menu').hidden = true; });
$('resetBtn').onclick = () => { if (!confirm('Go back to the default planner? Your dates and habits will be cleared.')) return; S = blank(); save(); cur = 0; renderUI(); };
$('proBtn').onclick = () => { if (!isPro) openPro(''); };
$('buyBtn').onclick = buyPro;
$('restoreBtn').onclick = async () => { proMessage('Checking your purchases…'); proMessage((await checkPro()) ? 'Pro is unlocked. ★' : 'No Pro purchase was found on this Microsoft account.'); };
$('closePro').onclick = () => $('proDialog').close();

load();
renderUI();
checkPro();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
