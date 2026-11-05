/* Mielie & Ruru - a tiny kingdom adventure. Plain JS, canvas only, no network. */
'use strict';
/* Shared global script scope: js/forge.js (loaded after this file) adds the gear & Forge code. */
const qs = new URLSearchParams(location.search);
const SPEED = Math.max(0.25, Math.min(10, parseFloat(qs.get('speed')) || 1));
const SAVE_KEY = 'mielie-ruru-save-v1'; // key kept forever; payload has its own version (S.v)
const SAVE_VERSION = 5;
const REGROW = 12 / SPEED;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, T = 64, now = 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const TAU = Math.PI * 2;
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ---------------- Sound (WebAudio synth) ---------------- */
const Snd = {
  ctx: null, master: null, on: true,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; }
  },
  tone(f, d, type = 'sine', v = 0.3, f2 = null, delay = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
  },
  noise(d, v = 0.25, freq = 1000, delay = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay, n = Math.floor(c.sampleRate * d);
    const b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.value = v; s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  },
  tap() { this.tone(720, 0.06, 'sine', 0.12, 980); },
  pop() { this.tone(520, 0.12, 'sine', 0.3, 1250); },
  collect() { this.tone(660, 0.1, 'triangle', 0.28); this.tone(990, 0.16, 'triangle', 0.28, null, 0.07); },
  chop() { this.noise(0.09, 0.45, 900); this.tone(190, 0.1, 'square', 0.1, 95); },
  rock() { this.noise(0.12, 0.45, 450); this.tone(130, 0.14, 'triangle', 0.3, 70); },
  slash() { this.noise(0.18, 0.35, 2500); this.tone(900, 0.15, 'sawtooth', 0.06, 300); },
  magic() { [880, 1175, 1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.14, null, i * 0.055)); },
  build() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'square', 0.09, null, i * 0.085)); this.tone(1046, 0.45, 'triangle', 0.25, null, 0.34); },
  nope() { this.tone(300, 0.11, 'square', 0.09, 220); this.tone(220, 0.18, 'square', 0.09, 160, 0.12); },
  munch() { this.noise(0.06, 0.4, 700); this.noise(0.06, 0.4, 600, 0.13); this.tone(420, 0.12, 'sine', 0.2, 700, 0.26); },
  step() { this.tone(240, 0.035, 'sine', 0.04, 190); },
  swap() { this.tone(440, 0.1, 'sine', 0.25, 880); this.tone(660, 0.12, 'sine', 0.2, 1320, 0.1); },
  scrape() { this.noise(0.22, 0.3, 300); },
  boom() { this.noise(0.4, 0.6, 250); this.tone(95, 0.45, 'sine', 0.45, 40); },
  fanfare() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => { this.tone(f, 0.32, 'square', 0.07, null, i * 0.15); this.tone(f / 2, 0.3, 'triangle', 0.14, null, i * 0.15); }); },
  bonk() { this.tone(700, 0.08, 'square', 0.12, 1400); this.tone(180, 0.2, 'triangle', 0.35, 90, 0.03); this.tone(1500, 0.3, 'sine', 0.1, 2400, 0.1); },
  poof() { this.noise(0.25, 0.4, 1800); [1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.12, null, 0.08 + i * 0.06)); },
  zap() { this.tone(1800, 0.18, 'sawtooth', 0.06, 220); this.tone(900, 0.12, 'square', 0.05, 2600, 0.02); this.noise(0.12, 0.35, 3500, 0.05); this.noise(0.3, 0.3, 900, 0.16); [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.14, 'sine', 0.08, null, 0.2 + i * 0.05)); },
  hmph() { this.tone(330, 0.09, 'triangle', 0.2, 260); this.tone(392, 0.14, 'triangle', 0.18, 300, 0.1); },
  boing() { this.tone(160, 0.25, 'sine', 0.35, 520); },
  groan(v = 0.5) { this.tone(130, 0.7, 'sawtooth', 0.05 * v * 2, 95); this.tone(196, 0.7, 'triangle', 0.12 * v * 2, 150); },
  roar() { this.tone(200, 0.3, 'sawtooth', 0.08, 420); this.tone(300, 0.25, 'triangle', 0.15, 600, 0.05); },
  twang() { this.tone(180, 0.22, 'triangle', 0.3, 120); this.tone(620, 0.12, 'sine', 0.1, 1400, 0.02); this.noise(0.08, 0.2, 2600, 0.01); },
  thunk() { this.tone(260, 0.1, 'square', 0.12, 140); this.noise(0.06, 0.35, 1200); [1568, 2093].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.1, null, 0.06 + i * 0.06)); },
  page() { this.noise(0.12, 0.2, 2200); this.tone(520, 0.1, 'sine', 0.12, 780, 0.04); },
};

/* ---------------- Images ---------------- */
const IMG = {};
const IMG_SRC = { mielie: 'assets/mielie_full.png', ruru: 'assets/ruru_full.png', mielieHead: 'assets/mielie_head.png', ruruHead: 'assets/ruru_head.png', lillie: 'assets/lillie_full.png', lillieHead: 'assets/lillie_head.png', queen: 'assets/queen_full.png', queenHead: 'assets/queen_head.png',
  zombie_plain: 'assets/zombie_plain.png', zombie_bucket: 'assets/zombie_bucket.png', zombie_pumpkin: 'assets/zombie_pumpkin.png', zombie_king: 'assets/zombie_king.png', zombie_king_nocrown: 'assets/zombie_king_nocrown.png' };
function loadImages() {
  return Promise.all(Object.entries(IMG_SRC).map(([k, s]) => new Promise(res => {
    const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => res(); i.src = s;
  })));
}
let scaled = {};
function sprite(key, h) {
  const ph = Math.max(8, Math.round(h * DPR)); const id = key + ph;
  if (scaled[id]) return scaled[id];
  const im = IMG[key]; if (!im) return null;
  let src = im, sw = im.width, sh = im.height;
  while (sh / 2 > ph) {
    const t = document.createElement('canvas'); t.width = Math.round(sw / 2); t.height = Math.round(sh / 2);
    const g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, t.width, t.height);
    src = t; sw = t.width; sh = t.height;
  }
  const c = document.createElement('canvas'); c.height = ph; c.width = Math.round(sw * ph / sh);
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
  c.dw = c.width / DPR; c.dh = c.height / DPR; scaled[id] = c; return c;
}

/* ---------------- Levels (data-driven, see js/levels.js) ---------------- */
const DATA = window.MR_DATA;
const AREA_IDS = DATA.chapters.flatMap(c => c.areas);
const LEVELS = AREA_IDS.map(id => Object.assign({ id }, DATA.areas[id]));
const OBJCH = { T: 'tree', R: 'rock', C: 'corn', B: 'bud', X: 'thorn', H: 'bridge', K: 'bench', O: 'boulder', D: 'dragon', N: 'troll',
  M: 'block', P: 'plate', G: 'gate', L: 'lantern', Y: 'crystal', r: 'gem', E: 'exit', Q: 'gemgate', Z: 'crown', k: 'king', x: 'thorn', l: 'lantern', J: 'target', U: 'drawbridge', F: 'hanging' };
const WALK = { '.': 1, ',': 1, '=': 1, '_': 1, 'b': 1, 'p': 1 };
const TALL = { '#': 1, '^': 1, 'W': 1 };
const GEMS = ['b', 'r', 'y'];            // order of slots on the gem gate
const GEMCOL = { r: '#ff4d6d', b: '#3fa9ff', y: '#ffd23f' };
/* the party (switch order, tools, colours) comes from levels.js */
const HERO_DEFS = DATA.heroes || [{ id: 'mielie', tool: 'wand', color: '#ff8fc4' }, { id: 'ruru', tool: 'sword', color: '#6cb8ff' }];
const HERO_ORDER = HERO_DEFS.map(d => d.id);
const HERO = {}; HERO_DEFS.forEach(d => HERO[d.id] = d);
const ARCHER = (HERO_DEFS.find(d => d.ranged) || {}).id || null;
const SISTER = (DATA.npcs && DATA.npcs.sister) || { alias: 'Lillie-Bee', hero: 'lillie' };

/* ---------------- State ---------------- */
let S = null, L = null, heroes = {}, nextId = 1;
const cam = { x: 0, y: 0, tx: 0, ty: 0 };
let particles = [], floaters = [], bubbles = [], timers = [], ripples = [], decor = [], zaps = [];
let scene = 'loading', popup = null, trans = null, banner = null, idle = 0, shakeAmt = 0, switchPulse = 0, confirmNew = false, endT = 0;
let hintCache = { t: -1, v: null };
/* boss fight, super-move cinematic and mini-game state (code in js/villains.js, js/power.js, js/minigames.js) */
let fight = null, cine = null, MG = null;
const pillBounce = {}, pend = {};
const UI = {};

function freshState() { return { v: SAVE_VERSION, level: 0, unlocked: 1, chapter: 0, inv: { wood: 0, stone: 0, mielie: 0, flower: 0 }, gems: { r: false, b: false, y: false }, pick: false, done: false, active: 'mielie', areas: {}, heroes: null, sound: true, zombiesBonked: 0, quests: {}, introSeen: false, gear: freshGear(), pieces: {}, twist: null, minis: {}, power: 0 }; }
function makeObj(type, x, y) {
  const o = { id: nextId++, type, x, y };
  if (type === 'tree' || type === 'rock' || type === 'crystal') o.hp = 2;
  if (type === 'boulder') o.hp = 3;
  if (type === 'dragon' || type === 'troll') { o.fed = 0; o.need = 3; }
  if (type === 'gem') o.color = 'r';
  if (type === 'gemgate') o.slots = [0, 0, 0];
  if (type === 'king') { o.hp = HERO_ORDER.length; o.hits = []; }
  return o;
}
function expandRoute(wp) {
  const out = [{ x: wp[0][0], y: wp[0][1] }];
  for (let k = 1; k < wp.length; k++) {
    let { x, y } = out[out.length - 1]; const tx = wp[k][0], ty = wp[k][1];
    while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); out.push({ x, y }); }
  }
  return out;
}
function buildLevel(i) {
  const def = LEVELS[i], grid = [], objs = [], starts = {};
  def.map.forEach((row, y) => {
    const r = [];
    [...row].forEach((ch, x) => {
      let g = '.';
      if ('#^W~.,=_v'.includes(ch)) g = ch;
      else if (ch === 'S') starts.mielie = { x, y };
      else if (ch === 's') starts.ruru = { x, y };
      else if (ch === 'A') starts.lillie = { x, y };
      else {
        if (ch === 'H') g = '~'; else if (ch === 'N') g = 'b'; else if (ch === 'G') g = '='; else if (ch === 'Q' || ch === 'Z') g = '_'; else if (ch === 'U') g = 'v';
        if (OBJCH[ch]) { const o = makeObj(OBJCH[ch], x, y); if (ch === 'x') o.power = 2; if (ch === 'l') o.magic = 2;
          if (ch === 'F') o.reward = Object.assign({ res: 'mielie', n: 2 }, (def.hanging || {})[x + ',' + y]);
          objs.push(o); }
      }
      r.push(g);
    });
    grid.push(r);
  });
  (def.zombies || []).forEach(z => {
    const route = expandRoute(z.route); const o = makeObj('zombie', route[0].x, route[0].y);
    o.kind = z.kind || 'plain'; o.route = route; o.ri = 0; o.rd = 1; if (z.guards) o.guards = z.guards; objs.push(o);
  });
  if (def.boss && DATA.bosses && DATA.bosses[def.boss.id] && !(S && S.pieces && S.pieces[DATA.bosses[def.boss.id].piece])) {
    const b = makeObj('boss', def.boss.at[0], def.boss.at[1]); b.boss = def.boss.id; b.hits = []; objs.push(b);
  }
  return { i, id: def.id, rev: def.rev || 1, w: def.map[0].length, h: def.map.length, grid, objs, starts, flags: {} };
}
const SAVE_KEYS = ['type', 'x', 'y', 'hp', 'dep', 'fed', 'need', 'lit', 'open', 'color', 'slots', 'pressed', 'taken', 'kind', 'route', 'ri', 'rd', 'last', 'power', 'magic', 'guards', 'hits', 'hit', 'shot', 'reward', 'boss', 'who', 'cleared', 'minion'];
function serialize(l) {
  return { rev: l.rev, grid: l.grid.map(r => r.join('')), starts: l.starts, flags: l.flags,
    objs: l.objs.filter(o => !o.gone && !o.minion).map(o => { const s = {}; SAVE_KEYS.forEach(k => { if (o[k] !== undefined) s[k] = o[k]; }); return s; }) };
}
function inflate(i, s) {
  if (!s.grid || (s.rev || 1) !== (LEVELS[i].rev || 1)) return buildLevel(i); // map changed in a new version: rebuild area
  const l = { i, id: LEVELS[i].id, rev: s.rev || 1, grid: s.grid.map(r => [...r]), starts: s.starts, flags: s.flags || {}, objs: s.objs.map(o => Object.assign({ id: nextId++ }, o)) };
  l.w = l.grid[0].length; l.h = l.grid.length;
  l.objs.forEach(o => { if (o.dep) o.regrow = now + REGROW * 0.5; });
  return l;
}
function persist() {
  if (!S) return;
  if (L) { S.areas[L.id] = serialize(L); S.heroes = {}; for (const n in heroes) S.heroes[n] = { x: heroes[n].x, y: heroes[n].y }; }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v) return migrate(s); } catch (e) {}
  return null;
}
/* Save migrations: each step upgrades one version. Unknown fields are kept so newer data survives. */
const MIGRATIONS = {
  1: s => { s.areas = {}; Object.keys(s.levels || {}).forEach(k => { if (AREA_IDS[k]) s.areas[AREA_IDS[k]] = s.levels[k]; }); delete s.levels; s.unlocked = (s.level || 0) + 1; s.v = 2; return s; },
  2: s => { s.gear = s.gear || {}; s.v = 3; return s; },  // v3: gear & upgrades
  // v4: Lillie-Bee joins (third hero, bow in gear, intro story, area quests). Players who already started skip the intro.
  3: s => { s.gear = s.gear || {}; s.introSeen = !!(s.unlocked > 1 || Object.keys(s.areas || {}).length); s.quests = s.quests || {}; s.v = 4; return s; },
  // v5: villain bosses + Star-Elder Wand pieces, the Evil Queen twist, resource mini-games, power meter
  4: s => { s.pieces = s.pieces || {}; s.twist = s.twist || null; s.minis = s.minis || {}; s.power = s.power || 0; s.v = 5; return s; }
};
function migrate(s) {
  while (s.v < SAVE_VERSION && MIGRATIONS[s.v]) s = MIGRATIONS[s.v](s);
  const f = freshState(); s = Object.assign(f, s); s.inv = Object.assign(f.inv, s.inv); s.gems = Object.assign({ r: false, b: false, y: false }, s.gems); s.gear = fixGear(s.gear);
  if (!HERO_ORDER.includes(s.active)) s.active = HERO_ORDER[0]; s.quests = s.quests || {}; s.pieces = s.pieces || {}; s.minis = s.minis || {};
  if (s.twist === 'queen' && s.active === ARCHER) s.active = HERO_ORDER[0];
  s.level = clamp(s.level | 0, 0, LEVELS.length - 1); s.unlocked = clamp(Math.max(s.unlocked | 0, s.level + 1), 1, LEVELS.length);
  return s;
}
function makeHero(name, p) { return { name, x: p.x, y: p.y, fx: p.x, fy: p.y, path: [], action: null, facing: name === 'mielie' ? -1 : 1, walkT: 0, squash: 0, stuck: 0 }; }
function enterLevel(i, useSavedHeroes) {
  S.level = i;
  const id = LEVELS[i].id; L = S.areas[id] ? inflate(i, S.areas[id]) : buildLevel(i);
  S.unlocked = Math.max(S.unlocked || 1, i + 1);
  const st = L.starts;
  const hp = useSavedHeroes && S.heroes ? S.heroes : null;
  // a start tile for every hero: missing ones stand next to the first hero
  fight = null; cine = null;
  for (const n of HERO_ORDER) if (!st[n]) { const b = st[HERO_ORDER[0]] || st.mielie; const t = nbrs(b).find(q => inBounds(q.x, q.y) && WALK[L.grid[q.y][q.x]] && !L.objs.some(o => o.x === q.x && o.y === q.y && blocks(o))); st[n] = t || { x: b.x, y: b.y }; }
  heroes = {}; for (const n of HERO_ORDER) if (heroAvail(n)) heroes[n] = makeHero(n, hp && hp[n] ? hp[n] : st[n]);
  if (!heroes[S.active]) S.active = partyNames()[0];
  for (const n in heroes) { const h = heroes[n]; if (!walkable(h.x, h.y)) { h.x = h.fx = st[n].x; h.y = h.fy = st[n].y; } }
  particles = []; floaters = []; bubbles = []; ripples = []; decor = []; zaps = []; arrows = []; popup = null; hintCache.t = -1;
  for (const k in pend) pend[k] = 0;
  layout(); updateCam(0, true);
  banner = { t: 0, i };
  questCard = null; questGiverHook(LEVELS[i]);
  twistOnEnter();
  persist();
}
/* Lillie-Bee's quest card: her portrait + a speech bubble of icons, shown the first time an area starts
 * (S.quests[areaId].seen) and again whenever her HUD button is tapped. */
let questCard = null;
function questGiverHook(area, force) {
  const q = area && area.quest; if (!q) return null;
  const qs_ = S.quests[area.id] = S.quests[area.id] || {};
  if (qs_.seen && !force) return null;
  qs_.seen = true; questCard = { area, t: 0 }; later(0.3, () => Snd.pop());
  return questCard;
}
function lvlObjs(type) { return L.objs.filter(o => o.type === type && !o.gone); }
function objAt(x, y, pred) { for (const o of L.objs) if (!o.gone && o.x === x && o.y === y && (!pred || pred(o))) return o; return null; }
function blocks(o) {
  if (o.gone) return false;
  switch (o.type) { case 'plate': case 'exit': case 'gem': return false; case 'gate': case 'gemgate': return !o.open; case 'hanging': return !o.shot; default: return true; }
}
function inBounds(x, y) { return x >= 0 && y >= 0 && x < L.w && y < L.h; }
function walkable(x, y) {
  if (!inBounds(x, y) || !WALK[L.grid[y][x]]) return false;
  for (const o of L.objs) if (o.x === x && o.y === y && blocks(o)) return false;
  return true;
}
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function nbrs(o) { return DIRS.map(d => ({ x: o.x + d[0], y: o.y + d[1] })); }
function findPath(from, goals) {
  const w = L.w, h = L.h, prev = new Int32Array(w * h).fill(-2);
  const goalSet = new Set(goals.filter(g => inBounds(g.x, g.y)).map(g => g.y * w + g.x));
  if (!goalSet.size) return null;
  const s = from.y * w + from.x; prev[s] = -1; const q = [s];
  let found = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]; if (goalSet.has(c)) { found = c; break; }
    const cx = c % w, cy = (c / w) | 0;
    for (const d of DIRS) {
      const nx = cx + d[0], ny = cy + d[1]; if (!inBounds(nx, ny)) continue; const ni = ny * w + nx;
      if (prev[ni] !== -2 || !walkable(nx, ny)) continue; prev[ni] = c; q.push(ni);
    }
  }
  if (found < 0) return null;
  const path = []; let c = found;
  while (c !== s) { path.unshift({ x: c % w, y: (c / w) | 0 }); c = prev[c]; }
  return path;
}
function adjacent(h, o) { return Math.abs(h.x - o.x) + Math.abs(h.y - o.y) === 1; }
function later(sec, fn) { timers.push({ t: sec, fn }); }

/* ---------------- Feedback helpers ---------------- */
function w2s(x, y) { return { x: cam.x + x * T, y: cam.y + y * T }; }
function burst(x, y, kind, n, spread = 1) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), sp = rnd(0.6, 2.4) * spread;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'heart' ? 1 : 1.2), g: kind === 'spark' || kind === 'heart' || kind === 'glitter' ? 0.5 : kind === 'sdust' ? -0.6 : 5,
      life: rnd(0.5, 1.0), max: 1, kind, rot: rnd(0, TAU), vr: rnd(-6, 6), size: rnd(0.06, 0.12),
      color: kind === 'confetti' ? ['#ff4d6d', '#ffd23f', '#3fa9ff', '#7bd85a', '#b06bff', '#ff9ed2'][i % 6] : null });
  }
}
function pillPos(res) { if (res === 'wand' && UI.wand) return { x: UI.wand.x + UI.wand.w / 2, y: UI.wand.y + UI.wand.h / 2 }; const p = UI.pills && UI.pills.find(p => p.res === res); return p ? { x: p.x + p.w * 0.35, y: p.y + p.h / 2 } : { x: W / 2, y: 30 }; }
function gain(res, n, o, icon) {
  const from = w2s(o.x + 0.5, o.y + 0.2);
  for (let k = 0; k < n; k++) {
    pend[res] = (pend[res] || 0) + 1;
    floaters.push({ icon: icon || res, from, to: pillPos(res), t: -k * 0.12, dur: 0.7, done: () => { pend[res]--; pillBounce[res] = 1; Snd.pop(); } });
  }
}
function spend(res, n, o) {
  S.inv[res] -= n; pillBounce[res] = 1;
  const to = w2s(o.x + 0.5, o.y + 0.4);
  for (let k = 0; k < n; k++) floaters.push({ icon: res, from: pillPos(res), to, t: -k * 0.1, dur: 0.55, done: () => Snd.tap() });
}
function tempBubble(o, items, dur = 1.8) { bubbles = bubbles.filter(b => b.o !== o); bubbles.push({ o, x: o.x, y: o.y, items, t: 0, dur }); }
// Mielie's feisty wand zap: lightning bolt from her wand, then a sparkly dust cloud with glitter
function zapFx(h, o, big) {
  h.facing = o.x >= h.x ? 1 : (o.x < h.x ? -1 : h.facing); h.cast = 1; h.feisty = 1;
  zaps.push({ x0: h.x + 0.5 + (h.facing || 1) * 0.35, y0: h.y - 0.05, x1: o.x + 0.5, y1: o.y + 0.35, t: 0 });
  Snd.zap(); shakeAmt = big ? 6 : 3;
  later(0.15, () => { Snd.hmph(); tempBubble(h, [{ text: 'Hmph!' }], 1.3); });
}
/** a bonked zombie spins away and pops into sparkly dust mid-air (follows the drawZombie bonk arc) */
function bonkDust(o) { const t = o.bonk || 0.7; dustCloud(o.x + 0.5 + (o.bdir || 1) * t * 3, o.y + 0.4 - Math.sin(Math.min(t, 1) * Math.PI) * 1.6 - t, 16); }
function dustCloud(x, y, n) { if (typeof fxRing === 'function') { fxRing(x, y + 0.3, '#ffd6fa', 1.1, 0.5, 7); fxRing(x, y + 0.3, '#fff6a0', 0.7, 0.35, 5); } burst(x, y - 0.3, 'star', Math.round(n * 0.35), 1.6); burst(x, y, 'sdust', n, 1.1); burst(x, y - 0.1, 'glitter', Math.round(n * 1.3), 1.8); burst(x, y, 'spark', Math.round(n * 0.5), 1.4); }
function wrongHero(o, need) { Snd.nope(); o.shake = 1; switchPulse = 2.5; tempBubble(o, [{ head: need }, { icon: (HERO[need] || {}).tool || 'wand' }]); }
function face(h, o) { if (o.x !== h.x) h.facing = o.x > h.x ? 1 : -1; h.squash = 1; }

