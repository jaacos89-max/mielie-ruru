/* Mielie & Ruru - gear and upgrades (data only).
 * Add a tier by appending to an item's `tiers`; add an item by adding it to `items` and a hero's `slots`.
 * cost: resources spent (wood, stone, mielie, flower). gems: how many gems you must have found (gems are never spent).
 * stats: numbers used by the game. power = what the sword can cut, reach = bonk/zap splash radius in tiles,
 *        guard = iron shield bonks zombies on touch, speed = walk speed multiplier, bloom = extra flowers per bud, style = just pretty.
 * paint: recolour rules applied to the hero cut-out image (rect = fractions of the image, hue = source hue range in degrees,
 *        to.h = new hue, to.s = saturation multiplier, to.lm = lightness multiplier, to.l = lightness added).
 *        range = how far Lillie-Bee's arrow flies (tiles).
 * overlay: extra little drawings on the sprite ('wings', 'shine', 'starcape', 'startiara', 'rainbow', 'goldbow', 'starbow').
 */
window.MR_GEAR = {
  version: 1,
  heroes: { ruru: ['sword', 'shield', 'boots'], mielie: ['wand', 'cape', 'tiara'], lillie: ['bow'] },
  items: {
    sword: { hero: 'ruru', stat: 'power', tiers: [
      { id: 'wood', icon: 'sword', color: '#c98a4b', stats: { power: 1, reach: 0 } },
      { id: 'stone', icon: 'sword', color: '#9aa3b5', cost: { wood: 2, stone: 2 }, stats: { power: 2, reach: 0 },
        paint: [{ rect: [0, 0.3, 0.3, 0.64], hue: [15, 50], lmin: 0.36, to: { s: 0.08, lm: 1.05 } }] },
      { id: 'gold', icon: 'sword', color: '#ffd23f', cost: { stone: 3, mielie: 2 }, gems: 3, stats: { power: 3, reach: 1.5 }, overlay: ['shine'],
        paint: [{ rect: [0, 0.3, 0.3, 0.64], hue: [15, 50], lmin: 0.36, to: { h: 48, s: 1.6, lm: 1.15, l: 0.05 } }] }
    ] },
    shield: { hero: 'ruru', stat: 'guard', tiers: [
      { id: 'wood', icon: 'shield', color: '#c98a4b', stats: { guard: 0 } },
      { id: 'iron', icon: 'shield', color: '#7fb2e6', cost: { stone: 3, wood: 1 }, stats: { guard: 1 },
        paint: [{ rect: [0.62, 0.48, 0.71, 0.8], hue: [22, 40], smin: 0.3, to: { h: 210, s: 0.35, lm: 1.1 } },
                { rect: [0.88, 0.48, 1, 0.8], hue: [22, 40], smin: 0.3, to: { h: 210, s: 0.35, lm: 1.1 } },
                { rect: [0.71, 0.48, 0.88, 0.555], hue: [22, 40], smin: 0.3, to: { h: 210, s: 0.35, lm: 1.1 } },
                { rect: [0.71, 0.755, 0.88, 0.8], hue: [22, 40], smin: 0.3, to: { h: 210, s: 0.35, lm: 1.1 } }] }
    ] },
    boots: { hero: 'ruru', stat: 'speed', tiers: [
      { id: 'plain', icon: 'boots', color: '#8a5a2b', stats: { speed: 1 } },
      { id: 'speedy', icon: 'boots', color: '#e63946', cost: { wood: 1, flower: 1 }, stats: { speed: 1.3 },
        paint: [{ rect: [0.2, 0.8, 0.8, 1], hue: [10, 45], to: { h: 0, s: 1.3 } }] },
      { id: 'winged', icon: 'boots', color: '#3fa9ff', cost: { flower: 2, mielie: 2 }, stats: { speed: 1.6 }, overlay: ['wings'],
        paint: [{ rect: [0.2, 0.8, 0.8, 1], hue: [10, 45], to: { h: 205, s: 1.3 } }] }
    ] },
    wand: { hero: 'mielie', stat: 'reach', tiers: [
      { id: 'star', icon: 'wand', color: '#ffd23f', stats: { magic: 1, reach: 0 } },
      { id: 'crystal', icon: 'wand', color: '#5ad1ff', cost: { stone: 2, flower: 2 }, stats: { magic: 2, reach: 2 },
        paint: [{ rect: [0.77, 0.15, 1, 0.52], hue: [35, 65], to: { h: 190 } }] },
      { id: 'rainbow', icon: 'wand', color: '#ff6fd8', cost: { flower: 3, mielie: 2 }, gems: 3, stats: { magic: 3, reach: 3.5 }, overlay: ['rainbow'],
        paint: [{ rect: [0.77, 0.15, 1, 0.52], hue: [35, 65], to: { h: 320, s: 1.2 } }] }
    ] },
    cape: { hero: 'mielie', stat: 'bloom', tiers: [
      { id: 'purple', icon: 'cape', color: '#9b5de5', stats: { bloom: 0 } },
      { id: 'starry', icon: 'cape', color: '#3f6fe0', cost: { flower: 2, wood: 1 }, stats: { bloom: 1 }, overlay: ['starcape'],
        paint: [{ rect: [0, 0.3, 1, 0.85], hue: [255, 300], to: { h: 215 } }] }
    ] },
    tiara: { hero: 'mielie', stat: 'style', tiers: [
      { id: 'gold', icon: 'tiara', color: '#ffd23f', stats: { style: 1 } },
      { id: 'pink', icon: 'tiara', color: '#ff6fae', cost: { stone: 1, flower: 2 }, stats: { style: 2 },
        paint: [{ rect: [0.25, 0, 0.75, 0.12], hue: [255, 300], to: { h: 335, s: 1.1, l: 0.08 } }] },
      { id: 'star', icon: 'tiara', color: '#fff6a0', cost: { mielie: 2, flower: 2 }, stats: { style: 3 }, overlay: ['startiara'],
        paint: [{ rect: [0.25, 0, 0.75, 0.12], hue: [255, 300], to: { h: 50, s: 1.2, l: 0.1 } }] }
    ] },
    bow: { hero: 'lillie', stat: 'range', tiers: [
      { id: 'wood', icon: 'bow', color: '#a0662f', stats: { range: 5, reach: 0 } },
      { id: 'golden', icon: 'bow', color: '#ffc928', cost: { wood: 2, mielie: 2 }, stats: { range: 7, reach: 0 }, overlay: ['goldbow'],
        paint: [{ rect: [0.83, 0.17, 1, 0.5], hue: [10, 38], smin: 0.3, lmin: 0.3, lmax: 0.62, to: { h: 46, s: 1.6, lm: 1.25, l: 0.06 } },
                { rect: [0.8, 0.5, 1, 0.66], hue: [10, 38], smin: 0.3, lmin: 0.3, lmax: 0.62, to: { h: 46, s: 1.6, lm: 1.25, l: 0.06 } },
                { rect: [0.6, 0.6, 0.86, 0.73], hue: [10, 38], smin: 0.5, lmin: 0.3, lmax: 0.62, to: { h: 46, s: 1.6, lm: 1.25, l: 0.06 } },
                { rect: [0.34, 0.69, 0.62, 0.77], hue: [10, 38], smin: 0.5, lmin: 0.3, lmax: 0.62, to: { h: 46, s: 1.6, lm: 1.25, l: 0.06 } }] },
      { id: 'star', icon: 'bow', color: '#8fd6ff', cost: { flower: 3, stone: 2 }, gems: 3, stats: { range: 9, reach: 2 }, overlay: ['starbow'],
        paint: [{ rect: [0.83, 0.17, 1, 0.5], hue: [10, 38], smin: 0.3, lmin: 0.3, lmax: 0.62, to: { h: 200, s: 1.1, lm: 1.35, l: 0.08 } },
                { rect: [0.8, 0.5, 1, 0.66], hue: [10, 38], smin: 0.3, lmin: 0.3, lmax: 0.62, to: { h: 200, s: 1.1, lm: 1.35, l: 0.08 } },
                { rect: [0.6, 0.6, 0.86, 0.73], hue: [10, 38], smin: 0.5, lmin: 0.3, lmax: 0.62, to: { h: 200, s: 1.1, lm: 1.35, l: 0.08 } },
                { rect: [0.34, 0.69, 0.62, 0.77], hue: [10, 38], smin: 0.5, lmin: 0.3, lmax: 0.62, to: { h: 200, s: 1.1, lm: 1.35, l: 0.08 } }] }
    ] }
  }
};