/* ---------------- Interactions ---------------- */
function needBubble(o, res, n) { Snd.nope(); o.shake = 1; tempBubble(o, [{ icon: res, n, have: res === 'pick' ? (S.pick ? 1 : 0) : S.inv[res] }]); }
function deplete(o) { o.dep = true; o.regrow = now + REGROW; }
function interact(h, o) {
  face(h, o); idle = 0; hintCache.t = -1;
  const isR = h.name === 'ruru', isM = h.name === 'mielie', isL = h.name === ARCHER;
  if (isL && arrowable(o)) { shoot(h, o); return; }
  switch (o.type) {
    case 'boss': if (bossCanHit(h, o)) bossHit(h, o); break;
    case 'mirror': hitMirror(h, o); break;
    case 'queen': queenTalk(h, o); break;
    case 'tree':
      if (o.dep) { Snd.nope(); tempBubble(o, [{ icon: 'clock' }], 1); return; }
      Snd.chop(); o.shake = 1; S.inv.wood++; gain('wood', 1, o); addPower('collect'); burst(o.x + 0.5, o.y + 0.3, 'leaf', 8);
      if (--o.hp <= 0) deplete(o); break;
    case 'rock':
      if (o.dep) { Snd.nope(); tempBubble(o, [{ icon: 'clock' }], 1); return; }
      Snd.rock(); o.shake = 1; S.inv.stone++; gain('stone', 1, o); addPower('collect'); burst(o.x + 0.5, o.y + 0.5, 'dust', 8);
      if (--o.hp <= 0) deplete(o); break;
    case 'corn':
      if (o.dep) { Snd.nope(); tempBubble(o, [{ icon: 'clock' }], 1); return; }
      Snd.collect(); S.inv.mielie++; gain('mielie', 1, o); addPower('collect'); burst(o.x + 0.5, o.y + 0.4, 'spark', 8); deplete(o); break;
    case 'bud':
      if (o.dep) { Snd.nope(); tempBubble(o, [{ icon: 'clock' }], 1); return; }
      if (!isM) return wrongHero(o, 'mielie');
      Snd.magic(); h.cast = 1; o.bloom = 1; { const n = 1 + gearStat('bloom', 'mielie'); S.inv.flower += n; gain('flower', n, o); } burst(o.x + 0.5, o.y + 0.4, 'spark', 16); deplete(o); break;
    case 'thorn':
      if (!isR) return wrongHero(o, 'ruru');
      if ((o.power || 1) > gearStat('power', 'ruru')) return gearBubble(o, 'sword', needTier('sword', 'power', o.power));
      Snd.slash(); h.cast = 1; burst(o.x + 0.5, o.y + 0.5, 'leaf', 18, 1.4); o.gone = true; break;
    case 'bridge':
      if (lvlObjs('zombie').some(z => z.guards === 'bridge' && !z.bonk && !z.poof)) {
        // a zombie is standing on the far bank: only Lillie-Bee's arrow reaches it
        const z = lvlObjs('zombie').find(z => z.guards === 'bridge'); z.shake = 1; z.chomp = 1; Snd.nope(); Snd.groan(0.4); switchPulse = 2.5;
        tempBubble(o, [{ icon: 'zombie' }, { icon: 'arrow' }, { head: ARCHER }, { icon: 'bow' }], 2.2); return;
      }
      if (S.inv.wood < 5) return needBubble(o, 'wood', 5);
      spend('wood', 5, o); later(0.6, () => { Snd.build(); L.grid[o.y][o.x] = 'b'; o.gone = true; burst(o.x + 0.5, o.y + 0.5, 'spark', 24, 1.5); shakeAmt = 6; persist(); }); break;
    case 'bench':
      if (S.pick) { Snd.tap(); tempBubble(o, [{ icon: 'pick' }, { icon: 'check' }], 1.2); return; }
      if (S.inv.wood < 2 || S.inv.stone < 2) { Snd.nope(); o.shake = 1; tempBubble(o, [{ icon: 'wood', n: 2, have: S.inv.wood }, { icon: 'stone', n: 2, have: S.inv.stone }]); return; }
      spend('wood', 2, o); spend('stone', 2, o);
      later(0.6, () => { Snd.build(); S.pick = true; burst(o.x + 0.5, o.y + 0.3, 'spark', 24, 1.4); floaters.push({ icon: 'pick', from: w2s(o.x + 0.5, o.y), to: pillPos('pick'), t: 0, dur: 0.9, big: true, done: () => { pillBounce.pick = 1; Snd.pop(); } }); persist(); }); break;
    case 'boulder': case 'crystal':
      if (!S.pick) return needBubble(o, 'pick', 1);
      Snd.rock(); o.shake = 1; h.cast = 1; burst(o.x + 0.5, o.y + 0.5, o.type === 'crystal' ? 'spark' : 'dust', 12); shakeAmt = 3;
      if (--o.hp <= 0) {
        Snd.boom(); o.gone = true; burst(o.x + 0.5, o.y + 0.5, 'dust', 26, 1.8); shakeAmt = 8;
        if (o.type === 'crystal') { const g = makeObj('gem', o.x, o.y); g.color = 'b'; g.pop = 1; L.objs.push(g); Snd.magic(); }
      } break;
    case 'dragon': case 'troll': {
      const res = o.type === 'dragon' ? 'mielie' : 'flower';
      if (o.leaving) return;
      if (S.inv[res] < 1) return needBubble(o, res, o.need - o.fed);
      spend(res, 1, o);
      later(0.5, () => {
        Snd.munch(); o.fed++; o.chomp = 1; burst(o.x + 0.5, o.y + 0.3, 'heart', 5);
        if (o.fed >= o.need) { Snd.roar(); o.leaving = 1; later(1.4 / Math.min(SPEED, 2), () => { o.gone = true; Snd.build(); persist(); }); }
        else tempBubble(o, [{ icon: res, n: o.need - o.fed, have: S.inv[res] }], 1.4);
      }); break; }
    case 'lantern':
      if (o.lit) { Snd.tap(); return; }
      if (!isM) return wrongHero(o, 'mielie');
      if ((o.magic || 1) > gearStat('magic', 'mielie')) return gearBubble(o, 'wand', needTier('wand', 'magic', o.magic));
      Snd.magic(); h.cast = 1; o.lit = true; burst(o.x + 0.5, o.y + 0.2, 'spark', 18);
      if (lvlObjs('lantern').every(l => l.lit)) later(0.6, () => { const g = makeObj('gem', 4, 5); g.color = 'y'; g.pop = 1; L.objs.push(g); Snd.magic(); burst(4.5, 5.5, 'spark', 30, 1.6); persist(); });
      break;
    case 'block': pushBlock(h, o); break;
    case 'gate': if (!o.open) { Snd.nope(); o.shake = 1; const p = lvlObjs('plate')[0]; if (p) tempBubble(o, [{ icon: 'block' }, { icon: 'arrow' }, { icon: 'plate' }]); } break;
    case 'gemgate': if (!o.open) openGemPopup(o); break;
    case 'zombie':
      if (o.bonk || o.poof) return;
      h.cast = 1; hitZombie(h, o); splashHits(h, o);
      break;
    case 'king': if (kingCanHit(h, o)) kingHit(h, o); break;
    case 'target': case 'hanging': if (!isL) return wrongHero(o, ARCHER); break;
    case 'drawbridge': Snd.nope(); o.shake = 1; switchPulse = ARCHER && S.active !== ARCHER ? 2.5 : 0;
      tempBubble(o, [{ head: ARCHER }, { icon: 'bow' }, { icon: 'arrow' }, { icon: 'target' }], 2); break;
    case 'crown':
      if (S.done) return; S.done = true; o.lift = 0.001; Snd.fanfare(); burst(o.x + 0.5, o.y + 0.3, 'confetti', 50, 2); shakeAmt = 5; persist();
      later(2.2, () => { scene = 'end'; endT = 0; persist(); }); break;
  }
  persist();
}
/* ---------- Zombie King: every hero in the party has to get him once (Ruru bonks, Mielie zaps, Lillie-Bee shoots) ---------- */
function kingNeed(o) { return HERO_ORDER.filter(n => !(o.hits || []).includes(n)); }
function kingCanHit(h, o) {
  if (o.hp <= 0 || o.gone) return false;
  { const tw = twistDef(); if (tw && tw.area === L.id && S.twist !== 'done') { Snd.nope(); o.shake = 1; tempBubble(o, [{ icon: 'starwand' }].concat(wandPieces().map(p => ({ icon: 'piece_' + p, dim: !S.pieces[p] })))); return false; } }
  o.hits = o.hits || [];
  if (o.hits.includes(h.name)) { Snd.nope(); o.shake = 1; switchPulse = 2.5; tempBubble(o, kingNeed(o).map(n => ({ head: n }))); return false; }
  return true;
}
function kingHit(h, o) {
  o.hits = (o.hits || []).concat(h.name); o.last = h.name; o.hp = Math.max(0, HERO_ORDER.length - o.hits.length); o.hurt = 1; h.cast = 1; shakeAmt = 5;
  if (h.name === 'ruru') { Snd.bonk(); burst(o.x + 0.5, o.y + 0.1, 'star', 14, 1.4); }
  else if (h.name === ARCHER) { Snd.thunk(); burst(o.x + 0.5, o.y + 0.2, 'star', 16, 1.5); burst(o.x + 0.5, o.y + 0.2, 'spark', 12, 1.2); later(0.1, () => tempBubble(h, [{ text: 'Ping!' }], 1.2)); }
  else { zapFx(h, o, true); burst(o.x + 0.5, o.y + 0.3, 'glitter', 18, 1.4); }
  later(0.3, () => { Snd.groan(0.7); });
  if (o.hp > 0) { later(0.5, () => tempBubble(o, [{ text: o.hits.length === 1 ? 'Braaains...' : 'Mielies?!' }], 1.6)); }
  else later(0.7, () => {
    Snd.zap(); Snd.poof(); Snd.build(); o.gone = true; dustCloud(o.x + 0.5, o.y + 0.4, 34); burst(o.x + 0.5, o.y + 0.5, 'confetti', 30, 1.6);
    const c = makeObj('crown', o.x, o.y); c.pop = 1; L.objs.push(c); persist();
  });
}

/* ---------- Lillie-Bee's bow: arrows fly to far-away things (range from the bow in the Forge) ---------- */
let arrows = [];
function arrowable(o) {
  if (!o || o.gone) return false;
  if (o.type === 'zombie') return !o.bonk && !o.poof && !o.shotAt;
  if (o.type === 'king') return o.hp > 0;
  if (o.type === 'boss') return !o.beaten && (bossDef(o).needs || []).includes(ARCHER) && !(o.hits || []).includes(ARCHER) && !!o.cleared && armorOff(o);
  if (o.type === 'target') return !o.hit;
  if (o.type === 'hanging') return !o.shot;
  return false;
}
function bowRange() { return gearStat('range', ARCHER) || 5; }
function inRange(h, o) { return Math.hypot(h.x - o.x, h.y - o.y) <= bowRange() + 0.01; }
function tilesInRange(o) {
  const out = [], r = bowRange();
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (!(x === o.x && y === o.y) && Math.hypot(x - o.x, y - o.y) <= r + 0.01 && walkable(x, y)) out.push({ x, y });
  return out;
}
/** can the archer get within range of o (from where she stands now)? */
function archerCanReach(o) { const h = heroes[ARCHER]; if (!h || !arrowable(o)) return false; return inRange(h, o) || !!findPath(h, tilesInRange(o)); }
function shoot(h, o) {
  if (o.type === 'king' && !kingCanHit(h, o)) return;
  if (o.type === 'boss' && !bossCanHit(h, o)) return;
  if (!arrowable(o)) { Snd.tap(); return; }
  face(h, o); h.cast = 1; h.aim = 1;
  if (o.type === 'zombie') { o.shotAt = true; o.wait = 3; }
  const t = gearTier('bow');
  const x0 = h.x + 0.5 + (h.facing || 1) * 0.3, y0 = h.y - 0.15;
  const x1 = o.x + 0.5 + (o.type === 'zombie' ? zx(o) / T : 0), y1 = o.y + (o.type === 'hanging' ? -0.25 : o.type === 'target' ? 0.05 : 0.2) + (o.type === 'zombie' ? zy(o) / T : 0);
  const dur = 0.22 + Math.hypot(x1 - x0, y1 - y0) * 0.045;
  arrows.push({ x0, y0, x1, y1, t: 0, dur, color: t.color, tier: t.id });
  Snd.twang();
  later(dur, () => arrowHit(h, o, x1, y1));
}
function arrowHit(h, o, x, y) {
  burst(x, y, 'spark', 10, 1.1);
  if (o.type === 'zombie') { hitZombie(h, o); splashHits(h, o); }
  else if (o.type === 'king') kingHit(h, o);
  else if (o.type === 'boss') bossHit(h, o);
  else if (o.type === 'target') {
    o.hit = true; o.shake = 1; Snd.thunk(); burst(o.x + 0.5, o.y, 'star', 14, 1.3); later(0.1, () => tempBubble(h, [{ text: 'Ping!' }], 1.2));
    later(0.5, () => { Snd.build(); shakeAmt = 6; lvlObjs('drawbridge').forEach(d => { d.gone = true; L.grid[d.y][d.x] = 'p'; burst(d.x + 0.5, d.y + 0.5, 'spark', 24, 1.5); burst(d.x + 0.5, d.y + 0.5, 'dust', 12, 1.2); }); hintCache.t = -1; persist(); });
  }
  else if (o.type === 'hanging') {
    o.shot = true; o.fall = 0.001; Snd.thunk(); later(0.1, () => tempBubble(h, [{ text: 'Ping!' }], 1.2));
    later(0.45, () => {
      o.gone = true; Snd.collect(); burst(o.x + 0.5, o.y + 0.5, 'spark', 20, 1.4); burst(o.x + 0.5, o.y + 0.6, 'dust', 8, 1);
      const r = o.reward || { res: 'mielie', n: 2 };
      if (r.gem) { const g = makeObj('gem', o.x, o.y); g.color = r.gem; g.pop = 1; L.objs.push(g); Snd.magic(); }
      else { S.inv[r.res] = (S.inv[r.res] || 0) + (r.n || 1); gain(r.res, r.n || 1, o); }
      hintCache.t = -1; persist();
    });
  }
  persist();
}
function pushBlock(h, o) {
  const dx = o.x - h.x, dy = o.y - h.y, nx = o.x + dx, ny = o.y + dy;
  const other = Object.values(heroes).find(k => k !== h && k.x === nx && k.y === ny);
  if (!walkable(nx, ny) || other || (L.grid[ny][nx] === 'b')) { Snd.nope(); o.shake = 1; return; }
  const ox = o.x, oy = o.y; o.x = nx; o.y = ny; o.slide = 1; o.sdx = dx; o.sdy = dy; Snd.scrape();
  h.path = [{ x: ox, y: oy }]; h.action = null;
  const plate = objAt(nx, ny, p => p.type === 'plate');
  if (plate && !plate.pressed) {
    plate.pressed = true;
    later(0.35, () => { Snd.build(); lvlObjs('gate').forEach(g => { g.open = true; burst(g.x + 0.5, g.y + 0.5, 'spark', 24, 1.4); }); shakeAmt = 5; persist(); });
  }
}
function hitZombie(h, o) {
  if (o.bonk || o.poof) return;
  h.lunge = 1; h.lungeDir = o.x === h.x ? (h.facing || 1) : (o.x > h.x ? 1 : -1); o.flash = 1;
  S.zombiesBonked = (S.zombiesBonked || 0) + 1; addPower('hit');
  if (h.name === 'ruru') { Snd.bonk(); o.bonk = 0.001; o.bdir = o.x >= h.x ? 1 : -1; burst(o.x + 0.5, o.y + 0.3, 'star', 12, 1.3); fxRing(o.x + 0.5, o.y + 0.8, '#fff', 0.9, 0.35, 6); shakeAmt = 4; later(0.7, () => bonkDust(o)); later(0.9, () => { o.gone = true; persist(); }); }
  else if (h.name === ARCHER) { o.poof = 0.001; o.pinged = 1; Snd.thunk(); shakeAmt = 3; later(0.12, () => tempBubble(h, [{ text: 'Ping!' }], 1.2));
    later(0.3, () => { o.gone = true; burst(o.x + 0.5, o.y + 0.4, 'star', 16, 1.4); burst(o.x + 0.5, o.y + 0.4, 'glitter', 18, 1.6); burst(o.x + 0.5, o.y + 0.4, 'sdust', 10, 1); Snd.poof(); persist(); }); }
  else { o.poof = 0.001; zapFx(h, o); later(0.3, () => { o.gone = true; dustCloud(o.x + 0.5, o.y + 0.45, 22); Snd.poof(); persist(); }); }
}
/** better gear reaches further: bonk / zap every other zombie within reach of the one we hit */
function splashHits(h, o) {
  const reach = gearStat('reach', h.name); if (!reach) return;
  let k = 0;
  for (const z of lvlObjs('zombie')) { if (z === o || z.bonk || z.poof || z.shotAt) continue; if (Math.hypot(zx(z) / T + z.x - o.x, zy(z) / T + z.y - o.y) > reach) continue; k++; later(0.12 * k, () => hitZombie(h, z)); }
}
function bumpHero(h, z) {
  if (h.name === 'ruru' && gearStat('guard', 'ruru') > 0 && z.type === 'zombie' && !z.bonk && !z.poof) {
    // iron shield: Ruru bonks the zombie instead of being bumped back
    h.path = []; h.action = null; h.walkT = 0; h.fx = h.x; h.fy = h.y; h.facing = z.x >= h.x ? 1 : -1; h.cast = 1; hitZombie(h, z); persist(); return;
  }
  if (z.minion && fight && h.name === 'ruru') { // Ruru blocks with his shield: no heart lost, the minion is pushed back
    h.path = []; h.action = null; h.walkT = 0; h.fx = h.x; h.fy = h.y; h.facing = z.x >= h.x ? 1 : -1; h.cast = 1; z.wait = 1.6; z.shake = 1; z.mt = 0.3;
    Snd.rock(); burst(h.x + 0.5 + h.facing * 0.4, h.y + 0.3, 'star', 8, 0.9); tempBubble(h, [{ text: 'Block!' }], 1.1); return;
  }
  // touching a zombie never hurts: the hero just boings back to their tile
  if (z.minion && fight) loseHeart(h);
  h.path = []; h.action = null; h.walkT = 0; h.fx = h.x; h.fy = h.y; h.bump = 1; h.flash = 1; h.facing = z.x >= h.x ? 1 : -1;
  Snd.boing(); burst(h.x + 0.5, h.y + 0.1, 'star', 6, 0.8); z.wait = 1.2; z.chomp = 1;
  if (Math.random() < 0.6) { Snd.groan(); tempBubble(z, [{ text: Math.random() < 0.5 ? 'Braaains...' : 'Mieliiies!' }], 1.5); }
}
function resetLevel() {
  // only the push puzzle goes back to its start; everything else the kids did is kept
  if (!L || lvlObjs('plate').some(p => p.pressed)) return;
  const fresh = buildLevel(L.i).objs.filter(o => o.type === 'block');
  L.objs = L.objs.filter(o => o.type !== 'block');
  fresh.forEach(b => {
    const hero = Object.values(heroes).find(h => h.x === b.x && h.y === b.y);
    if (hero) { const n = [[0,1],[1,0],[-1,0],[0,-1]].map(d => ({ x: b.x + d[0], y: b.y + d[1] })).find(t => walkable(t.x, t.y)); if (n) { hero.x = hero.fx = n.x; hero.y = hero.fy = n.y; hero.path = []; } }
    b.pop = 1; L.objs.push(b); burst(b.x + 0.5, b.y + 0.5, 'spark', 14, 1);
  });
  Snd.swap(); persist();
}

/* ---------------- Gem gate popup ---------------- */
function openGemPopup(o) {
  Snd.pop(); popup = { o, t: 0, shake: 0, wrong: null };
}
function popupChoose(c) {
  const o = popup.o, idx = o.slots.indexOf(0);
  if (idx < 0) return;
  if (!S.gems[c]) { Snd.nope(); popup.shake = 1; popup.wrong = c; return; }
  if (GEMS[idx] !== c) { Snd.nope(); popup.shake = 1; popup.wrong = c; return; }
  o.slots[idx] = 1; Snd.magic(); popup.flash = { i: idx, t: 0 };
  if (o.slots.every(s => s)) {
    later(0.8, () => { popup = null; o.open = true; Snd.build(); Snd.boom(); shakeAmt = 8; burst(o.x + 0.5, o.y + 0.5, 'spark', 40, 2); persist(); });
  }
  persist();
}

/* ---------------- Movement ---------------- */
function activeHero() { return heroes[S.active] || heroes[HERO_ORDER[0]]; }
function partyNames() { return HERO_ORDER.filter(n => heroes[n]); }
function nextHeroName() { const p = partyNames(); return p[(p.indexOf(S.active) + 1) % p.length]; }
/** the hero the switch button will pick next */
function otherHero() { return heroes[nextHeroName()]; }
/** active hero first, then the others in switch order (each one follows the one in front) */
function partyLine() { const p = partyNames(), i = Math.max(0, p.indexOf(S.active)); return p.slice(i).concat(p.slice(0, i)).map(n => heroes[n]); }
function startPath(h, goals) {
  const from = h.path.length ? h.path[0] : { x: h.x, y: h.y };
  const p = findPath(from, goals); if (!p) return false;
  h.path = h.path.length ? [h.path[0]].concat(p) : p; return true;
}
function interactive(o) { return !o.gone && !o.beaten && !['plate', 'exit', 'gem'].includes(o.type) && !((o.type === 'gate' || o.type === 'gemgate') && o.open) && !(o.type === 'target' && o.hit) && !(o.type === 'hanging' && o.shot); }
function tapTile(tx, ty) {
  const h = activeHero(); idle = 0;
  const o = L.objs.find(o => o.x === tx && o.y === ty && interactive(o));
  if (o) {
    ripples.push({ x: tx, y: ty, t: 0, ok: true });
    if (o.type === 'boss' && !o.cleared && !fight) startFight(o);
    if (h.name === 'ruru' && o.type === 'zombie' && !o.bonk && !o.poof && ruruCharge(h, o)) return;
    if (h.name === ARCHER && arrowable(o)) {
      // Lillie-Bee shoots from where she stands, or first walks until the target is in range
      if (!h.path.length && inRange(h, o)) { h.action = null; interact(h, o); return; }
      if (startPath(h, tilesInRange(o))) { h.action = o; Snd.tap(); } else { Snd.nope(); o.shake = 1; }
      return;
    }
    if (adjacent(h, o) && !h.path.length) { h.action = null; interact(h, o); return; }
    const goals = nbrs(o).filter(n => walkable(n.x, n.y));
    if (h.path.length === 0) { const here = goals.find(g => g.x === h.x && g.y === h.y); if (here) { interact(h, o); return; } }
    if (startPath(h, goals)) { h.action = o; Snd.tap(); }
    else if (ARCHER && h.name !== ARCHER && arrowable(o) && o.type !== 'king') wrongHero(o, ARCHER); // too far away: a job for the bow
    else { Snd.nope(); o.shake = 1; }
    return;
  }
  if (walkable(tx, ty)) { if (startPath(h, [{ x: tx, y: ty }])) { h.action = null; Snd.tap(); ripples.push({ x: tx, y: ty, t: 0, ok: true }); } else { Snd.nope(); ripples.push({ x: tx, y: ty, t: 0, ok: false }); } }
  else { Snd.nope(); ripples.push({ x: tx, y: ty, t: 0, ok: false }); }
}
const STEP_T = 0.26;
function moveHero(h, dt, isActive) {
  if (!h.path.length) { h.walkT = 0; return; }
  const nx = h.path[0];
  if (!walkable(nx.x, nx.y)) { const z = objAt(nx.x, nx.y, o => o.type === 'zombie'); if (z) bumpHero(h, z); else { h.path = []; h.action = null; } return; }
  h.walkT += dt * SPEED * (gearStat('speed', 'ruru') || 1) * (h.dash ? 3 : 1) / STEP_T;
  if (h.dash && Math.random() < 0.5) burst(h.fx + 0.5, h.fy + 0.8, 'dust', 1, 0.5);
  if (nx.x !== h.x) h.facing = nx.x > h.x ? 1 : -1;
  const p = Math.min(1, h.walkT);
  h.fx = h.x + (nx.x - h.x) * p; h.fy = h.y + (nx.y - h.y) * p;
  if (h.walkT >= 1) {
    h.walkT = 0; h.x = nx.x; h.y = nx.y; h.fx = h.x; h.fy = h.y; h.path.shift(); h.squash = 0.5;
    if (isActive) Snd.step();
    const g = objAt(h.x, h.y, o => o.type === 'gem');
    if (g) { g.gone = true; S.gems[g.color] = true; Snd.collect(); Snd.magic(); burst(h.x + 0.5, h.y + 0.4, 'spark', 24, 1.5); floaters.push({ icon: 'gem_' + g.color, from: w2s(h.x + 0.5, h.y + 0.3), to: pillPos('gems'), t: 0, dur: 0.8, big: true, done: () => { pillBounce.gems = 1; Snd.pop(); } }); persist(); }
    if (isActive && !h.path.length && objAt(h.x, h.y, o => o.type === 'exit') && !trans) { if (areaBoss()) exitLocked(objAt(h.x, h.y, o => o.type === 'exit')); else nextLevel(); }
    if (!h.path.length) h.dash = 0;
    if (!h.path.length && h.action) { const o = h.action; h.action = null; if (!o.gone && (adjacent(h, o) || (h.name === ARCHER && arrowable(o) && inRange(h, o)))) interact(h, o); }
    if (!h.path.length && isActive) persist();
  }
}
function follow(f, a, dt) {
  const d = Math.abs(f.x - a.x) + Math.abs(f.y - a.y);
  if (d <= 1 && !f.path.length) { f.stuck = 0; return; }
  if (f.path.length) return;
  if (d <= 1) return;
  const goals = nbrs(a).filter(n => walkable(n.x, n.y));
  if (goals.length && startPath(f, goals)) { f.stuck = 0; return; }
  f.stuck += dt;
  if (f.stuck > 1.2) {
    const g = goals[0] || { x: a.x, y: a.y };
    burst(f.fx + 0.5, f.fy + 0.5, 'spark', 10); f.x = f.fx = g.x; f.y = f.fy = g.y; f.path = []; f.stuck = 0; burst(g.x + 0.5, g.y + 0.5, 'spark', 14); Snd.swap();
  }
}
function switchHero() {
  const a = activeHero(); a.action = null;
  S.active = nextHeroName(); switchPulse = 0; idle = 0; hintCache.t = -1;
  const n = activeHero(); n.squash = 1; n.cast = 0.6; Snd.swap(); burst(n.fx + 0.5, n.fy + 0.3, 'spark', 14); persist();
}
function nextLevel() {
  const i = L.i;
  trans = { t: 0, dur: 0.5, mid: () => { S.areas[L.id] = serialize(L); S.unlocked = Math.max(S.unlocked, Math.min(LEVELS.length, i + 2)); S.heroes = null; if (i + 1 < LEVELS.length) enterLevel(i + 1, false); } };
  Snd.build();
}

/* ---------------- Hints ---------------- */
function nearest(list) {
  const a = activeHero(); let best = null, bd = 1e9;
  for (const o of list) { const d = Math.abs(o.x - a.x) + Math.abs(o.y - a.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
function avail(type) { return lvlObjs(type).filter(o => !o.dep); }
function reachable(o) { const a = activeHero(); if (o.type === 'gem' || o.type === 'exit') return !!findPath(a, [o]); return !!findPath(a, nbrs(o).filter(n => walkable(n.x, n.y)).concat(adjacent(a, o) ? [{ x: a.x, y: a.y }] : [])); }
function computeHint() {
  const inv = S.inv, i = L.i, pick = l => nearest(l.filter(reachable));
  const has = t => lvlObjs(t).length > 0;
  const zs = lvlObjs('zombie').filter(z => !z.bonk && !z.poof && reachable(z)); if (zs.length) return nearest(zs);
  const vh = villainHint(); if (vh) return vh;
  const lt = archerHint(); if (lt) return lt;
  const gh = gearHint(); if (gh) return gh;
  if (i === 0) {
    if (has('thorn')) return pick(lvlObjs('thorn'));
    if (has('bridge')) return inv.wood >= 5 ? lvlObjs('bridge')[0] : pick(avail('tree'));
    return bossHint() || lvlObjs('exit')[0];
  }
  if (i === 1) {
    if (has('boulder')) {
      if (S.pick) return lvlObjs('boulder')[0];
      if (inv.wood < 2) return pick(avail('tree'));
      if (inv.stone < 2) return pick(avail('rock'));
      return lvlObjs('bench')[0];
    }
    if (has('dragon')) return inv.mielie >= 1 ? lvlObjs('dragon')[0] : pick(avail('corn'));
    const g = lvlObjs('gate')[0];
    if (g && !g.open) return lvlObjs('block')[0];
    return bossHint() || lvlObjs('exit')[0];
  }
  if (has('troll')) return inv.flower >= 1 ? lvlObjs('troll')[0] : pick(avail('bud'));
  if (!S.gems.r) { const t = pick(lvlObjs('thorn')); const g = lvlObjs('gem').find(g => g.color === 'r'); if (g && reachable(g)) return g; return t || g; }
  if (!S.gems.b) return lvlObjs('crystal')[0] || lvlObjs('gem').find(g => g.color === 'b');
  if (!S.gems.y) return lvlObjs('lantern').find(l => !l.lit) || lvlObjs('gem').find(g => g.color === 'y');
  { const bh = bossHint(); if (bh) return bh; }
  const gg = lvlObjs('gemgate')[0]; if (gg && !gg.open) return gg;
  const k = lvlObjs('king')[0];
  if (k && k.hits && k.hits.includes(S.active)) switchPulse = Math.max(switchPulse, 0.6);
  return k || lvlObjs('crown')[0];
}
/** something only Lillie-Bee's arrow can do, that she can get in range of right now */
function archerHint() {
  if (!ARCHER) return null;
  const c = L.objs.filter(o => !o.gone && ((o.type === 'target' && !o.hit) || (o.type === 'hanging' && !o.shot && o.reward && o.reward.gem) || (o.type === 'zombie' && o.guards && !o.bonk && !o.poof)));
  const o = nearest(c.filter(archerCanReach)); if (!o) return null;
  if (S.active !== ARCHER) switchPulse = Math.max(switchPulse, 0.6);
  return o;
}
function getHint() { if (now - hintCache.t > 0.5) { hintCache.t = now; try { hintCache.v = computeHint() || null; } catch (e) { hintCache.v = null; } } return hintCache.v; }

/* ---------------- Layout & camera ---------------- */
let hits = [];
function layout() {
  W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const nT = Math.round(clamp(Math.min(W, H * 0.85) / 6.3, 56, 104));
  if (nT !== T) { T = nT; } scaled = {};
  UI.land = W > H; UI.hudH = 66; UI.top = 8;
  UI.sw = { x: W - (UI.land ? 62 : 70), y: H - (UI.land ? 62 : 74), r: UI.land ? 44 : 50 };
  UI.quest = { x: W - 44, y: UI.top + 58 + 36, r: 32 };
  UI.home = { x: 48, y: H - 48, r: 34 }; UI.forge = { x: 128, y: H - 48, r: 34 }; UI.reset = { x: 208, y: H - 48, r: 34 };
  const n = 5, pw = Math.min(100, (W - 16) / n - 6);
  UI.pills = ['wood', 'stone', 'mielie', 'flower', 'gems'].map((res, k) => ({ res, x: 8 + k * (pw + 6), y: UI.top, w: pw, h: 52 }));
  UI.pills.push({ res: 'pick', x: 8, y: UI.top + 58, w: pw, h: 46 });
  const np = wandPieces().length; UI.wand = { x: 8 + pw + 6, y: UI.top + 58, w: 20 + np * 40, h: 46 };
  UI.power = { x: W - 70, y: H - 200, r: 46 }; UI.summon = { x: W - 176, y: H - 196, r: 38 }; UI.meter = { x: 16, y: H - 106, w: Math.min(190, W * 0.46), h: 22 };
}
function camTarget() {
  const h = activeHero(), ww = L.w * T, wh = L.h * T, top = UI.hudH + 46;
  const tx = ww <= W ? (W - ww) / 2 : clamp(W / 2 - (h.fx + 0.5) * T, W - ww, 0);
  const avail = H - top;
  const ty = wh <= avail ? top + (avail - wh) / 2 : clamp(top + avail * 0.5 - (h.fy + 0.5) * T, H - wh - 12, top);
  return { tx, ty };
}
function updateCam(dt, snap) {
  if (!L) return; const t = camTarget(); cam.tx = t.tx; cam.ty = t.ty;
  if (snap) { cam.x = t.tx; cam.y = t.ty; return; }
  const k = Math.min(1, dt * 6 * Math.sqrt(SPEED)); cam.x += (t.tx - cam.x) * k; cam.y += (t.ty - cam.y) * k;
}

/* ---------------- Update ---------------- */
function updateZombie(z, dt) {
  if (z.bonk) { z.bonk += dt * SPEED; return; }
  if (z.poof) return;
  if (z.px === undefined) { z.px = z.x; z.py = z.y; z.mt = 1; }
  z.mt += dt * SPEED / 0.9;
  const frozen = Object.values(heroes).some(h => h.action === z) || popup || trans;
  if (frozen) return;
  if (z.wait > 0) { z.wait -= dt * SPEED; return; }
  if (z.minion) { minionStep(z); return; }
  if (z.mt < 1 || !z.route || z.route.length < 2) return;
  let ni = z.ri + z.rd; if (ni < 0 || ni >= z.route.length) { z.rd = -z.rd; ni = z.ri + z.rd; }
  const t = z.route[ni];
  const hit = Object.values(heroes).find(h => (h.x === t.x && h.y === t.y) || (h.path[0] && h.path[0].x === t.x && h.path[0].y === t.y));
  if (hit) { bumpHero(hit, z); z.rd = -z.rd; z.mt = 0.5; return; }
  if (!walkable(t.x, t.y)) { z.rd = -z.rd; z.mt = 0.6; return; }
  z.px = z.x; z.py = z.y; z.x = t.x; z.y = t.y; z.ri = ni; z.mt = 0;
  if (t.x !== z.px) z.facing = t.x > z.px ? 1 : -1;
  if (Math.random() < 0.07) { Snd.groan(0.35); tempBubble(z, [{ text: Math.random() < 0.5 ? 'Braaains...' : 'Mieliiies!' }], 1.4); }
}
function decay(o, k, dt, r = 3) { if (o[k] > 0) o[k] = Math.max(0, o[k] - dt * r); }
function update(dt) {
  if (cine && scene === 'play') { cine.t += dt; cine.rdt = dt; dt *= cine.slow || 1; }
  if (scene === 'mini') updateMini(dt);
  now += dt; fxUpdate(dt);
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt * SPEED; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.life <= 0) particles.splice(i, 1); }
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt * Math.max(1, SPEED * 0.75) / f.dur; if (f.t >= 1) { floaters.splice(i, 1); f.done && f.done(); } }
  for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.t += dt; if (b.t > b.dur || b.o.gone) bubbles.splice(i, 1); }
  for (let i = zaps.length - 1; i >= 0; i--) { zaps[i].t += dt * 3.5; if (zaps[i].t > 1) zaps.splice(i, 1); }
  for (let i = arrows.length - 1; i >= 0; i--) { arrows[i].t += dt * SPEED / arrows[i].dur; if (arrows[i].t >= 1) arrows.splice(i, 1); }
  if (questCard) questCard.t += dt;
  if (scene === 'intro') introT += dt;
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt * 2.2; if (ripples[i].t > 1) ripples.splice(i, 1); }
  for (let i = decor.length - 1; i >= 0; i--) { const d = decor[i]; d.t += dt; if (d.type === 'bunny' && d.t > 3) decor.splice(i, 1); }
  for (const k in pillBounce) decay(pillBounce, k, dt, 4);
  if (switchPulse > 0) switchPulse -= dt;
  if (forgeNudge > 0) forgeNudge -= dt;
  if (shakeAmt > 0) shakeAmt = Math.max(0, shakeAmt - dt * 30);
  if (popup) { popup.t += dt; decay(popup, 'shake', dt, 3); if (popup.flash) popup.flash.t += dt; }
  if (banner) { banner.t += dt; if (banner.t > 2) banner = null; }
  if (trans) { const before = trans.t; trans.t += dt * Math.min(SPEED, 3) / trans.dur; if (before < 1 && trans.t >= 1 && trans.mid) { const m = trans.mid; trans.mid = null; m(); } if (trans.t >= 2) trans = null; }
  if (scene === 'end') endT += dt;
  if (scene !== 'play' || !L) return;
  for (const o of L.objs) {
    if (o.gone) continue;
    decay(o, 'shake', dt); decay(o, 'chomp', dt, 2); decay(o, 'pop', dt, 2); decay(o, 'slide', dt, 6 * Math.sqrt(SPEED)); decay(o, 'hurt', dt, 2); decay(o, 'bloom', dt, 1.2); decay(o, 'flash', dt, 3.5);
    if (o.leaving) o.leaving += dt * Math.min(SPEED, 2);
    if (o.lift) o.lift += dt;
    if (o.fall) o.fall += dt * SPEED;
    if (o.dep && now >= o.regrow) { o.dep = false; o.pop = 1; if (o.type === 'tree' || o.type === 'rock') o.hp = 2; }
    if (o.type === 'zombie') updateZombie(o, dt);
    else if (o.type === 'boss' || o.type === 'queen') updateVillain(o, dt);
  }
  fightUpdate(dt); updateCine(dt);
  const line = partyLine();
  for (const h of line) { decay(h, 'squash', dt, 4); decay(h, 'cast', dt, 2.5); decay(h, 'bump', dt, 3); decay(h, 'feisty', dt, 1.2); decay(h, 'aim', dt, 2); decay(h, 'lunge', dt, 2.4); decay(h, 'flash', dt, 3); }
  moveHero(line[0], dt, true);
  for (let k = 1; k < line.length; k++) { follow(line[k], line[k - 1], dt); moveHero(line[k], dt, false); }
  updateCam(dt, false);
  if (!busy()) idle += dt; else idle = 0;
}
function busy() {
  if (scene !== 'play' || !L) return !!trans;
  return !!(trans || cine || timers.length || floaters.length || arrows.length || Object.values(heroes).some(h => h.path.length || h.action) || L.objs.some(o => !o.gone && (o.slide > 0 || o.bonk || o.poof)));
}

/* ---------------- Drawing helpers ---------------- */
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function circ(x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); } }
function ell(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
function txt(s, x, y, size, fill = '#fff', stroke = '#3b2a6b', align = 'center') {
  ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; if (stroke) { ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function star(x, y, r, fill, pts = 5, inner = 0.45) {
  ctx.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / pts, rr2 = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function heart(x, y, s, fill) { ctx.beginPath(); ctx.moveTo(x, y + s * 0.35); ctx.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.35, y - s * 0.85, x, y - s * 0.35); ctx.bezierCurveTo(x + s * 0.35, y - s * 0.85, x + s * 0.9, y - s * 0.3, x, y + s * 0.35); ctx.fillStyle = fill; ctx.fill(); }
function shadow(cx, cy, rx) { ell(cx, cy, rx, rx * 0.32, 'rgba(0,0,0,0.18)'); }

/* ---------------- Tiles ---------------- */
function drawGround(x, y, g, px, py) {
  const s = T + 0.6, hv = hash(x, y);
  if (g === '~' || g === 'b') {
    { const wg = ctx.createLinearGradient(0, py, 0, py + s); wg.addColorStop(0, '#5cc8ff'); wg.addColorStop(1, '#2f9cf0'); ctx.fillStyle = wg; ctx.fillRect(px, py, s, s);
      const gl = 0.5 + 0.5 * Math.sin(now * 2.4 + hv * 9); if (hv > 0.45) { ctx.globalAlpha = 0.35 + gl * 0.5; star(px + T * (0.2 + hv * 0.6), py + T * (0.2 + hash(y, x) * 0.6), T * 0.05 * (0.6 + gl), '#fff', 4, 0.3); ctx.globalAlpha = 1; } }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(2, T * 0.04); ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) { const yy = py + T * (0.3 + k * 0.4), off = Math.sin(now * 2 + x + k * 2) * T * 0.08; ctx.beginPath(); ctx.moveTo(px + T * 0.15 + off, yy); ctx.quadraticCurveTo(px + T * 0.3 + off, yy - T * 0.08, px + T * 0.45 + off, yy); ctx.stroke(); }
    if (g === 'b') {
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 1, py + T * 0.08, s + 2, T * 0.84);
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c98a4b' : '#d99a58'; rr(px + T * 0.04 + k * T * 0.24, py + T * 0.1, T * 0.21, T * 0.8, T * 0.05); ctx.fill(); }
      ctx.fillStyle = '#6b4320'; ctx.fillRect(px, py + T * 0.06, s, T * 0.07); ctx.fillRect(px, py + T * 0.87, s, T * 0.07);
    }
    return;
  }
  if (g === 'v' || g === 'p') {
    const gr = ctx.createLinearGradient(0, py, 0, py + T); gr.addColorStop(0, '#2a1d3d'); gr.addColorStop(1, '#4a3560'); ctx.fillStyle = gr; ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#7a5236'; ctx.fillRect(px, py, s, T * 0.12); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px, py + T * 0.12, s, T * 0.08);
    for (let k = 0; k < 2; k++) circ(px + T * (0.25 + 0.5 * hash(x + k, y)), py + T * (0.45 + 0.35 * hash(y, x + k)), T * 0.025, 'rgba(255,255,255,0.18)');
    if (g === 'p') {
      ctx.fillStyle = '#6b4320'; ctx.fillRect(px + T * 0.08, py - 1, T * 0.08, s + 2); ctx.fillRect(px + T * 0.84, py - 1, T * 0.08, s + 2);
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c98a4b' : '#d99a58'; rr(px + T * 0.1, py + T * 0.03 + k * T * 0.24, T * 0.8, T * 0.2, T * 0.04); ctx.fill(); }
    }
    return;
  }
  if (g === '_') { ctx.fillStyle = (x + y) % 2 ? '#c9b8e8' : '#bba8de'; ctx.fillRect(px, py, s, s); ctx.strokeStyle = 'rgba(90,60,140,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, T - 4, T - 4); if (hv > 0.7) { ctx.fillStyle = '#e0466b'; ctx.fillRect(px + T * 0.3, py, T * 0.4, s); } return; }
  { const v = (hv - 0.5) * 6; ctx.fillStyle = `hsl(${102 + v},${62 + v}%,${60 + ((x + y) % 2) * 1.5 + v * 0.4}%)`; ctx.fillRect(px, py, s, s); }
  if (g === '=') { ctx.fillStyle = '#f1d49a'; rr(px + T * 0.12, py - 1, T * 0.76, s + 2, 4); ctx.fill(); ctx.fillStyle = '#e2bf7d'; circ(px + T * (0.3 + hv * 0.4), py + T * 0.5, T * 0.05, '#e2bf7d'); return; }
  ctx.strokeStyle = 'rgba(40,120,30,0.32)'; ctx.lineWidth = Math.max(1.5, T * 0.025); ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const hx = px + T * (0.1 + 0.8 * hash(x * 3 + k, y)), hy = py + T * (0.15 + 0.75 * hash(x, y * 7 + k)), sw = Math.sin(now * 2 + hx * 0.05) * T * 0.015; ctx.beginPath(); ctx.moveTo(hx - T * 0.05, hy); ctx.lineTo(hx - T * 0.07 + sw, hy - T * 0.09); ctx.moveTo(hx, hy); ctx.lineTo(hx + sw, hy - T * 0.12); ctx.moveTo(hx + T * 0.05, hy); ctx.lineTo(hx + T * 0.07 + sw, hy - T * 0.08); ctx.stroke(); }
  if (hv > 0.82) circ(px + T * hash(y, x * 3), py + T * hash(x * 5, y), T * 0.03, 'rgba(255,255,220,0.6)');
  if (g === ',') { for (let k = 0; k < 3; k++) { const fx = px + T * (0.2 + 0.6 * hash(x + k, y * 3)), fy = py + T * (0.2 + 0.6 * hash(x * 5, y + k)); const c = ['#ff7eb6', '#fff', '#ffd23f'][k]; for (let p = 0; p < 5; p++) circ(fx + Math.cos(p * 1.26) * T * 0.05, fy + Math.sin(p * 1.26) * T * 0.05, T * 0.04, c); circ(fx, fy, T * 0.03, '#ff9f1c'); } }
}
function drawTall(x, y, g, px, py) {
  if (g === '#') {
    ell(px + T / 2, py + T * 0.9, T * 0.46, T * 0.15, 'rgba(20,60,20,0.25)');
    const tg = ctx.createLinearGradient(px + T * 0.4, 0, px + T * 0.6, 0); tg.addColorStop(0, '#8a5530'); tg.addColorStop(1, '#5e3418'); ctx.fillStyle = tg; rr(px + T * 0.42, py + T * 0.5, T * 0.16, T * 0.42, T * 0.05); ctx.fill();
    const sw = Math.sin(now * 1.5 + x * 0.7 + y) * T * 0.022, hue = hash(x, y) > 0.5 ? 0 : 8, cx0 = px + T * 0.5 + sw;
    const blobs = [[-0.22, 0.42, 0.27], [0.22, 0.42, 0.27], [0, 0.4, 0.3], [-0.13, 0.2, 0.25], [0.14, 0.2, 0.25], [0, 0.06, 0.24]];
    ctx.fillStyle = '#1f6b34'; ctx.beginPath(); for (const [bx, b2, r] of blobs) { ctx.moveTo(cx0 + bx * T + (r + 0.04) * T, py + b2 * T); ctx.arc(cx0 + bx * T, py + b2 * T, (r + 0.04) * T, 0, TAU); } ctx.fill();
    const cg = ctx.createLinearGradient(0, py - T * 0.2, 0, py + T * 0.7); cg.addColorStop(0, `hsl(${118 + hue},58%,55%)`); cg.addColorStop(1, `hsl(${132 + hue},55%,34%)`); ctx.fillStyle = cg;
    ctx.beginPath(); for (const [bx, b2, r] of blobs) { ctx.moveTo(cx0 + bx * T + r * T, py + b2 * T); ctx.arc(cx0 + bx * T, py + b2 * T, r * T, 0, TAU); } ctx.fill();
    circ(cx0 - T * 0.1, py + T * 0.0, T * 0.11, 'rgba(255,255,220,0.35)'); circ(cx0 - T * 0.24, py + T * 0.3, T * 0.07, 'rgba(255,255,220,0.25)'); circ(cx0 + T * 0.06, py + T * 0.16, T * 0.05, 'rgba(255,255,220,0.25)');
    if (hash(y, x) > 0.7) { circ(cx0 + T * 0.18, py + T * 0.34, T * 0.05, '#ff6f8a'); circ(cx0 - T * 0.05, py + T * 0.46, T * 0.045, '#ff6f8a'); }
    return;
  }
  if (g === '^') {
    ctx.fillStyle = '#9c6b45'; rr(px - 1, py - T * 0.25, T + 2, T * 1.2, T * 0.12); ctx.fill();
    ctx.fillStyle = '#b8835a'; rr(px + 2, py - T * 0.25, T - 4, T * 0.5, T * 0.12); ctx.fill();
    ctx.fillStyle = '#6fc24c'; rr(px - 1, py - T * 0.3, T + 2, T * 0.18, T * 0.08); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(px + T * (0.2 + hash(x, y) * 0.5), py + T * 0.4, T * 0.08, T * 0.3);
    return;
  }
  if (g === 'W') {
    ctx.fillStyle = '#8d86b8'; ctx.fillRect(px - 0.5, py - T * 0.3, T + 1, T * 1.3);
    ctx.strokeStyle = '#6f679e'; ctx.lineWidth = 2;
    for (let r = 0; r < 4; r++) { const yy = py - T * 0.3 + r * T * 0.32; ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px + T, yy); ctx.stroke(); const o = r % 2 ? T * 0.5 : T * 0.25; ctx.beginPath(); ctx.moveTo(px + o, yy); ctx.lineTo(px + o, yy + T * 0.32); ctx.stroke(); }
    ctx.fillStyle = '#a69fd0'; for (let k = 0; k < 2; k++) ctx.fillRect(px + k * T * 0.5 + T * 0.06, py - T * 0.48, T * 0.36, T * 0.2);
    if (y === 0 && x % 3 === 1) { ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.moveTo(px + T * 0.5, py - T * 0.9); ctx.lineTo(px + T * 0.9, py - T * 0.78); ctx.lineTo(px + T * 0.5, py - T * 0.66); ctx.fill(); ctx.fillStyle = '#5b4f8f'; ctx.fillRect(px + T * 0.47, py - T * 0.92, T * 0.05, T * 0.45); }
  }
}

/* ---------------- Icons ---------------- */
function drawIcon(name, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy);
  switch (name) {
    case 'wood': ctx.rotate(-0.35); ctx.fillStyle = '#a0612b'; rr(-s * 0.48, -s * 0.2, s * 0.85, s * 0.4, s * 0.15); ctx.fill(); circ(s * 0.36, 0, s * 0.21, '#e8b878'); circ(s * 0.36, 0, s * 0.11, null, '#a0612b', Math.max(1.5, s * 0.05)); ctx.fillStyle = '#6fc24c'; ell(-s * 0.15, -s * 0.24, s * 0.12, s * 0.06, '#6fc24c'); break;
    case 'stone': ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.25); ctx.lineTo(-s * 0.35, -s * 0.15); ctx.lineTo(-s * 0.05, -s * 0.38); ctx.lineTo(s * 0.35, -s * 0.22); ctx.lineTo(s * 0.47, s * 0.2); ctx.closePath(); ctx.fillStyle = '#9aa3b5'; ctx.fill(); ctx.fillStyle = '#c4cad8'; ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.1); ctx.lineTo(-s * 0.05, -s * 0.3); ctx.lineTo(s * 0.1, -s * 0.05); ctx.fill(); ctx.fillStyle = '#7b8496'; ctx.fillRect(-s * 0.45, s * 0.18, s * 0.92, s * 0.08); break;
    case 'mielie': ctx.rotate(0.35); ell(0, 0, s * 0.2, s * 0.42, '#ffcf33'); ctx.fillStyle = '#f2a900'; for (let r = -3; r <= 3; r++) for (let c = -1; c <= 1; c++) circ(c * s * 0.1, r * s * 0.1, s * 0.035, '#f2a900');
      ctx.fillStyle = '#5cbf3a'; ctx.beginPath(); ctx.moveTo(0, s * 0.45); ctx.quadraticCurveTo(-s * 0.4, s * 0.1, -s * 0.22, -s * 0.2); ctx.quadraticCurveTo(-s * 0.15, s * 0.2, 0, s * 0.45); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, s * 0.45); ctx.quadraticCurveTo(s * 0.4, s * 0.1, s * 0.22, -s * 0.2); ctx.quadraticCurveTo(s * 0.15, s * 0.2, 0, s * 0.45); ctx.fill(); break;
    case 'flower': for (let p = 0; p < 5; p++) circ(Math.cos(p * 1.2566 - 1.57) * s * 0.22, Math.sin(p * 1.2566 - 1.57) * s * 0.22, s * 0.19, '#ff6fae'); circ(0, 0, s * 0.15, '#ffd23f'); break;
    case 'gem_r': case 'gem_b': case 'gem_y': drawGem(name[4], 0, 0, s * 0.5); break;
    case 'gems': ['b', 'r', 'y'].forEach((c, k) => { ctx.globalAlpha = S && S.gems[c] ? 1 : 0.28; drawGem(c, (k - 1) * s * 0.36, 0, s * 0.24); }); ctx.globalAlpha = 1; break;
    case 'pick': ctx.rotate(-0.6); ctx.fillStyle = '#9b5d2e'; rr(-s * 0.06, -s * 0.3, s * 0.12, s * 0.75, s * 0.05); ctx.fill(); ctx.fillStyle = '#b9c2d3'; ctx.beginPath(); ctx.moveTo(-s * 0.48, -s * 0.18); ctx.quadraticCurveTo(0, -s * 0.52, s * 0.48, -s * 0.18); ctx.quadraticCurveTo(0, -s * 0.34, -s * 0.48, -s * 0.18); ctx.fill(); break;
    case 'sword': ctx.rotate(0.7); ctx.fillStyle = '#d9a15f'; rr(-s * 0.07, -s * 0.48, s * 0.14, s * 0.62, s * 0.05); ctx.fill(); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-s * 0.22, s * 0.12, s * 0.44, s * 0.08); ctx.fillRect(-s * 0.05, s * 0.2, s * 0.1, s * 0.25); break;
    case 'wand': ctx.rotate(0.5); ctx.fillStyle = '#b06bff'; rr(-s * 0.04, -s * 0.1, s * 0.08, s * 0.55, s * 0.03); ctx.fill(); star(0, -s * 0.22, s * 0.26, '#ffd23f'); circ(0, -s * 0.22, s * 0.08, '#fff8c4'); break;
    case 'shield': circ(0, 0, s * 0.42, '#c0c7d6', '#7d869c', s * 0.07); ctx.save(); ctx.scale(0.55, 0.55); drawIcon('mielie', 0, 0, s); ctx.restore(); break;
    case 'clock': circ(0, 0, s * 0.4, '#fff', '#5b4f8f', s * 0.08); ctx.strokeStyle = '#5b4f8f'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.25); ctx.moveTo(0, 0); ctx.lineTo(s * 0.18, s * 0.08); ctx.stroke(); break;
    case 'check': ctx.strokeStyle = '#2fb84f'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(-s * 0.08, s * 0.22); ctx.lineTo(s * 0.32, -s * 0.25); ctx.stroke(); break;
    case 'cross': ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.25); ctx.lineTo(s * 0.25, s * 0.25); ctx.moveTo(s * 0.25, -s * 0.25); ctx.lineTo(-s * 0.25, s * 0.25); ctx.stroke(); break;
    case 'arrow': ctx.fillStyle = '#5b4f8f'; ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.1); ctx.lineTo(s * 0.05, -s * 0.1); ctx.lineTo(s * 0.05, -s * 0.28); ctx.lineTo(s * 0.4, 0); ctx.lineTo(s * 0.05, s * 0.28); ctx.lineTo(s * 0.05, s * 0.1); ctx.lineTo(-s * 0.35, s * 0.1); ctx.fill(); break;
    case 'block': ctx.fillStyle = '#c98a4b'; rr(-s * 0.38, -s * 0.38, s * 0.76, s * 0.76, s * 0.08); ctx.fill(); star(0, 0, s * 0.2, '#ffd23f'); break;
    case 'plate': ell(0, 0, s * 0.42, s * 0.25, '#8d86b8'); ell(0, -s * 0.04, s * 0.3, s * 0.16, '#ffd23f'); break;
    case 'home': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.02); ctx.lineTo(0, -s * 0.42); ctx.lineTo(s * 0.42, -s * 0.02); ctx.fill(); ctx.fillRect(-s * 0.28, -s * 0.05, s * 0.56, s * 0.4); ctx.fillStyle = '#7b5cff'; rr(-s * 0.09, s * 0.08, s * 0.18, s * 0.27, s * 0.05); ctx.fill(); break;
    case 'reset': ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, s * 0.28, -0.6, 4.3); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.38); ctx.lineTo(s * 0.4, -s * 0.28); ctx.lineTo(s * 0.18, -s * 0.06); ctx.fill(); break;
    case 'lock': ctx.strokeStyle = '#5b4f8f'; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.2, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#ffd23f'; rr(-s * 0.3, -s * 0.12, s * 0.6, s * 0.45, s * 0.08); ctx.fill(); break;
    case 'star': star(0, 0, s * 0.45, '#ffd23f'); break;
    case 'tree': circ(0, -s * 0.1, s * 0.32, '#37b24d'); ctx.fillStyle = '#7a4a22'; ctx.fillRect(-s * 0.07, s * 0.15, s * 0.14, s * 0.25); break;
    case 'rock': drawIcon('stone', 0, 0, s); break;
    case 'castle': ctx.fillStyle = '#a69fd0'; ctx.fillRect(-s * 0.38, -s * 0.15, s * 0.76, s * 0.5); for (let k = -1; k <= 1; k++) ctx.fillRect(k * s * 0.3 - s * 0.08, -s * 0.4, s * 0.16, s * 0.3); ctx.fillStyle = '#5b4f8f'; rr(-s * 0.1, s * 0.05, s * 0.2, s * 0.3, s * 0.1); ctx.fill(); ctx.fillStyle = '#ff5d8f'; ctx.fillRect(-s * 0.02, -s * 0.62, s * 0.04, s * 0.25); ctx.beginPath(); ctx.moveTo(s * 0.02, -s * 0.62); ctx.lineTo(s * 0.25, -s * 0.54); ctx.lineTo(s * 0.02, -s * 0.46); ctx.fill(); break;
    case 'crown': drawCrown(0, 0, s * 0.9); break;
    case 'arrowR': break;
    case 'heart': heart(0, s * 0.05, s * 0.7, '#ff4d6d'); break;
    default: drawVillainIcon(name, s); break;
    case 'bow': drawBow(s, gearTier('bow')); break;
    case 'zombie': drawZombie({ id: 5, kind: 'plain', facing: 1 }, 0, s * 0.46, s * 0.78, false); break;
    case 'king': drawZombie({ id: 6, facing: 1, hp: 1 }, 0, s * 0.5, s * 0.6, true); break;
    case 'target': drawTargetBoard(0, 0, s * 0.42, false); break;
    case 'bridge': for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c98a4b' : '#d99a58'; rr(-s * 0.4, -s * 0.4 + k * s * 0.21, s * 0.8, s * 0.17, s * 0.04); ctx.fill(); } ctx.fillStyle = '#6b4320'; ctx.fillRect(-s * 0.44, -s * 0.44, s * 0.08, s * 0.88); ctx.fillRect(s * 0.36, -s * 0.44, s * 0.08, s * 0.88); break;
    case 'boulder': ctx.fillStyle = '#8d96a8'; ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.42, s * 0.36, 0, 0, TAU); ctx.fill(); ell(-s * 0.14, -s * 0.1, s * 0.13, s * 0.08, '#b9c2d3'); ctx.strokeStyle = '#5d6577'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.28); ctx.lineTo(s * 0.12, 0); ctx.lineTo(0, s * 0.2); ctx.stroke(); break;
    case 'dragon': ell(0, s * 0.05, s * 0.36, s * 0.3, '#3ccf9a'); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.18); ctx.lineTo(-s * 0.13, -s * 0.44); ctx.lineTo(-s * 0.05, -s * 0.2); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.2); ctx.lineTo(s * 0.13, -s * 0.44); ctx.lineTo(s * 0.2, -s * 0.18); ctx.fill(); circ(-s * 0.13, 0, s * 0.07, '#222'); circ(s * 0.13, 0, s * 0.07, '#222'); ell(0, s * 0.18, s * 0.1, s * 0.04, '#2a7a5a'); break;
    case 'book': ctx.fillStyle = '#ff8fc4'; rr(-s * 0.36, -s * 0.3, s * 0.72, s * 0.6, s * 0.06); ctx.fill(); ctx.fillStyle = '#fff'; rr(-s * 0.3, -s * 0.24, s * 0.27, s * 0.48, s * 0.03); ctx.fill(); rr(s * 0.03, -s * 0.24, s * 0.27, s * 0.48, s * 0.03); ctx.fill(); star(-s * 0.165, 0, s * 0.1, '#ffd23f'); heart(s * 0.165, s * 0.02, s * 0.14, '#ff4d6d'); break;
    case 'anvil': drawAnvil(s); break;
    case 'back': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-s * 0.36, 0); ctx.lineTo(-s * 0.02, -s * 0.3); ctx.lineTo(-s * 0.02, -s * 0.12); ctx.lineTo(s * 0.34, -s * 0.12); ctx.lineTo(s * 0.34, s * 0.12); ctx.lineTo(-s * 0.02, s * 0.12); ctx.lineTo(-s * 0.02, s * 0.3); ctx.closePath(); ctx.fill(); break;
    case 'sound': case 'mute': ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.12); ctx.lineTo(-s * 0.15, -s * 0.12); ctx.lineTo(s * 0.08, -s * 0.34); ctx.lineTo(s * 0.08, s * 0.34); ctx.lineTo(-s * 0.15, s * 0.12); ctx.lineTo(-s * 0.35, s * 0.12); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); if (name === 'sound') { ctx.arc(s * 0.12, 0, s * 0.2, -0.8, 0.8); ctx.moveTo(s * 0.36, -s * 0.24); ctx.arc(s * 0.12, 0, s * 0.33, -0.8, 0.8); } else { ctx.moveTo(s * 0.2, -s * 0.15); ctx.lineTo(s * 0.45, s * 0.15); ctx.moveTo(s * 0.45, -s * 0.15); ctx.lineTo(s * 0.2, s * 0.15); } ctx.stroke(); break;
  }
  ctx.restore();
}
function gemPath(c, x, y, r) {
  ctx.beginPath();
  if (c === 'b') { ctx.arc(x, y, r * 0.85, 0, TAU); }
  else if (c === 'r') { ctx.moveTo(x, y + r * 0.8); ctx.bezierCurveTo(x - r * 1.3, y - r * 0.2, x - r * 0.5, y - r * 1.1, x, y - r * 0.45); ctx.bezierCurveTo(x + r * 0.5, y - r * 1.1, x + r * 1.3, y - r * 0.2, x, y + r * 0.8); }
  else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.48 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } ctx.closePath(); }
}
function drawGem(c, x, y, r) {
  gemPath(c, x, y, r); ctx.fillStyle = GEMCOL[c]; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  ell(x - r * 0.28, y - r * 0.28, r * 0.2, r * 0.12, 'rgba(255,255,255,0.75)');
}
function drawCrown(x, y, s) {
  ctx.fillStyle = '#ffc61a'; ctx.beginPath(); ctx.moveTo(x - s * 0.45, y + s * 0.25); ctx.lineTo(x - s * 0.5, y - s * 0.25); ctx.lineTo(x - s * 0.22, y); ctx.lineTo(x, y - s * 0.38); ctx.lineTo(x + s * 0.22, y); ctx.lineTo(x + s * 0.5, y - s * 0.25); ctx.lineTo(x + s * 0.45, y + s * 0.25); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d99a00'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.stroke();
  circ(x, y + s * 0.1, s * 0.08, '#ff4d6d'); circ(x - s * 0.26, y + s * 0.12, s * 0.06, '#3fa9ff'); circ(x + s * 0.26, y + s * 0.12, s * 0.06, '#7bd85a');
  circ(x - s * 0.5, y - s * 0.27, s * 0.06, '#fff3b0'); circ(x, y - s * 0.4, s * 0.06, '#fff3b0'); circ(x + s * 0.5, y - s * 0.27, s * 0.06, '#fff3b0');
}

/* ---------------- Objects ---------------- */
const FLAT = { plate: 1, exit: 1, bridge: 1, drawbridge: 1 };
/* archery target board (rings), used by the map object and the icon */
function drawTargetBoard(x, y, r, hit) {
  circ(x, y, r, hit ? '#ffd23f' : '#fff', '#8a5a2b', Math.max(2, r * 0.12));
  circ(x, y, r * 0.72, '#ff4d6d'); circ(x, y, r * 0.48, '#fff'); circ(x, y, r * 0.24, hit ? '#ffd23f' : '#ff4d6d');
}
/* little "this is Lillie-Bee's job" badge: her face in a teal circle */
function archerBadge(x, y, r) {
  if (!ARCHER) return; const q = S && S.twist === 'queen'; circ(x, y, r, q ? '#5b1f86' : HERO[ARCHER].color, '#fff', 3);
  const im = sprite(q ? 'queenHead' : ARCHER + 'Head', r * 2); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 2, 0, TAU); ctx.clip(); ctx.drawImage(im, x - r, y - r, r * 2, r * 2); ctx.restore(); }
}
function drawZombie(z, cx, by, s, isKing) {
  if (!isKing && MINION_KINDS[z.kind]) { drawMinion(z, cx, by, s); return; }
  const wob = Math.sin(now * 5 + z.id) * 0.12, chomp = z.chomp || 0, f = z.facing || -1;
  ctx.save(); ctx.translate(cx, by);
  if (z.bonk) { const t = z.bonk; ctx.translate((z.bdir || 1) * t * T * 3, -Math.sin(Math.min(t, 1) * Math.PI) * T * 1.6 - t * T); ctx.rotate(t * 12 * (z.bdir || 1)); ctx.globalAlpha = Math.max(0, 1 - t * 1.35); }
  if (z.hurt) ctx.translate(Math.sin(now * 60) * s * 0.06, 0);
  ctx.rotate(wob * 0.5);
  shadow(0, 0, s * 0.38);
  { // painted sprite (assets/zombie_*.png) with a waddle squash and a white hit flash; code drawing is the fallback
    const crowned = !z.gone && z.hp > 0, key = isKing ? (crowned ? 'zombie_king' : 'zombie_king_nocrown') : ('zombie_' + (IMG['zombie_' + z.kind] ? z.kind : 'plain'));
    if (IMG[key]) {
      const hh = s * (isKing ? 1.42 : 1.36) * (isKing && !crowned ? 314 / 360 : 1), im = sprite(key, hh);
      const step = Math.sin(now * 5 + z.id), sq = 1 + Math.abs(step) * 0.05 - chomp * 0.1;
      ctx.save(); ctx.rotate(step * 0.05); ctx.scale(f * (2 - sq), sq);
      drawFlashSprite(im, -im.dw / 2, -im.dh, im.dw, im.dh, z.flash || 0);
      ctx.restore(); ctx.restore(); return;
    }
  }
  const leg = Math.sin(now * 5 + z.id) * s * 0.06;
  ctx.fillStyle = '#5a4a8a'; rr(-s * 0.22, -s * 0.28 + leg, s * 0.16, s * 0.28, s * 0.06); ctx.fill(); rr(s * 0.06, -s * 0.28 - leg, s * 0.16, s * 0.28, s * 0.06); ctx.fill();
  // body (patched shirt)
  ctx.fillStyle = isKing ? '#9b5de5' : '#4f8fd6'; rr(-s * 0.3, -s * 0.72, s * 0.6, s * 0.5, s * 0.14); ctx.fill();
  ctx.fillStyle = isKing ? '#ffd23f' : '#ffb347'; rr(-s * 0.18, -s * 0.6, s * 0.14, s * 0.12, s * 0.03); ctx.fill();
  if (isKing) { ctx.fillStyle = '#e0466b'; ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.72); ctx.lineTo(-s * 0.48, -s * 0.05); ctx.lineTo(s * 0.48, -s * 0.05); ctx.lineTo(s * 0.32, -s * 0.72); ctx.fill(); ctx.fillStyle = '#9b5de5'; rr(-s * 0.3, -s * 0.72, s * 0.6, s * 0.5, s * 0.14); ctx.fill(); for (let k = -2; k <= 2; k++) circ(k * s * 0.1, -s * 0.7, s * 0.05, '#fff'); }
  // arms out front, wobbly
  ctx.strokeStyle = '#8fd36a'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(f * s * 0.2, -s * 0.62); ctx.lineTo(f * s * 0.55, -s * 0.66 + Math.sin(now * 6 + z.id) * s * 0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(f * s * 0.1, -s * 0.52); ctx.lineTo(f * s * 0.5, -s * 0.5 + Math.cos(now * 6 + z.id) * s * 0.05); ctx.stroke();
  // head
  const hy = -s * 0.95;
  ell(0, hy, s * 0.3, s * 0.27, '#8fd36a');
  ell(-s * 0.12, hy - s * 0.12, s * 0.06, s * 0.04, 'rgba(255,255,255,0.35)');
  // googly eyes (different sizes)
  const lx = now * 3 + z.id;
  circ(-s * 0.11, hy - s * 0.04, s * 0.1, '#fff', '#3b2a6b', 2); circ(s * 0.12, hy - s * 0.06, s * 0.075, '#fff', '#3b2a6b', 2);
  circ(-s * 0.11 + Math.cos(lx) * s * 0.04, hy - s * 0.04 + Math.sin(lx) * s * 0.03, s * 0.04, '#222');
  circ(s * 0.12 + Math.sin(lx * 1.3) * s * 0.03, hy - s * 0.06 + Math.cos(lx) * s * 0.02, s * 0.03, '#222');
  // goofy mouth: buck tooth and tongue
  ctx.fillStyle = '#3b2a6b'; ctx.beginPath(); ctx.ellipse(s * 0.02, hy + s * 0.12, s * 0.12, s * 0.04 + chomp * s * 0.05, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.03, hy + s * 0.1, s * 0.05, s * 0.05);
  ell(s * 0.07, hy + s * 0.17 + chomp * s * 0.03, s * 0.04, s * 0.03, '#ff7eb6');
  // hats
  if (isKing) {
    if (!z.gone && z.hp > 0) drawCrown(0, hy - s * 0.32, s * 0.5);
  } else if (z.kind === 'bucket') {
    ctx.fillStyle = '#b9c2d3'; ctx.beginPath(); ctx.moveTo(-s * 0.26, hy - s * 0.12); ctx.lineTo(-s * 0.2, hy - s * 0.48); ctx.lineTo(s * 0.2, hy - s * 0.48); ctx.lineTo(s * 0.26, hy - s * 0.12); ctx.fill();
    ctx.fillStyle = '#8d96a8'; ctx.fillRect(-s * 0.27, hy - s * 0.16, s * 0.54, s * 0.06); ctx.strokeStyle = '#8d96a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, hy - s * 0.3, s * 0.26, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  } else if (z.kind === 'pumpkin') {
    ell(0, hy - s * 0.3, s * 0.27, s * 0.17, '#ff8c1a'); ctx.strokeStyle = '#e06a00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, hy - s * 0.3, s * 0.1, s * 0.17, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#4caf50'; ctx.fillRect(-s * 0.02, hy - s * 0.52, s * 0.05, s * 0.08);
    ctx.fillStyle = '#5a2d00'; ctx.beginPath(); ctx.moveTo(-s * 0.13, hy - s * 0.28); ctx.lineTo(-s * 0.08, hy - s * 0.36); ctx.lineTo(-s * 0.03, hy - s * 0.28); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * 0.03, hy - s * 0.28); ctx.lineTo(s * 0.08, hy - s * 0.36); ctx.lineTo(s * 0.13, hy - s * 0.28); ctx.fill();
  } else {
    ctx.strokeStyle = '#3b2a6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, hy - s * 0.26); ctx.quadraticCurveTo(s * 0.08, hy - s * 0.42, s * 0.16, hy - s * 0.36); ctx.stroke();
  }
  ctx.restore();
}
function drawObj(o, px, py) {
  const cx = px + T / 2, by = py + T * 0.88; let sx = o.shake ? Math.sin(now * 50) * T * 0.05 * o.shake : 0;
  const pop = o.pop ? 1 + Math.sin(o.pop * Math.PI) * 0.25 : 1;
  ctx.save(); ctx.translate(cx + sx, by); ctx.scale(pop, pop); ctx.translate(-cx, -by);
  switch (o.type) {
    case 'tree':
      shadow(cx, by, T * 0.36);
      ctx.fillStyle = '#8a5a2b'; rr(cx - T * 0.09, by - T * 0.5, T * 0.18, T * 0.5, T * 0.05); ctx.fill();
      if (o.dep) { ell(cx, by - T * 0.5, T * 0.11, T * 0.05, '#e8b878'); break; }
      { const k = o.hp === 1 ? 0.8 : 1; circ(cx - T * 0.18, by - T * 0.6, T * 0.24 * k, '#2f9e44'); circ(cx + T * 0.18, by - T * 0.6, T * 0.24 * k, '#2f9e44'); circ(cx, by - T * 0.85, T * 0.28 * k, '#40c057'); circ(cx - T * 0.08, by - T * 0.95, T * 0.08, 'rgba(255,255,255,0.3)'); circ(cx + T * 0.12, by - T * 0.6, T * 0.05, '#ff4d6d'); }
      break;
    case 'rock':
      shadow(cx, by, T * 0.34);
      if (o.dep) { circ(cx - T * 0.12, by - T * 0.06, T * 0.07, '#9aa3b5'); circ(cx + T * 0.1, by - T * 0.05, T * 0.06, '#9aa3b5'); break; }
      drawIcon('stone', cx, by - T * 0.25, T * (o.hp === 1 ? 0.6 : 0.8)); break;
    case 'corn':
      shadow(cx, by, T * 0.25);
      ctx.fillStyle = '#4caf50'; ctx.fillRect(cx - T * 0.03, by - (o.dep ? T * 0.25 : T * 0.75), T * 0.06, o.dep ? T * 0.25 : T * 0.75);
      ctx.fillStyle = '#5cbf3a'; ctx.beginPath(); ctx.moveTo(cx, by - T * 0.2); ctx.quadraticCurveTo(cx - T * 0.35, by - T * 0.3, cx - T * 0.3, by - T * 0.55); ctx.quadraticCurveTo(cx - T * 0.15, by - T * 0.35, cx, by - T * 0.3); ctx.fill();
      if (!o.dep) drawIcon('mielie', cx + T * 0.08, by - T * 0.62, T * 0.55); break;
    case 'bud':
      shadow(cx, by, T * 0.2);
      ctx.fillStyle = '#4caf50'; ctx.fillRect(cx - T * 0.03, by - T * 0.45, T * 0.06, T * 0.45); ell(cx - T * 0.12, by - T * 0.2, T * 0.1, T * 0.05, '#5cbf3a');
      if (o.bloom) { ctx.globalAlpha = Math.min(1, o.bloom * 2); drawIcon('flower', cx, by - T * 0.55, T * (0.6 + (1 - o.bloom) * 0.3)); ctx.globalAlpha = 1; }
      else if (!o.dep) { ell(cx, by - T * 0.55, T * 0.11, T * 0.16, '#ff8fc4'); ell(cx, by - T * 0.5, T * 0.12, T * 0.08, '#5cbf3a'); star(cx + T * 0.2, by - T * 0.75, T * (0.05 + 0.02 * Math.sin(now * 6)), '#fff6a0'); }
      break;
    case 'thorn':
      if ((o.power || 1) > 1) { drawThickThorn(o, cx, by); break; }
      shadow(cx, by, T * 0.42);
      circ(cx - T * 0.2, by - T * 0.3, T * 0.24, '#2e6b3a'); circ(cx + T * 0.2, by - T * 0.3, T * 0.24, '#2e6b3a'); circ(cx, by - T * 0.5, T * 0.28, '#357a42');
      ctx.fillStyle = '#b06bff'; for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.3, r = T * 0.32; const x0 = cx + Math.cos(a) * r * 0.9, y0 = by - T * 0.38 + Math.sin(a) * r * 0.7; ctx.beginPath(); ctx.moveTo(x0, y0 - T * 0.08); ctx.lineTo(x0 + Math.cos(a) * T * 0.1, y0 + Math.sin(a) * T * 0.1); ctx.lineTo(x0 + T * 0.05, y0); ctx.fill(); }
      break;
    case 'bridge':
      ctx.setLineDash([T * 0.08, T * 0.06]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; rr(px + T * 0.06, py + T * 0.1, T * 0.88, T * 0.8, T * 0.1); ctx.stroke(); ctx.setLineDash([]);
      drawIcon('wood', cx, py + T * 0.5, T * 0.5 * (1 + 0.08 * Math.sin(now * 4))); break;
    case 'bench':
      shadow(cx, by, T * 0.4);
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(cx - T * 0.34, by - T * 0.42, T * 0.08, T * 0.42); ctx.fillRect(cx + T * 0.26, by - T * 0.42, T * 0.08, T * 0.42);
      ctx.fillStyle = '#c98a4b'; rr(cx - T * 0.42, by - T * 0.52, T * 0.84, T * 0.16, T * 0.05); ctx.fill();
      if (!S.pick) { ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now * 4); drawIcon('pick', cx, by - T * 0.78, T * 0.5); ctx.globalAlpha = 1; } else drawIcon('check', cx, by - T * 0.75, T * 0.4);
      break;
    case 'boulder':
      shadow(cx, by, T * 0.48);
      ctx.fillStyle = '#8d96a8'; ctx.beginPath(); ctx.ellipse(cx, by - T * 0.42, T * 0.46, T * 0.42, 0, 0, TAU); ctx.fill(); ell(cx - T * 0.15, by - T * 0.6, T * 0.15, T * 0.09, '#b9c2d3');
      ctx.strokeStyle = '#5d6577'; ctx.lineWidth = 3; ctx.beginPath(); if (o.hp < 3) { ctx.moveTo(cx - T * 0.1, by - T * 0.8); ctx.lineTo(cx, by - T * 0.5); ctx.lineTo(cx - T * 0.12, by - T * 0.3); } if (o.hp < 2) { ctx.moveTo(cx + T * 0.25, by - T * 0.6); ctx.lineTo(cx + T * 0.05, by - T * 0.45); ctx.lineTo(cx + T * 0.2, by - T * 0.15); } ctx.stroke();
      break;
    case 'crystal':
      shadow(cx, by, T * 0.35);
      [[-0.18, 0.45, -0.3], [0.16, 0.55, 0.25], [0, 0.75, 0]].forEach(([dx, h, rot]) => { ctx.save(); ctx.translate(cx + dx * T, by - T * 0.05); ctx.rotate(rot); ctx.fillStyle = '#6cc4ff'; ctx.beginPath(); ctx.moveTo(-T * 0.11, 0); ctx.lineTo(-T * 0.11, -h * T * 0.75); ctx.lineTo(0, -h * T); ctx.lineTo(T * 0.11, -h * T * 0.75); ctx.lineTo(T * 0.11, 0); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-T * 0.07, -h * T * 0.7, T * 0.04, h * T * 0.55); ctx.restore(); });
      if (o.hp < 2) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - T * 0.05, by - T * 0.6); ctx.lineTo(cx + T * 0.05, by - T * 0.35); ctx.stroke(); }
      break;
    case 'gem': {
      const bob = Math.sin(now * 3 + o.id) * T * 0.06; shadow(cx, by, T * 0.2);
      drawGem(o.color, cx, by - T * 0.42 + bob, T * 0.26); star(cx + T * 0.22, by - T * 0.65 + bob, T * 0.06 * (1 + Math.sin(now * 7)), '#fff'); break; }
    case 'dragon': case 'troll': {
      let lx = 0, ly = 0, al = 1;
      if (o.leaving) { const t = o.leaving; if (o.type === 'dragon') { ly = -t * t * T * 4; lx = t * T * 1.5; } else lx = t * t * T * 4; al = Math.max(0, 1 - t * 0.7); }
      ctx.globalAlpha = al; ctx.translate(lx, ly); const ch = o.chomp || 0, bob = Math.sin(now * 2.5 + o.id) * T * 0.03;
      if (!o.leaving) shadow(cx, by, T * 0.45);
      if (o.type === 'dragon') {
        const flap = Math.sin(now * (o.leaving ? 20 : 4)) * 0.4;
        ctx.save(); ctx.translate(cx - T * 0.25, by - T * 0.6 + bob); ctx.rotate(-0.4 - flap); ctx.fillStyle = '#ffb3d9'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-T * 0.35, -T * 0.25); ctx.lineTo(-T * 0.1, T * 0.1); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(cx + T * 0.25, by - T * 0.6 + bob); ctx.rotate(0.4 + flap); ctx.fillStyle = '#ffb3d9'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(T * 0.35, -T * 0.25); ctx.lineTo(T * 0.1, T * 0.1); ctx.fill(); ctx.restore();
        ell(cx, by - T * 0.38 + bob, T * 0.36, T * 0.34, '#3ccf9a'); ell(cx, by - T * 0.3 + bob, T * 0.22, T * 0.22, '#c8f7c5');
        const hy = by - T * 0.82 + bob; ell(cx, hy, T * 0.3, T * 0.25, '#3ccf9a');
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(cx - T * 0.15, hy - T * 0.2); ctx.lineTo(cx - T * 0.1, hy - T * 0.38); ctx.lineTo(cx - T * 0.04, hy - T * 0.2); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + T * 0.04, hy - T * 0.2); ctx.lineTo(cx + T * 0.1, hy - T * 0.38); ctx.lineTo(cx + T * 0.15, hy - T * 0.2); ctx.fill();
        circ(cx - T * 0.11, hy - T * 0.03, T * 0.06, '#222'); circ(cx + T * 0.11, hy - T * 0.03, T * 0.06, '#222'); circ(cx - T * 0.09, hy - T * 0.05, T * 0.02, '#fff'); circ(cx + T * 0.13, hy - T * 0.05, T * 0.02, '#fff');
        ell(cx - T * 0.2, hy + T * 0.07, T * 0.05, T * 0.03, '#ff9ec4'); ell(cx + T * 0.2, hy + T * 0.07, T * 0.05, T * 0.03, '#ff9ec4');
        ctx.fillStyle = '#2a7a5a'; ctx.beginPath(); ctx.ellipse(cx, hy + T * 0.1, T * 0.08, T * 0.02 + ch * T * 0.06, 0, 0, TAU); ctx.fill();
      } else {
        ell(cx, by - T * 0.42 + bob, T * 0.42, T * 0.42, '#8d7fd6'); ell(cx, by - T * 0.3 + bob, T * 0.26, T * 0.24, '#b3a8ee');
        const hy = by - T * 0.8 + bob;
        ctx.fillStyle = '#ff9f1c'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(cx + k * T * 0.07 - T * 0.04, hy - T * 0.2); ctx.lineTo(cx + k * T * 0.09, hy - T * 0.42); ctx.lineTo(cx + k * T * 0.07 + T * 0.04, hy - T * 0.2); ctx.fill(); }
        circ(cx - T * 0.12, hy - T * 0.06, T * 0.07, '#fff'); circ(cx + T * 0.12, hy - T * 0.06, T * 0.07, '#fff'); circ(cx - T * 0.12, hy - T * 0.05, T * 0.035, '#222'); circ(cx + T * 0.12, hy - T * 0.05, T * 0.035, '#222');
        ell(cx, hy + T * 0.06, T * 0.1, T * 0.08, '#a395f0');
        ctx.fillStyle = '#4a3c8c'; ctx.beginPath(); ctx.ellipse(cx, hy + T * 0.2, T * 0.14, T * 0.03 + ch * T * 0.06, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(cx - T * 0.1, hy + T * 0.13, T * 0.05, T * 0.07); ctx.fillRect(cx + T * 0.05, hy + T * 0.13, T * 0.05, T * 0.07);
      }
      ctx.globalAlpha = 1;
      if (!o.leaving) { const res = o.type === 'dragon' ? 'mielie' : 'flower'; for (let k = 0; k < o.need; k++) { ctx.globalAlpha = k < o.fed ? 1 : 0.3; heart(cx + (k - (o.need - 1) / 2) * T * 0.24, by - T * 1.25, T * 0.1, '#ff4d6d'); } ctx.globalAlpha = 1; if (!bubbles.some(b => b.o === o)) { drawIcon(res, cx + T * 0.42, by - T * 1.05 + Math.sin(now * 4) * 3, T * 0.32); } }
      break; }
    case 'block': {
      const ox = o.slide ? -o.sdx * o.slide * T : 0, oy = o.slide ? -o.sdy * o.slide * T : 0;
      ctx.translate(ox, oy); shadow(cx, by, T * 0.42);
      ctx.fillStyle = '#b97a3d'; rr(px + T * 0.1, py + T * 0.08, T * 0.8, T * 0.8, T * 0.1); ctx.fill(); ctx.fillStyle = '#d99a58'; rr(px + T * 0.16, py + T * 0.12, T * 0.68, T * 0.66, T * 0.08); ctx.fill();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + T * 0.18, py + T * 0.14); ctx.lineTo(px + T * 0.82, py + T * 0.76); ctx.stroke(); star(cx, py + T * 0.45, T * 0.16, '#ffd23f');
      break; }
    case 'plate': {
      const on = o.pressed; ell(cx, py + T * 0.55, T * 0.4, T * 0.28, on ? '#2fb84f' : '#8d86b8'); ell(cx, py + T * 0.5, T * 0.32, T * 0.2, on ? '#7bf09b' : '#ffd23f');
      if (!on) star(cx, py + T * 0.5, T * 0.12 * (1 + 0.15 * Math.sin(now * 5)), '#fff'); break; }
    case 'gate':
      if (o.open) { ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px + T * 0.02, py - T * 0.3, T * 0.12, T * 1.2); ctx.fillRect(px + T * 0.86, py - T * 0.3, T * 0.12, T * 1.2); break; }
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px + T * 0.02, py - T * 0.3, T * 0.12, T * 1.2); ctx.fillRect(px + T * 0.86, py - T * 0.3, T * 0.12, T * 1.2);
      ctx.fillStyle = '#6b4320'; for (let k = 0; k < 4; k++) ctx.fillRect(px + T * (0.2 + k * 0.18), py - T * 0.1, T * 0.08, T * 0.95); ctx.fillRect(px + T * 0.1, py + T * 0.1, T * 0.8, T * 0.08); ctx.fillRect(px + T * 0.1, py + T * 0.55, T * 0.8, T * 0.08);
      drawIcon('lock', cx, py + T * 0.35, T * 0.35); break;
    case 'lantern': {
      shadow(cx, by, T * 0.18); if ((o.magic || 1) > 1) drawMagicBase(o, cx, by);
      if (o.lit) { const g = ctx.createRadialGradient(cx, by - T * 0.8, 1, cx, by - T * 0.8, T * 0.8); g.addColorStop(0, 'rgba(255,230,120,0.75)'); g.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = g; ctx.fillRect(cx - T, by - T * 1.6, T * 2, T * 1.6); }
      ctx.fillStyle = '#5b4f8f'; ctx.fillRect(cx - T * 0.04, by - T * 0.65, T * 0.08, T * 0.65);
      ctx.fillStyle = '#5b4f8f'; rr(cx - T * 0.17, by - T * 1.02, T * 0.34, T * 0.4, T * 0.06); ctx.fill();
      ctx.fillStyle = o.lit ? '#ffe066' : '#3b3566'; rr(cx - T * 0.12, by - T * 0.97, T * 0.24, T * 0.3, T * 0.04); ctx.fill();
      if (o.lit) { ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.ellipse(cx, by - T * 0.8, T * 0.04, T * 0.08 + Math.sin(now * 12) * T * 0.01, 0, 0, TAU); ctx.fill(); }
      else star(cx + T * 0.24, by - T * 1.05, T * 0.06 * (1 + 0.3 * Math.sin(now * 5)), '#fff6a0');
      break; }
    case 'exit': {
      const p = 1 + Math.sin(now * 4) * 0.08;
      ell(cx, py + T * 0.55, T * 0.42 * p, T * 0.28 * p, 'rgba(255,255,255,0.55)'); ell(cx, py + T * 0.55, T * 0.32 * p, T * 0.2 * p, '#ffe066');
      for (let k = 0; k < 3; k++) { const a = now * 2 + k * 2.1; star(cx + Math.cos(a) * T * 0.35, py + T * 0.35 + Math.sin(a) * T * 0.15, T * 0.07, '#fff'); }
      ctx.save(); ctx.translate(cx, py + T * 0.3 - Math.abs(Math.sin(now * 3)) * T * 0.1); ctx.rotate(-Math.PI / 2); drawIcon('arrow', 0, 0, T * 0.5); ctx.restore();
      break; }
    case 'gemgate': {
      ctx.fillStyle = '#6f679e'; ctx.fillRect(px - T * 0.06, py - T * 0.5, T * 1.12, T * 1.5);
      if (o.open) { ctx.fillStyle = '#2b2550'; rr(px + T * 0.1, py - T * 0.3, T * 0.8, T * 1.3, T * 0.4); ctx.fill(); break; }
      ctx.fillStyle = '#c98a4b'; rr(px + T * 0.08, py - T * 0.35, T * 0.84, T * 1.35, T * 0.42); ctx.fill();
      ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + T * (0.08 + k * 0.21), py - T * 0.2); ctx.lineTo(px + T * (0.08 + k * 0.21), py + T); ctx.stroke(); }
      GEMS.forEach((c, k) => { const gx = px + T * (0.25 + k * 0.25), gy = py + T * 0.15; circ(gx, gy, T * 0.11, '#3b3566'); if (o.slots[k]) drawGem(c, gx, gy, T * 0.1); else { gemPath(c, gx, gy, T * 0.09); ctx.strokeStyle = GEMCOL[c]; ctx.lineWidth = 2; ctx.stroke(); } });
      break; }
    case 'crown': {
      const lift = o.lift ? Math.min(1, o.lift) : 0;
      ell(cx, by - T * 0.1, T * 0.34, T * 0.12, '#e0466b'); ctx.fillStyle = '#e0466b'; rr(cx - T * 0.32, by - T * 0.32, T * 0.64, T * 0.24, T * 0.1); ctx.fill();
      const cy2 = by - T * 0.52 - lift * T * 0.8 + Math.sin(now * 3) * T * 0.04;
      const g = ctx.createRadialGradient(cx, cy2, 1, cx, cy2, T * 0.6); g.addColorStop(0, 'rgba(255,240,150,0.8)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; ctx.fillRect(cx - T * 0.6, cy2 - T * 0.6, T * 1.2, T * 1.2);
      drawCrown(cx, cy2, T * 0.6 * (1 + lift * 0.4)); break; }
    case 'zombie': drawZombie(o, cx + zx(o), by + zy(o), T * 0.95, false);
      if (o.guards && !o.poof) archerBadge(cx + zx(o) + T * 0.36, by + zy(o) - T * 1.25, T * 0.17); break;
    case 'target': {
      shadow(cx, by, T * 0.3); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(cx - T * 0.05, by - T * 0.55, T * 0.1, T * 0.55); ctx.fillRect(cx - T * 0.25, by - T * 0.08, T * 0.5, T * 0.08);
      const ty = by - T * 0.72, tilt = o.hit ? 0 : Math.sin(now * 2 + o.id) * 0.05;
      ctx.save(); ctx.translate(cx, ty); ctx.rotate(tilt); drawTargetBoard(0, 0, T * 0.34, o.hit); ctx.restore();
      if (o.hit) { ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(2, T * 0.04); ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx + T * 0.3, ty - T * 0.18); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx + T * 0.26, ty - T * 0.16); ctx.lineTo(cx + T * 0.36, ty - T * 0.28); ctx.lineTo(cx + T * 0.34, ty - T * 0.12); ctx.fill(); drawIcon('check', cx + T * 0.3, by - T * 1.15, T * 0.34); }
      else archerBadge(cx + T * 0.36, by - T * 1.12, T * 0.17);
      break; }
    case 'drawbridge': {
      // raised drawbridge leaning on the far side of the chasm, with its ropes
      ctx.setLineDash([T * 0.08, T * 0.06]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; rr(px + T * 0.08, py + T * 0.1, T * 0.84, T * 0.8, T * 0.1); ctx.stroke(); ctx.setLineDash([]);
      const sh = o.shake ? Math.sin(now * 40) * T * 0.02 : 0;
      ctx.fillStyle = '#8a5a2b'; rr(px + T * 0.14 + sh, py - T * 0.55, T * 0.72, T * 0.62, T * 0.05); ctx.fill();
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? '#c98a4b' : '#d99a58'; rr(px + T * (0.18 + k * 0.22) + sh, py - T * 0.5, T * 0.19, T * 0.52, T * 0.04); ctx.fill(); }
      ctx.strokeStyle = '#e8d6b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + T * 0.16, py - T * 0.5); ctx.lineTo(px + T * 0.02, py - T * 0.9); ctx.moveTo(px + T * 0.84, py - T * 0.5); ctx.lineTo(px + T * 0.98, py - T * 0.9); ctx.stroke();
      ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now * 4); drawIcon('target', cx, py + T * 0.55, T * 0.42); ctx.restore();
      break; }
    case 'hanging': {
      const r = o.reward || {}, fall = o.fall ? Math.min(1, o.fall / 0.45) : 0, sw = o.fall ? 0 : Math.sin(now * 2 + o.id) * 0.12;
      // a branch sticking out with a rope
      ctx.fillStyle = '#7a4a22'; rr(cx - T * 0.55, py - T * 0.62, T * 0.95, T * 0.13, T * 0.06); ctx.fill(); circ(cx - T * 0.1, py - T * 0.66, T * 0.16, '#2f9e44'); circ(cx + T * 0.2, py - T * 0.64, T * 0.12, '#37b24d');
      ctx.save(); ctx.translate(cx + T * 0.1, py - T * 0.52); ctx.rotate(sw);
      if (!o.fall) { ctx.strokeStyle = '#e8d6b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, T * 0.5); ctx.stroke(); }
      ctx.translate(0, T * 0.62 + easeOut(fall) * T * 0.7); ctx.rotate(fall * 0.6);
      if (r.gem) { // little cage with a gem inside
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, T * 0.4); g.addColorStop(0, 'rgba(255,240,150,0.7)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; ctx.fillRect(-T * 0.4, -T * 0.4, T * 0.8, T * 0.8);
        drawGem(r.gem, 0, T * 0.02, T * 0.16); ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = Math.max(2, T * 0.035);
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * T * 0.07, -T * 0.18); ctx.lineTo(k * T * 0.09, T * 0.2); ctx.stroke(); }
        ell(0, -T * 0.19, T * 0.17, T * 0.05, '#c98a4b'); ell(0, T * 0.21, T * 0.2, T * 0.05, '#8a5a2b');
      } else { // basket of mielies
        drawIcon(r.res || 'mielie', -T * 0.08, -T * 0.06, T * 0.4); drawIcon(r.res || 'mielie', T * 0.1, -T * 0.08, T * 0.4);
        ctx.fillStyle = '#c98a4b'; ctx.beginPath(); ctx.moveTo(-T * 0.24, -T * 0.02); ctx.lineTo(T * 0.24, -T * 0.02); ctx.lineTo(T * 0.17, T * 0.2); ctx.lineTo(-T * 0.17, T * 0.2); ctx.fill();
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(-T * 0.22, T * (0.05 + k * 0.08)); ctx.lineTo(T * 0.22, T * (0.05 + k * 0.08)); ctx.stroke(); }
      }
      ctx.restore();
      if (!o.fall) archerBadge(cx + T * 0.42, py - T * 0.1, T * 0.16);
      break; }
    case 'king': drawZombie(o, cx, by, T * 1.25, true); break;
    case 'boss': drawBoss(o, cx, by, T * 1.35); break;
    case 'queen': drawQueenObj(o, cx, by); break;
    case 'mirror': drawMirror(o, cx, by, T); break;
  }
  ctx.restore();
}
function zlerp(o) { if (o.px === undefined) return 1; return easeOut(Math.min(1, (o.mt || 0) * 2)); }
function zx(o) { return o.px === undefined ? 0 : (o.px - o.x) * (1 - zlerp(o)) * T; }
function zy(o) { return o.py === undefined ? 0 : (o.py - o.y) * (1 - zlerp(o)) * T; }

/* ---------------- Heroes ---------------- */
function drawHero(h, px, py, active) {
  if (cine && cine.hide === h.name) return;
  const cx = px + T / 2, by = py + T * 0.9, walking = h.path.length > 0;
  const bob = walking ? Math.abs(Math.sin(now * 14 * Math.sqrt(SPEED))) * T * 0.08 : Math.sin(now * 3 + (h.name === 'ruru' ? 1 : 0)) * T * 0.015;
  const sq = h.squash ? Math.sin(h.squash * Math.PI) * 0.12 : 0, ps = fxPose(h, h.name === 'ruru' ? 1 : h.name === 'mielie' ? 2.3 : 3.9);
  shadow(cx + ps.dx, by, T * 0.3 * (1 + (ps.sx - 1) * 2));
  if (active) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, by, T * 0.38, T * 0.13, 0, 0, TAU); ctx.stroke(); }
  const img = heroSprite(h.name, T * (h.name === ARCHER ? 1.58 : 1.45));
  ctx.save(); ctx.translate(cx + ps.dx + (h.bump ? Math.sin(h.bump * 30) * T * 0.08 : 0), by - bob);
  ctx.rotate(ps.rot + (walking ? Math.sin(now * 14 * Math.sqrt(SPEED)) * 0.06 : (h.feisty ? (h.facing || 1) * 0.12 * Math.min(1, h.feisty * 2) : h.aim ? -(h.facing || 1) * 0.08 * Math.sin(h.aim * Math.PI) : 0)));
  if (h.feisty) ctx.translate(0, -Math.abs(Math.sin(h.feisty * Math.PI * 2)) * T * 0.08);
  ctx.scale((h.facing || 1) * (1 + sq) * ps.sx, (1 - sq) * ps.sy);
  if (img) { ctx.drawImage(img, -img.dw / 2, -img.dh, img.dw, img.dh); drawGearOverlay(h.name, -img.dw / 2, -img.dh, img.dw, img.dh);
    if (ps.flash > 0) { ctx.globalAlpha = Math.min(1, ps.flash) * 0.7; ctx.drawImage(tinted(img, '#ffc2d4'), -img.dw / 2, -img.dh, img.dw, img.dh); ctx.globalAlpha = 1; } }
  else { circ(0, -T * 0.6, T * 0.3, (HERO[h.name] || {}).color || '#ff6fae'); }
  ctx.restore();
  if (h.cast) { const a = h.cast; ctx.globalAlpha = a; for (let k = 0; k < 4; k++) star(cx + (h.facing || 1) * T * 0.35 + Math.cos(now * 9 + k * 1.6) * T * 0.15, by - T * 0.9 + Math.sin(now * 9 + k * 1.6) * T * 0.15, T * 0.07, h.name === 'mielie' ? '#ffd23f' : h.name === ARCHER ? '#ffe680' : '#fff'); ctx.globalAlpha = 1; }
  if (h.feisty) { // determined 'hmph' marks by her head
    const f = h.facing || 1, hx = cx - f * T * 0.42, hy = by - T * 1.25; ctx.globalAlpha = Math.min(1, h.feisty * 2); ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = Math.max(3, T * 0.05); ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { const a = Math.PI + (f > 0 ? 0 : Math.PI) + k * 0.5; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * T * 0.08 * f, hy + Math.sin(a) * T * 0.08); ctx.lineTo(hx + Math.cos(a) * T * 0.2 * f, hy + Math.sin(a) * T * 0.2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (h.bump) { for (let k = 0; k < 3; k++) star(cx + Math.cos(now * 8 + k * 2.1) * T * 0.25, by - T * 1.5 + Math.sin(now * 8 + k * 2.1) * T * 0.06, T * 0.07, '#ffd23f'); }
  if (active) { const ay = by - T * 1.62 - Math.abs(Math.sin(now * 4)) * T * 0.08; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(cx - T * 0.1, ay - T * 0.1); ctx.lineTo(cx + T * 0.1, ay - T * 0.1); ctx.lineTo(cx, ay + T * 0.04); ctx.fill(); }
}
function drawDecor(d, px, py) {
  const cx = px + T / 2, by = py + T * 0.88;
  if (d.type === 'flowers') { for (let k = 0; k < 4; k++) { const fx = cx + (hash(d.x + k, d.y) - 0.5) * T * 0.7, fy = by - T * 0.15 - hash(d.x, d.y + k) * T * 0.4; ctx.fillStyle = '#4caf50'; ctx.fillRect(fx - 1, fy, 2, T * 0.15); drawIcon('flower', fx, fy, T * 0.28 * Math.min(1, d.t * 3)); } return; }
  const s = (d.big ? 1.5 : 0.8) * T, t = d.t, hop = Math.abs(Math.sin(t * 7)) * T * 0.25;
  ctx.globalAlpha = Math.max(0, Math.min(1, 3 - t)); const x = cx + d.dir * t * T * 0.9, y = by - hop;
  shadow(x, by, s * 0.2);
  ell(x, y - s * 0.2, s * 0.22, s * 0.18, '#fff'); ell(x + d.dir * s * 0.15, y - s * 0.42, s * 0.15, s * 0.13, '#fff');
  ell(x + d.dir * s * 0.1, y - s * 0.68, s * 0.04, s * 0.14, '#fff'); ell(x + d.dir * s * 0.2, y - s * 0.66, s * 0.04, s * 0.14, '#fff'); ell(x + d.dir * s * 0.2, y - s * 0.66, s * 0.02, s * 0.1, '#ffb3d9');
  circ(x + d.dir * s * 0.2, y - s * 0.44, s * 0.025, '#222'); circ(x + d.dir * s * 0.29, y - s * 0.4, s * 0.02, '#ff7eb6'); circ(x - d.dir * s * 0.22, y - s * 0.22, s * 0.06, '#fff');
  if (d.big) drawCrown(x + d.dir * s * 0.15, y - s * 0.62, s * 0.18);
  ctx.globalAlpha = 1;
}
function drawWorld() {
  const lid = LEVELS[L.i].id, mood = S.twist === 'queen' ? 'night' : lid === 'castle' ? 'dusk' : 'day';
  { const bg = ctx.createLinearGradient(0, 0, 0, H), c = lid === 'hills' ? ['#c19266', '#8a5a35'] : mood === 'night' ? ['#2c5a4a', '#173a33'] : ['#45b45a', '#1f7038']; bg.addColorStop(0, c[0]); bg.addColorStop(1, c[1]); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
  const ox = cam.x + (shakeAmt ? rnd(-shakeAmt, shakeAmt) : 0), oy = cam.y + (shakeAmt ? rnd(-shakeAmt, shakeAmt) : 0);
  const X = x => ox + x * T, Y = y => oy + y * T;
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const g = L.grid[y][x]; if (!TALL[g]) drawGround(x, y, g, X(x), Y(y)); else drawGround(x, y, '.', X(x), Y(y)); }
  for (const o of L.objs) if (!o.gone && FLAT[o.type]) drawObj(o, X(o.x), Y(o.y));
  for (const d of decor) if (d.type === 'flowers') drawDecor(d, X(d.x), Y(d.y));
  for (const r of ripples) { const c = w2s(r.x + 0.5, r.y + 0.5); ctx.globalAlpha = 1 - r.t; ctx.strokeStyle = r.ok ? '#fff' : '#ff4d6d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(c.x, c.y + T * 0.2, T * 0.2 + r.t * T * 0.3, (T * 0.2 + r.t * T * 0.3) * 0.45, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  const hint = idle > 7 && !popup && !trans ? getHint() : null;
  const hs = Object.values(heroes);
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) { const g = L.grid[y][x]; if (TALL[g]) drawTall(x, y, g, X(x), Y(y)); }
    for (const o of L.objs) if (!o.gone && !FLAT[o.type] && o.y === y) {
      if (o.poof) { // zapped: jitter and flash white-pink before turning to dust
        o.poof += 1 / 60; const k = Math.min(1, o.poof / 0.3 * SPEED), c = { x: X(o.x) + T / 2, y: Y(o.y) + T * 0.9 }; o.flash = Math.max(o.flash || 0, 0.55 + 0.45 * Math.sin(now * 50));
        ctx.save(); ctx.translate(c.x + Math.sin(now * 90) * T * 0.05, c.y); ctx.scale(1 - k * 0.4, 1 - k * 0.4); ctx.translate(-c.x, -c.y);
        drawObj(o, X(o.x), Y(o.y)); ctx.restore();
        { const gr = ctx.createRadialGradient(c.x, c.y - T * 0.5, 1, c.x, c.y - T * 0.5, T * 0.7); gr.addColorStop(0, o.pinged ? 'rgba(255,240,150,0.9)' : 'rgba(255,225,252,0.9)'); gr.addColorStop(1, 'rgba(255,220,250,0)'); ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now * 40); ctx.fillStyle = gr; ctx.fillRect(c.x - T * 0.7, c.y - T * 1.2, T * 1.4, T * 1.4); ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(c.x, c.y - T * 0.5); ctx.rotate(now * 4); for (let q = 0; q < 4; q++) { ctx.rotate(TAU / 4); star(T * 0.35 * (0.5 + k), 0, T * 0.06, '#fff6a0', 4, 0.35); } ctx.restore(); }
      } else drawObj(o, X(o.x), Y(o.y));
    }
    for (const o of L.objs) if (o.gone && o.bonk && o.y === y) drawObj(o, X(o.x), Y(o.y));
    for (const d of decor) if (d.type === 'bunny' && d.y === y) drawDecor(d, X(d.x), Y(d.y));
    hs.filter(h => Math.round(h.fy) === y).sort((a, b) => (a.name === S.active) - (b.name === S.active)).forEach(h => drawHero(h, X(h.fx), Y(h.fy), h.name === S.active));
  }
  if (hint && hint.ui) { const b = UI.forge, bounce = Math.abs(Math.sin(now * 5)) * 14; ctx.save(); ctx.translate(b.x, b.y - 50 - bounce); ctx.rotate(Math.PI / 2); drawIcon('arrow', 0, 0, 44); ctx.restore(); }
  else if (hint) { const c = w2s(hint.x + 0.5, hint.y); const bounce = Math.abs(Math.sin(now * 5)) * T * 0.2; ctx.save(); ctx.translate(c.x, c.y - T * 0.45 - bounce); ctx.rotate(Math.PI / 2); drawIcon('arrow', 0, 0, T * 0.7); ctx.restore(); circ(c.x, c.y + T * 0.5, T * 0.5 + Math.sin(now * 5) * 4, null, 'rgba(255,255,255,0.8)', 4); }
  // mood light: castle dusk glow, twist night, soft vignette everywhere
  if (mood === 'night') { ctx.fillStyle = 'rgba(46,24,110,0.22)'; ctx.fillRect(0, 0, W, H); vignette('rgba(20,8,60,A)', 0.55); }
  else if (mood === 'dusk') { ctx.fillStyle = 'rgba(255,150,120,0.07)'; ctx.fillRect(0, 0, W, H); vignette('rgba(60,20,90,A)', 0.4); }
  else vignette('rgba(10,50,20,A)', 0.22);
  for (const z of zaps) drawZap(z);
  for (const a of arrows) drawArrow(a);
  drawFxRings(true);
  for (const p of particles) drawParticle(p);
  for (const b of bubbles) drawBubble(b);
}
function drawZap(z) {
  const a = w2s(z.x0, z.y0), b = w2s(z.x1, z.y1), n = 7, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const pts = [a]; for (let k = 1; k < n; k++) { const j = (hash(k * 7 + Math.floor(now * 30), 3) - 0.5) * T * 0.35; pts.push({ x: a.x + dx * k / n + nx * j, y: a.y + dy * k / n + ny * j }); } pts.push(b);
  ctx.globalAlpha = Math.max(0, 1 - z.t); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  [[T * 0.22, 'rgba(255,120,220,0.45)'], [T * 0.11, '#ffe066'], [T * 0.04, '#fff']].forEach(([w, c]) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); });
  star(b.x, b.y, T * 0.25 * (1 + z.t), '#fff6a0'); ctx.globalAlpha = 1;
}
/* Lillie-Bee's glowing arrow, flying in a little arc */
function drawArrow(a) {
  const t = clamp(a.t, 0, 1), d = Math.hypot(a.x1 - a.x0, a.y1 - a.y0), arc = Math.min(1.2, 0.25 + d * 0.1);
  const pos = k => ({ x: a.x0 + (a.x1 - a.x0) * k, y: a.y0 + (a.y1 - a.y0) * k - Math.sin(k * Math.PI) * arc });
  const p = w2s(pos(t).x, pos(t).y), q = w2s(pos(Math.max(0, t - 0.04)).x, pos(Math.max(0, t - 0.04)).y), ang = Math.atan2(p.y - q.y, p.x - q.x);
  // sparkly trail
  for (let k = 1; k <= 5; k++) { const tt = t - k * 0.06; if (tt < 0) break; const r = w2s(pos(tt).x, pos(tt).y); ctx.globalAlpha = 0.6 - k * 0.1; star(r.x, r.y, T * (0.09 - k * 0.012), a.tier === 'star' ? ['#8fd6ff', '#fff6a0', '#ff9ed2'][k % 3] : '#fff6a0'); }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, T * 0.4); g.addColorStop(0, 'rgba(255,230,110,0.85)'); g.addColorStop(1, 'rgba(255,230,110,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - T * 0.4, p.y - T * 0.4, T * 0.8, T * 0.8);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = Math.max(2, T * 0.045); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-T * 0.42, 0); ctx.lineTo(0, 0); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-T * 0.42, 0); ctx.lineTo(-T * 0.52, -T * 0.09); ctx.lineTo(-T * 0.34, 0); ctx.lineTo(-T * 0.52, T * 0.09); ctx.fill();
  ctx.fillStyle = a.tier === 'star' ? '#bfe9ff' : '#ffd23f'; ctx.beginPath(); ctx.moveTo(T * 0.16, 0); ctx.lineTo(-T * 0.02, -T * 0.09); ctx.lineTo(-T * 0.02, T * 0.09); ctx.fill();
  ctx.restore();
}
function drawParticle(p) {
  const s = w2s(p.x, p.y), r = p.size * T, a = Math.min(1, p.life * 2); ctx.globalAlpha = a;
  switch (p.kind) {
    case 'spark': star(s.x, s.y, r * 1.2, '#fff6a0'); break;
    case 'star': star(s.x, s.y, r * 1.3, '#ffd23f'); break;
    case 'heart': heart(s.x, s.y, r * 1.4, '#ff4d6d'); break;
    case 'leaf': ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(p.rot); ell(0, 0, r, r * 0.5, '#5cbf3a'); ctx.restore(); break;
    case 'dust': circ(s.x, s.y, r, '#cfd4de'); break;
    case 'puff': circ(s.x, s.y, r * 1.8, 'rgba(255,255,255,0.85)'); break;
    case 'sdust': circ(s.x, s.y, r * (2.6 - p.life), ['rgba(230,200,255,0.8)', 'rgba(255,210,240,0.8)', 'rgba(255,245,200,0.8)'][(p.rot * 10 | 0) % 3 < 0 ? 0 : (p.rot * 10 | 0) % 3]); break;
    case 'glitter': ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(p.rot); ctx.fillStyle = ['#ff7eb6', '#ffd23f', '#b06bff', '#7fe0ff', '#fff'][(Math.abs(p.rot * 10) | 0) % 5]; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.5, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.5, 0); ctx.fill(); ctx.restore(); break;
    case 'confetti': ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-r * 0.6, -r * 0.3, r * 1.2, r * 0.6); ctx.restore(); break;
  }
  ctx.globalAlpha = 1;
}
function drawBubble(b) {
  const o = b.o; const ox = o.type === 'zombie' ? zx(o) : 0;
  const c = w2s((o.fx !== undefined ? o.fx : o.x) + 0.5, (o.fy !== undefined ? o.fy : o.y) - (o.type === 'king' || o.type === 'boss' || o.type === 'queen' ? 0.95 : o.name ? 0.7 : 0.45)); c.x += ox;
  const sc = easeOut(Math.min(1, b.t * 5)), item = T * 0.55, pad = 10;
  const widths = b.items.map(it => it.text ? (ctx.font = `900 ${Math.round(T * 0.3)}px system-ui`, ctx.measureText(it.text).width + 8) : it.n ? item * 1.9 : item);
  const w = widths.reduce((a, v) => a + v, 0) + pad * 2 + (b.items.length - 1) * 6, h = item + pad * 1.4;
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sc, sc);
  const x0 = clamp(-w / 2, -c.x + 6, W - c.x - w - 6);
  ctx.fillStyle = '#fff'; rr(x0, -h, w, h, h * 0.4); ctx.fill(); ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(8, -1); ctx.lineTo(0, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(91,79,143,0.25)'; ctx.lineWidth = 3; rr(x0, -h, w, h, h * 0.4); ctx.stroke();
  let x = x0 + pad;
  b.items.forEach((it, k) => {
    const cy = -h / 2;
    if (it.text) { txt(it.text, x + widths[k] / 2, cy, Math.round(T * 0.3), '#5a8f2e', null); }
    else if (it.head) { const im = sprite(it.head + 'Head', item); circ(x + item / 2, cy, item / 2, (HERO[it.head] || {}).color || '#ffc2e0'); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(x + item / 2, cy, item / 2, 0, TAU); ctx.clip(); ctx.drawImage(im, x, cy - item / 2, item, item); ctx.restore(); } }
    else if (it.gear) { circ(x + item / 2, cy, item / 2, '#fff3d6'); drawGearIcon(it.gear, it.tier, x + item / 2, cy, item * 0.85); }
    else { if (it.dim) ctx.globalAlpha = 0.28; drawIcon(it.icon, x + item / 2, cy, item * 0.9); ctx.globalAlpha = 1; if (it.n) txt((it.have !== undefined ? Math.min(it.have, it.n) + '/' : '') + it.n, x + item * 1.4, cy, Math.round(T * 0.28), (it.have || 0) >= it.n ? '#2fb84f' : '#ff4d6d', null); }
    x += widths[k] + 6;
  });
  ctx.restore();
}

/* ---------------- UI ---------------- */
function btn(id, x, y, r, fn) { hits.push({ id, x, y, r, fn }); }
function roundBtn(id, x, y, r, col, icon, fn, scale = 1) {
  const ps = pressScale(id); ctx.save(); ctx.translate(x, y); ctx.scale(scale * ps, scale * ps);
  ell(0, r * 0.95, r * 0.8, r * 0.2, 'rgba(40,20,80,0.18)'); circ(0, r * 0.12, r, 'rgba(40,20,80,0.28)'); circ(0, 0, r, col);
  { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.14)'); circ(0, 0, r, g); }
  circ(0, 0, r, null, '#fff', 4); ell(-r * 0.3, -r * 0.48, r * 0.38, r * 0.15, 'rgba(255,255,255,0.45)');
  if (icon) drawIcon(icon, 0, 0, r * 1.1);
  ctx.restore(); btn(id, x, y, Math.max(r, 32), fn);
}
function pillBtn(id, x, y, w, h, col, label, icon, fn) {
  const ps = pressScale(id); ctx.save(); ctx.translate(x, y); ctx.scale(ps, ps); ctx.translate(-x, -y);
  ctx.fillStyle = 'rgba(40,20,80,0.28)'; rr(x - w / 2, y - h / 2 + 7, w, h, h / 2); ctx.fill();
  ctx.fillStyle = col; rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  { const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, 'rgba(255,255,255,0.3)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.16)'); ctx.fillStyle = g; rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.stroke();
  ell(x - w * 0.18, y - h * 0.3, w * 0.27, h * 0.1, 'rgba(255,255,255,0.4)');
  let lx = x; if (icon) { drawIcon(icon, x - w / 2 + h * 0.55, y, h * 0.6); lx = x + h * 0.25; }
  if (label) txt(label, lx, y, Math.round(h * 0.42));
  ctx.restore(); hits.push({ id, x, y, w, h, fn });
}
function drawHUD() {
  for (const p of UI.pills) {
    if (p.res === 'pick' && !S.pick) continue;
    const b = pillBounce[p.res] || 0, sc = 1 + Math.sin(b * Math.PI) * 0.18;
    ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.scale(sc, sc); ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
    ctx.fillStyle = 'rgba(59,42,107,0.25)'; rr(p.x, p.y + 4, p.w, p.h, p.h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.94)'; rr(p.x, p.y, p.w, p.h, p.h / 2); ctx.fill();
    if (p.res === 'gems') drawIcon('gems', p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w * 0.95, 70));
    else if (p.res === 'pick') { drawIcon('pick', p.x + p.w / 2, p.y + p.h / 2, p.h * 0.8); }
    else { const is = Math.min(p.h * 0.72, p.w * 0.45); drawIcon(p.res, p.x + is * 0.62, p.y + p.h / 2, is); txt(String(Math.max(0, S.inv[p.res] - (pend[p.res] || 0))), p.x + p.w - Math.min(p.w * 0.27, 24), p.y + p.h / 2 + 1, Math.round(Math.min(28, p.w * 0.34)), '#3b2a6b', null); }
    ctx.restore();
  }
  // switch hero button shows the OTHER hero (tap to play as them)
  const o = otherHero(), sw = UI.sw, pulse = switchPulse > 0 ? 1 + Math.abs(Math.sin(now * 8)) * 0.15 : 1 + Math.sin(now * 2) * 0.03;
  ctx.save(); ctx.translate(sw.x, sw.y); ctx.scale(pulse, pulse);
  circ(0, 5, sw.r, 'rgba(0,0,0,0.25)'); circ(0, 0, sw.r, (HERO[o.name] || {}).color || '#ff8fc4');
  const im = sprite(o.name + 'Head', sw.r * 2); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, sw.r - 4, 0, TAU); ctx.clip(); ctx.drawImage(im, -sw.r, -sw.r, sw.r * 2, sw.r * 2); ctx.restore(); }
  circ(0, 0, sw.r, null, '#fff', 5);
  circ(sw.r * 0.68, -sw.r * 0.68, sw.r * 0.36, '#ffd23f', '#fff', 3); drawIcon((HERO[o.name] || {}).tool || 'wand', sw.r * 0.68, -sw.r * 0.68, sw.r * 0.5);
  circ(-sw.r * 0.7, sw.r * 0.62, sw.r * 0.3, '#7b5cff', '#fff', 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-sw.r * 0.7, sw.r * 0.62, sw.r * 0.14, 0.3, 5.3); ctx.stroke();
  ctx.restore(); btn('switch', sw.x, sw.y, sw.r, switchHero);
  // party dots above the switch button: who is playing now, and who comes next
  { const p = partyNames(); p.forEach((n, k) => { const dx = (k - (p.length - 1) / 2) * 22, dy = sw.y - sw.r - 18; circ(sw.x + dx, dy, n === S.active ? 9 : 6, HERO[n].color, '#fff', n === S.active ? 3 : 2); }); }
  // Lillie-Bee's quest button (shows the area's quest card again)
  if ((LEVELS[L.i].quest || twistQuestArea()) && ARCHER) {
    const q = UI.quest, b = 1 + (questCard ? 0 : Math.sin(now * 3) * 0.04);
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(b, b); circ(0, 4, q.r, 'rgba(0,0,0,0.22)'); ctx.restore();
    archerBadge(q.x, q.y, q.r * b); circ(q.x + q.r * 0.7, q.y - q.r * 0.7, q.r * 0.38, '#fff', '#4fc3a1', 3); txt('!', q.x + q.r * 0.7, q.y - q.r * 0.68, Math.round(q.r * 0.5), '#2a8f6f', null);
    btn('quest', q.x, q.y, q.r, () => { if (questCard) questCard = null; else if (twistQuestArea()) questCard = { area: twistQuestArea(), t: 0 }; else questGiverHook(LEVELS[L.i], true); Snd.tap(); });
  }
  drawWandBar(UI.wand.x, UI.wand.y, UI.wand.w, UI.wand.h);
  if (fight) drawFightHUD();
  drawPowerHUD();
  roundBtn('home', UI.home.x, UI.home.y, UI.home.r, '#7b5cff', 'home', () => { persist(); fight = null; clearMinions(); scene = 'map'; Snd.tap(); });
  forgeButton('forge', UI.forge.x, UI.forge.y);
  const gate = lvlObjs('gate')[0];
  if (gate && !gate.open && lvlObjs('block').length && !lvlObjs('plate').some(p => p.pressed)) roundBtn('reset', UI.reset.x, UI.reset.y, UI.reset.r, '#ff9f1c', 'reset', resetLevel);
}
function drawPopup() {
  const p = popup, o = p.o, a = easeOut(Math.min(1, p.t * 4));
  ctx.fillStyle = `rgba(30,20,60,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W - 32, 380), ph = 330, x0 = (W - pw) / 2 + (p.shake ? Math.sin(now * 60) * 10 * p.shake : 0), y0 = (H - ph) / 2;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(a, a); ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = '#ffe9b8'; rr(x0, y0, pw, ph, 30); ctx.fill(); ctx.strokeStyle = '#c98a4b'; ctx.lineWidth = 8; ctx.stroke();
  drawIcon('castle', W / 2, y0 + 40, 54);
  const next = o.slots.indexOf(0);
  GEMS.forEach((c, k) => {
    const gx = W / 2 + (k - 1) * pw * 0.27, gy = y0 + 125;
    circ(gx, gy, 38, '#3b3566');
    if (o.slots[k]) { const fl = p.flash && p.flash.i === k ? 1 + Math.max(0, 0.4 - p.flash.t) : 1; drawGem(c, gx, gy, 30 * fl); }
    else { gemPath(c, gx, gy, 28); ctx.setLineDash([6, 5]); ctx.strokeStyle = GEMCOL[c]; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]); }
    if (k === next) circ(gx, gy, 42 + Math.sin(now * 6) * 3, null, '#fff', 4);
  });
  ['r', 'y', 'b'].forEach((c, k) => {
    const bx = W / 2 + (k - 1) * pw * 0.29, by = y0 + 245, have = S.gems[c];
    circ(bx, by + 5, 40, 'rgba(0,0,0,0.2)'); circ(bx, by, 40, have ? '#fff' : '#d8d2c4', '#c98a4b', 4);
    if (have) drawGem(c, bx, by, 26); else txt('?', bx, by, 34, '#9a907c', null);
    if (p.wrong === c && p.shake) drawIcon('cross', bx, by, 50);
    btn('gem_' + c, bx, by, 40, () => popupChoose(c));
  });
  ctx.restore();
  roundBtn('popupClose', x0 + pw - 14, y0 + 14, 32, '#ff4d6d', 'cross', () => { popup = null; Snd.tap(); });
}
/* Lillie-Bee's quest card: portrait + speech bubble of icons (+ one or two words) */
function drawQuestCard() {
  const qc = questCard, q = qc.area.quest, a = easeOut(Math.min(1, qc.t * 4));
  const rows = q.rows || [], is = Math.min(58, (W - 150) / 5.6), pw = Math.min(W - 20, 440);
  const ph = 70 + rows.length * (is + 14), x0 = (W - pw) / 2, y0 = clamp(H * 0.56 - ph / 2, UI.hudH + 120, H - ph - 150);
  ctx.fillStyle = `rgba(30,20,60,${0.35 * a})`; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, y0 + ph / 2); ctx.scale(0.6 + 0.4 * a, 0.6 + 0.4 * a); ctx.translate(-W / 2, -(y0 + ph / 2)); ctx.globalAlpha = a;
  // bubble
  const bx = x0 + 70, bw = pw - 70;
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; rr(bx, y0 + 6, bw, ph, 26); ctx.fill();
  ctx.fillStyle = '#fffdf5'; rr(bx, y0, bw, ph, 26); ctx.fill(); ctx.strokeStyle = S.twist === 'queen' ? '#7b3fbf' : HERO[ARCHER].color; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.moveTo(bx + 3, y0 + ph * 0.55); ctx.lineTo(bx - 20, y0 + ph * 0.72); ctx.lineTo(bx + 3, y0 + ph * 0.8); ctx.fill();
  // portrait (half the head pops out of the bubble on the left)
  const pr = 52, pxc = x0 + 46, pyc = y0 + ph * 0.62 + Math.sin(now * 3) * 3;
  circ(pxc, pyc + 5, pr, 'rgba(0,0,0,0.2)'); archerBadge(pxc, pyc, pr); circ(pxc, pyc, pr, null, '#fff', 5);
  txt(q.say || '', bx + bw / 2, y0 + 32, 30, '#2a8f6f', '#fff');
  rows.forEach((row, r) => {
    const cy = y0 + 64 + r * (is + 14) + is / 2, n = row.length, wsum = row.reduce((s2, it) => s2 + (it.n ? is * 1.7 : is), 0) + (n - 1) * 8;
    let x = bx + (bw - wsum) / 2;
    row.forEach((it, k) => {
      const w = it.n ? is * 1.7 : is, cx = x + is / 2, bob = Math.sin(now * 3 + r + k * 0.7) * 2;
      if (it.head) { circ(cx, cy, is / 2, HERO[it.head].color); const im = sprite(it.head + 'Head', is); if (im) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, is / 2 - 2, 0, TAU); ctx.clip(); ctx.drawImage(im, cx - is / 2, cy - is / 2, is, is); ctx.restore(); } }
      else if (it.icon === 'arrow') drawIcon('arrow', cx, cy, is * 0.8);
      else { circ(cx, cy + bob, is / 2, '#f1ecff'); drawIcon(it.icon, cx, cy + bob, is * 0.86); }
      if (it.n) txt(String(it.n), x + is * 1.32, cy, Math.round(is * 0.5), '#5b4f8f', null);
      x += w + 8;
    });
  });
  ctx.restore();
  roundBtn('questOk', x0 + pw - 30, y0 + ph + 6, 34, '#2fb84f', 'check', () => { questCard = null; Snd.tap(); });
}
function drawBanner() {
  const b = banner, t = b.t, a = t < 0.3 ? easeOut(t / 0.3) : t > 1.6 ? Math.max(0, 1 - (t - 1.6) / 0.4) : 1;
  ctx.save(); ctx.globalAlpha = a; const y = UI.hudH + 70, sc = 0.7 + 0.3 * a;
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  ctx.fillStyle = '#7b5cff'; rr(-130, -38, 260, 76, 38); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
  circ(-92, 0, 26, '#ffd23f'); txt(String(b.i + 1), -92, 2, 30, '#3b2a6b', null);
  txt(LEVELS[b.i].name, 18, 2, 34);
  ctx.restore();
}
function skyBg(mood) { fancySky(mood || (S && S.twist === 'queen' ? 'dusk' : 'day')); }
function drawCastleBg(cx, by, s, noCrown) {
  ctx.fillStyle = '#b7aee6'; ctx.fillRect(cx - s * 0.5, by - s * 0.55, s, s * 0.55);
  for (let k = -1; k <= 1; k += 2) { ctx.fillStyle = '#a69fd0'; ctx.fillRect(cx + k * s * 0.5 - s * 0.12, by - s * 0.85, s * 0.24, s * 0.85); ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.moveTo(cx + k * s * 0.5 - s * 0.16, by - s * 0.85); ctx.lineTo(cx + k * s * 0.5, by - s * 1.1); ctx.lineTo(cx + k * s * 0.5 + s * 0.16, by - s * 0.85); ctx.fill(); }
  ctx.fillStyle = '#a69fd0'; ctx.fillRect(cx - s * 0.14, by - s * 1.0, s * 0.28, s * 0.5); ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.moveTo(cx - s * 0.18, by - s); ctx.lineTo(cx, by - s * 1.32); ctx.lineTo(cx + s * 0.18, by - s); ctx.fill();
  ctx.fillStyle = '#5b4f8f'; rr(cx - s * 0.1, by - s * 0.25, s * 0.2, s * 0.25, s * 0.1); ctx.fill();
  if (!noCrown) drawCrown(cx, by - s * 1.45 + Math.sin(now * 2) * 4, s * 0.25);
}
function drawTitle() {
  const mood = S && S.twist === 'queen' ? 'dusk' : 'day', par = Math.sin(now * 0.15) * 60;
  skyBg(mood);
  parallaxHills(H * 0.72, mood, par);
  drawCastleBg(W / 2 + par * 0.1, H * 0.66, Math.min(W, H) * 0.32);
  { const g = ctx.createLinearGradient(0, H * 0.72, 0, H); g.addColorStop(0, '#6fd24a'); g.addColorStop(1, '#3f9e33'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 16) ctx.lineTo(x, H * 0.75 - Math.sin(x / (W * 0.25) + 0.6) * H * 0.012); ctx.lineTo(W, H); ctx.fill();
    ctx.strokeStyle = 'rgba(30,110,30,0.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let k = 0; k < 40; k++) { const x = hash(k, 21) * W, y = H * (0.8 + hash(21, k) * 0.18), sw = Math.sin(now * 2 + k) * 3; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 6 + sw, y - 9); ctx.moveTo(x, y); ctx.lineTo(x + sw, y - 12); ctx.moveTo(x + 4, y); ctx.lineTo(x + 6 + sw, y - 8); ctx.stroke(); }
    for (let k = 0; k < 12; k++) { const x = hash(k, 31) * W, y = H * (0.79 + hash(31, k) * 0.19); circ(x, y, 4, ['#ff8fc4', '#fff', '#ffd23f'][k % 3]); circ(x, y, 1.8, '#ffb000'); } }
  floatingSparkles(22, mood === 'day' ? 0.75 : 0.95);
  const hh = Math.min(H * 0.33, W * 0.55);
  [['lillie', W * 0.5, 2.1, 0.86, 0.8], ['ruru', W * 0.2, 0, 0.9, 1], ['mielie', W * 0.8, 1.3, 0.9, 1]].forEach(([n, x, ph, fy, k]) => {
    if (!IMG[n]) return; const qn = n === ARCHER && S && S.twist === 'queen';
    const im = qn ? sprite('queen', hh * k * 1.1) : heroSprite(n, hh * k); if (!im) return;
    // idle: little hop with squash on landing + breathing stretch
    const hop = Math.abs(Math.sin(now * 2.6 + ph)), b = hop * 12, land = Math.max(0, 0.25 - hop) * 4, br = Math.sin(now * 3.1 + ph);
    const sx = 1 + land * 0.08 - br * 0.015, sy = 1 - land * 0.1 + br * 0.025, fx = x, fyy = H * fy;
    ell(fx, fyy, hh * 0.17 * (1 - hop * 0.25), hh * 0.04, 'rgba(30,60,20,0.28)');
    ctx.save(); ctx.translate(fx, fyy - b); ctx.rotate(Math.sin(now * 1.6 + ph) * 0.03); ctx.scale(sx, sy);
    ctx.drawImage(im, -im.dw / 2, -im.dh, im.dw, im.dh); if (!qn) drawGearOverlay(n, -im.dw / 2, -im.dh, im.dw, im.dh);
    ctx.restore();
  });
  // a goofy zombie peeking from a bush
  { const zp = { id: 7, kind: 'bucket', facing: 1 }, zxp = W * 0.07 + Math.sin(now * 0.8) * 10; ctx.save(); drawZombie(zp, zxp, H * 1.0, Math.min(W, H) * 0.17, false); ctx.restore();
    const br = Math.min(W, H); circ(W * 0.03, H * 0.98, br * 0.11, '#1f7a36'); circ(W * 0.03, H * 0.965, br * 0.1, '#2f9e44'); circ(W * 0.14, H * 1.0, br * 0.09, '#37b24d'); circ(W * 0.12, H * 0.96, br * 0.03, 'rgba(255,255,220,0.35)'); circ(W * 0.09, H * 0.95, br * 0.018, '#ff6f8a'); }
  // title: glow, bounce and twinkles
  const ty = H * 0.15, ts = Math.min(W * 0.15, 64), bounce = 1 + Math.sin(now * 3) * 0.03;
  ctx.save(); ctx.translate(W / 2, ty + ts * 0.5); ctx.rotate(Math.sin(now * 2) * 0.03); ctx.scale(bounce, 2 - bounce);
  { const g = ctx.createRadialGradient(0, 0, ts * 0.3, 0, 0, ts * 2.6); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-ts * 3, -ts * 2.5, ts * 6, ts * 5); }
  ctx.translate(0, -ts * 0.5);
  drawCrown(0, -ts * 0.95 + Math.sin(now * 2.5) * 3, ts * 0.9);
  ctx.shadowColor = 'rgba(123,63,191,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  txt('Mielie', 0, 0, ts, '#ffd23f', '#7b3fbf'); txt('& Ruru', 0, ts * 1.05, ts, '#ff8fc4', '#7b3fbf');
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  for (let k = 0; k < 5; k++) { const a = 0.5 + 0.5 * Math.sin(now * 3.4 + k * 1.9); twinkle(Math.cos(k * 1.3 + 0.4) * ts * 2.2, Math.sin(k * 2.1) * ts * 0.7 + ts * 0.4, 4 + a * 6, a, k % 2 ? '#fff' : '#fff6a0'); }
  ctx.restore();
  const hasSave = !!(S && (Object.keys(S.areas).length || S.level > 0));
  const by = H * 0.4, s = 1 + Math.sin(now * 4) * 0.04;
  ctx.save(); ctx.translate(W / 2, by); ctx.scale(s, s); ctx.translate(-W / 2, -by);
  pillBtn('play', W / 2, by, 220, 86, '#2fb84f', hasSave ? 'Go!' : 'Play', 'arrowR', () => { Snd.build(); if (!S.introSeen && DATA.intro) startIntro(); else scene = 'map'; });
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(W / 2 - 88, by - 18); ctx.lineTo(W / 2 - 58, by); ctx.lineTo(W / 2 - 88, by + 18); ctx.fill();
  if (hasSave) {
    if (!confirmNew) pillBtn('new', W / 2, by + 86, 150, 64, '#ff9f1c', 'New', null, () => { confirmNew = true; Snd.tap(); });
    else { roundBtn('newYes', W / 2 - 50, by + 90, 34, '#2fb84f', 'check', () => { confirmNew = false; const snd = S.sound; S = freshState(); S.sound = snd; L = null; persist(); Snd.build(); }); roundBtn('newNo', W / 2 + 50, by + 90, 34, '#ff4d6d', 'cross', () => { confirmNew = false; Snd.tap(); }); }
  }
  if (DATA.intro) roundBtn('story', 44, 44, 32, '#ff8fc4', 'book', () => { Snd.tap(); startIntro(); });
  roundBtn('sound', W - 44, 44, 32, '#7b5cff', S.sound ? 'sound' : 'mute', () => { S.sound = !S.sound; Snd.on = S.sound; persist(); Snd.tap(); });
}
/* mapNode / drawMap live in worldmap.js */
let endConf = [];
function drawEnd() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7b5cff'); g.addColorStop(1, '#ff8fc4'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.3); ctx.rotate(now * 0.3); ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 12; k++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -Math.max(W, H)); ctx.lineTo(60, -Math.max(W, H)); ctx.fill(); } ctx.restore();
  const cs = Math.min(W, H) * 0.28; drawCrown(W / 2, H * 0.3 + Math.sin(now * 3) * 8, cs * (endT < 0.5 ? easeOut(endT * 2) : 1));
  txt('Hooray!', W / 2, H * 0.1, Math.min(64, W * 0.15), '#ffd23f', '#5b2a9b');
  txt('Kingdom saved!', W / 2, H * 0.45, Math.min(34, W * 0.08), '#fff', '#5b2a9b');
  for (let k = 0; k < 3; k++) { const t = clamp((endT - 0.4 - k * 0.3) * 3, 0, 1); if (t > 0) star(W / 2 + (k - 1) * 70, H * 0.53 - (k === 1 ? 12 : 0), 30 * easeOut(t), '#ffd23f'); }
  const hh = Math.min(H * 0.28, W * 0.44);
  [['ruru', W * 0.2, 0], ['lillie', W * 0.5, 0.25], ['mielie', W * 0.8, 0.5]].forEach(([n, x, ph]) => { if (!IMG[n]) return; const im = heroSprite(n, hh); const b = Math.abs(Math.sin(now * 5 + ph)) * 26; if (im) { ctx.drawImage(im, x - im.dw / 2, H * 0.88 - im.dh - b, im.dw, im.dh); drawGearOverlay(n, x - im.dw / 2, H * 0.88 - im.dh - b, im.dw, im.dh); } });
  if (Math.random() < 0.5) endConf.push({ x: rnd(0, W), y: -10, vx: rnd(-30, 30), vy: rnd(80, 180), r: rnd(0, TAU), c: ['#ff4d6d', '#ffd23f', '#3fa9ff', '#7bd85a', '#fff'][(Math.random() * 5) | 0] });
  for (let i = endConf.length - 1; i >= 0; i--) { const c = endConf[i]; c.x += c.vx / 60; c.y += c.vy / 60; c.r += 0.1; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-6, -3, 12, 6); ctx.restore(); if (c.y > H + 10) endConf.splice(i, 1); }
  roundBtn('again', W / 2 + 50, H - 56, 36, '#2fb84f', 'reset', () => { const snd = S.sound; S = freshState(); S.sound = snd; L = null; persist(); scene = 'map'; Snd.build(); });
  roundBtn('endHome', W / 2 - 50, H - 56, 36, '#7b5cff', 'home', () => { scene = 'title'; Snd.tap(); });
}
/* ---------------- Intro story: 4 picture panels, a word or two each (data: DATA.intro) ---------------- */
let introPage = 0, introT = 0;
let storyPages = null, storyDone = null;
function startStory(pages, done) { storyPages = pages; storyDone = done; introPage = 0; introT = 0; scene = 'intro'; Snd.page(); }
function startIntro() { startStory(DATA.intro, finishIntro); }
function finishStory() { const f = storyDone || finishIntro; storyDone = null; f(); }
function introNext() {
  if (introT < 0.35) return;
  if (introPage < (storyPages || DATA.intro).length - 1) { introPage++; introT = 0; Snd.page(); return; }
  finishStory();
}
function finishIntro() { S.introSeen = true; persist(); Snd.build(); scene = 'map'; }
function introField(x0, y0, w, h, sad) {
  // rows of mielie plants; droopy and pale when the crown is gone
  for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) {
    const x = x0 + w * (0.06 + k * 0.148 + (r % 2) * 0.07), by = y0 + h * (0.78 + r * 0.09), sz = h * (0.1 + r * 0.03), sw = Math.sin(now * 2 + k + r) * 0.08;
    ctx.save(); ctx.translate(x, by); ctx.rotate(sad ? 0.5 + sw * 0.3 : sw); if (sad) ctx.globalAlpha = 0.55;
    ctx.fillStyle = sad ? '#9a9a5a' : '#4caf50'; ctx.fillRect(-sz * 0.05, -sz * 1.2, sz * 0.1, sz * 1.2);
    if (!sad) drawIcon('mielie', sz * 0.12, -sz * 1.1, sz * 0.9); else ell(sz * 0.1, -sz * 1.05, sz * 0.12, sz * 0.25, '#c9b56a');
    ctx.restore();
  }
}
function drawIntroScene(id, x0, y0, w, h) {
  if (drawStoryScene(id, x0, y0, w, h)) return;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  if (id === 'stolen') { g.addColorStop(0, '#7a6bb8'); g.addColorStop(1, '#d8b4d8'); } else if (id === 'sister') { g.addColorStop(0, '#9fe0c8'); g.addColorStop(1, '#e8ffd8'); } else { g.addColorStop(0, '#8fd3ff'); g.addColorStop(1, '#ffe3f1'); }
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  const cs = Math.min(w, h) * 0.42;
  if (id === 'kingdom' || id === 'stolen') {
    if (id === 'kingdom') { circ(x0 + w * 0.85, y0 + h * 0.12, h * 0.07, '#fff3a0'); }
    ell(x0 + w * 0.5, y0 + h * 0.8, w * 0.8, h * 0.2, id === 'stolen' ? '#8fae6a' : '#7bd85a');
    drawCastleBg(x0 + w * 0.5, y0 + h * 0.66, cs, true);
    const crx = x0 + w * 0.5, cry = y0 + h * 0.66 - cs * 1.45;
    if (id === 'kingdom') {
      // the Golden Mielie Crown, glowing over the castle
      ctx.save(); ctx.translate(crx, cry); ctx.rotate(now * 0.4); ctx.fillStyle = 'rgba(255,240,150,0.35)'; for (let k = 0; k < 10; k++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-cs * 0.1, -cs * 0.7); ctx.lineTo(cs * 0.1, -cs * 0.7); ctx.fill(); } ctx.restore();
      drawCrown(crx, cry + Math.sin(now * 2) * 4, cs * 0.4); drawIcon('mielie', crx, cry - cs * 0.02, cs * 0.18);
      // festival bunting
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0 + h * 0.05); ctx.quadraticCurveTo(x0 + w / 2, y0 + h * 0.16, x0 + w, y0 + h * 0.05); ctx.stroke();
      for (let k = 0; k < 9; k++) { const t = (k + 0.5) / 9, bx = x0 + w * t, byy = y0 + h * (0.05 + 0.11 * 4 * t * (1 - t) * 0.5 + 0.005); ctx.fillStyle = ['#ff4d6d', '#ffd23f', '#3fa9ff', '#7bd85a'][k % 4]; ctx.beginPath(); ctx.moveTo(bx - w * 0.03, byy); ctx.lineTo(bx + w * 0.03, byy); ctx.lineTo(bx, byy + h * 0.06); ctx.fill(); }
      introField(x0, y0, w, h, false);
    } else {
      introField(x0, y0, w, h, true);
      // the clumsy Zombie King runs off with the crown (and trips a little)
      const t = (introT * 0.35) % 1.3, zx = x0 + w * (0.1 + t * 0.8), zb = y0 + h * 0.86, zs = Math.min(w, h) * 0.3;
      ctx.save(); ctx.translate(zx, zb); ctx.rotate(Math.sin(now * 9) * 0.12); drawZombie({ id: 2, facing: 1, hp: 0 }, 0, 0, zs, true); ctx.restore();
      drawCrown(zx + zs * 0.45, zb - zs * 1.25 + Math.sin(now * 9) * 6, zs * 0.45);
      txt('!', zx - zs * 0.5, zb - zs * 1.4, Math.round(zs * 0.4), '#ff4d6d', '#fff');
    }
  } else if (id === 'sister') {
    for (let k = 0; k < 6; k++) { const tx = x0 + w * (k / 5), ty = y0 + h * (0.35 + hash(k, 3) * 0.1); circ(tx, ty, h * 0.14, k % 2 ? '#2f9e44' : '#37b24d'); }
    ctx.fillStyle = '#86e063'; ctx.fillRect(x0, y0 + h * 0.55, w, h * 0.45);
    const im = heroSprite('lillie', h * 0.82), lx = x0 + w * 0.34, lb = y0 + h * 0.97;
    shadow(lx, lb, h * 0.12);
    if (im) { ctx.drawImage(im, lx - im.dw / 2, lb - im.dh + Math.sin(now * 2) * 3, im.dw, im.dh); drawGearOverlay('lillie', lx - im.dw / 2, lb - im.dh, im.dw, im.dh); }
    for (let k = 0; k < 4; k++) { const a = now * 3 + k * 1.6; star(lx + w * 0.2 + Math.cos(a) * w * 0.05, lb - h * 0.33 + Math.sin(a) * h * 0.04, h * 0.018, '#fff6a0'); }
    // her bubble: crown -> Mielie + Ruru
    const bx = x0 + w * 0.74, byy = y0 + h * 0.2, r = Math.min(w * 0.22, h * 0.16);
    ctx.fillStyle = '#fff'; rr(bx - r, byy - r * 1.1, r * 2, r * 2.4, r * 0.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx - r * 0.6, byy + r * 1.2); ctx.lineTo(bx - r * 1.2, byy + r * 1.7); ctx.lineTo(bx - r * 0.2, byy + r * 1.25); ctx.fill();
    drawCrown(bx, byy - r * 0.45, r * 0.9);
    ['mielie', 'ruru'].forEach((n, k) => { const hx = bx + (k ? 0.45 : -0.45) * r, hy = byy + r * 0.6, hr = r * 0.4; circ(hx, hy, hr, HERO[n].color); const hi = sprite(n + 'Head', hr * 2); if (hi) { ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, hr - 2, 0, TAU); ctx.clip(); ctx.drawImage(hi, hx - hr, hy - hr, hr * 2, hr * 2); ctx.restore(); } });
  } else { // 'go': the three heroes march off toward the castle
    ell(x0 + w * 0.5, y0 + h * 0.75, w * 0.9, h * 0.3, '#7bd85a');
    drawCastleBg(x0 + w * 0.8, y0 + h * 0.42, cs * 0.45, true);
    ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now * 4); txt('?', x0 + w * 0.8, y0 + h * 0.42 - cs * 0.75, Math.round(cs * 0.3), '#ffd23f', '#7b3fbf'); ctx.restore();
    ctx.setLineDash([6, 12]); ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x0 + w * 0.1, y0 + h * 0.95); ctx.quadraticCurveTo(x0 + w * 0.6, y0 + h * 0.7, x0 + w * 0.8, y0 + h * 0.45); ctx.stroke(); ctx.setLineDash([]);
    [['lillie', 0.2, 0.62], ['ruru', 0.42, 0.5], ['mielie', 0.62, 0.48]].forEach(([n, fx, k], i) => {
      const im = heroSprite(n, h * k), x = x0 + w * fx, b = y0 + h * 0.97 - Math.abs(Math.sin(now * 6 + i)) * h * 0.03;
      if (im) { shadow(x, y0 + h * 0.97, im.dw * 0.3); ctx.drawImage(im, x - im.dw / 2, b - im.dh, im.dw, im.dh); drawGearOverlay(n, x - im.dw / 2, b - im.dh, im.dw, im.dh); }
    });
  }
}
function drawIntro() {
  const pages = storyPages || DATA.intro, pg = pages[introPage], a = easeOut(Math.min(1, introT * 3));
  ctx.fillStyle = '#3b2a6b'; ctx.fillRect(0, 0, W, H);
  const m = 14, pw = W - m * 2, ph = Math.min(H - 220, pw * 1.35), x0 = m, y0 = Math.max(70, (H - ph - 150) / 2);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y0 + ph / 2); ctx.scale(0.92 + 0.08 * a, 0.92 + 0.08 * a); ctx.translate(-W / 2, -(y0 + ph / 2));
  ctx.fillStyle = '#fff'; rr(x0 - 6, y0 - 6, pw + 12, ph + 12, 28); ctx.fill();
  ctx.save(); rr(x0, y0, pw, ph, 22); ctx.clip(); drawIntroScene(pg.scene, x0, y0, pw, ph); ctx.restore();
  ctx.restore();
  // caption: one or two words
  const cy = y0 + ph + 52;
  txt(pg.say, W / 2, cy, Math.min(46, W * 0.1), '#ffd23f', '#7b3fbf');
  // page dots
  pages.forEach((_, k) => circ(W / 2 + (k - (pages.length - 1) / 2) * 26, cy + 44, k === introPage ? 9 : 6, k === introPage ? '#ffd23f' : 'rgba(255,255,255,0.5)'));
  roundBtn('introNext', W - 60, H - 60, 40, '#2fb84f', introPage < pages.length - 1 ? 'arrow' : 'check', introNext, 1 + Math.sin(now * 4) * 0.05);
  roundBtn('introSkip', W - 40, 36, 28, 'rgba(123,92,255,0.9)', 'cross', () => { Snd.tap(); finishStory(); });
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); hits = [];
  if (scene === 'loading') { ctx.fillStyle = '#7b5cff'; ctx.fillRect(0, 0, W, H); return; }
  if (scene === 'title') drawTitle();
  else if (scene === 'map') drawMap();
  else if (scene === 'end') drawEnd();
  else if (scene === 'forge') drawForge();
  else if (scene === 'intro') drawIntro();
  else if (scene === 'mini') drawMini();
  else if (scene === 'play' && L) {
    const zm = cineZoom(); if (zm !== 1) { ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.scale(zm, zm); ctx.translate(-W / 2, -H * 0.45); }
    drawWorld();
    if (zm !== 1) ctx.restore();
    drawCineOverlay();
    for (const f of floaters) { if (f.t < 0) continue; const t = easeOut(Math.min(1, f.t)); const x = f.from.x + (f.to.x - f.from.x) * t, y = f.from.y + (f.to.y - f.from.y) * t - Math.sin(t * Math.PI) * 60; drawIcon(f.icon, x, y, (f.big ? 56 : 40) * (1 + Math.sin(t * Math.PI) * 0.3)); }
    drawHUD();
    if (banner) drawBanner();
    if (questCard && !popup) drawQuestCard();
    if (popup) drawPopup();
  }
  drawUiFx();
  if (trans) { const a = trans.t < 1 ? trans.t : 2 - trans.t; ctx.fillStyle = `rgba(255,255,255,${clamp(a, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- Input ---------------- */
function hitTest(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) { const b = hits[i];
    if (b.w ? (Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2) : Math.hypot(x - b.x, y - b.y) <= b.r) return b; }
  return null;
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Snd.unlock(); if (trans || scene === 'loading') return;
  const x = e.clientX, y = e.clientY, b = hitTest(x, y);
  if (b) { fxPress(b.id); uiSparkle(x, y, 6, null, 0.4, 40); }
  if (scene === 'map') { mapDown(x, y, b); return; }
  if (b) { b.fn(); return; }
  if (scene === 'intro') { introNext(); return; }
  if (scene === 'mini') { miniTap(x, y); return; }
  if (cine) return;
  if (scene !== 'play' || popup || !L) return;
  if (questCard) { if (questCard.t > 0.3) { questCard = null; Snd.tap(); } return; }
  if (UI.pills.some(p => (p.res !== 'pick' || S.pick) && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h)) return;
  const tx = Math.floor((x - cam.x) / T), ty = Math.floor((y - cam.y) / T);
  if (inBounds(tx, ty)) tapTile(tx, ty);
}, { passive: false });
cv.addEventListener('pointermove', e => { if (scene === 'mini') miniMove(e.clientX, e.clientY); else if (scene === 'map') mapMove(e.clientX, e.clientY); });
cv.addEventListener('pointerup', e => { if (scene === 'map') mapUp(e.clientX, e.clientY); else mapPtr = null; });
cv.addEventListener('pointercancel', () => { mapPtr = null; });
['touchstart', 'touchmove', 'gesturestart', 'contextmenu'].forEach(ev => cv.addEventListener(ev, e => e.preventDefault(), { passive: false }));
window.addEventListener('resize', () => { layout(); if (L) updateCam(0, true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);

/* ---------------- Loop & boot ---------------- */
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
  try { update(dt); draw(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
// boot once every script (villains.js, power.js, minigames.js load after this file) is in
function boot() {
  layout();
  loadImages().then(() => {
    const b = document.getElementById('boot'); if (b) b.remove();
    S = loadSave() || freshState(); Snd.on = S.sound !== false; scene = 'title';
  });
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);

/* ---------------- Test hooks (read-only helpers, no network) ---------------- */
window.__MR = {
  get state() { return S; }, get scene() { return scene; }, get level() { return L ? L.i : -1; }, get areaId() { return L ? L.id : null; },
  get heroes() { return heroes; }, get T() { return T; }, get ui() { return UI; }, get popup() { return popup; },
  tileCenter(x, y) { return { x: cam.x + (x + 0.5) * T, y: cam.y + (y + 0.5) * T }; },
  camSettled() { return Math.abs(cam.x - cam.tx) < 1.5 && Math.abs(cam.y - cam.ty) < 1.5; },
  busy, objs(type) { return L ? L.objs.filter(o => !o.gone && (!type || o.type === type)).map(o => ({ type: o.type, x: o.x, y: o.y, hp: o.hp, open: o.open, lit: o.lit, dep: o.dep, kind: o.kind, fed: o.fed, guards: o.guards, hit: o.hit, shot: o.shot, hits: o.hits, boss: o.boss, cleared: o.cleared, minion: o.minion, who: o.who, beaten: o.beaten, bonk: !!o.bonk, poof: !!o.poof })) : []; },
  get fight() { return fight ? { wave: fight.wave, hearts: fight.hearts, max: fight.max } : null; }, get pieces() { return S && S.pieces; }, get twist() { return S && S.twist; },
  get story() { return scene === 'intro' ? (storyPages === DATA.intro ? 'intro' : 'twist') : null; }, get mini() { return miniView(); }, get power() { return S ? S.power : 0; }, get cine() { return !!cine; },
  button(id) { const b = hits.find(h => h.id === id); return b ? { x: b.x, y: b.y } : null; },
  buttons() { return hits.map(h => h.id); },
  walkable(x, y) { return L ? walkable(x, y) : false; }, data: DATA,
  get questCard() { return !!questCard; }, get intro() { return scene === 'intro' ? introPage : -1; }, get arrows() { return arrows.length; },
  get gear() { return S && S.gear; }, mapFocus(i) { mapFocus(i); }, get mapScroll() { return mapScroll; }, fillPower() { if (S) S.power = powerMax(); }, gearStat(st, h) { return gearStat(st, h); }, openForge() { openForge(); }
};
