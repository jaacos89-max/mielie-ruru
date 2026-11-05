/* Mielie & Ruru - world data. Add new lands by adding an area below and listing it in a chapter.
 * Map legend (one char per tile):
 *  Ground: # forest edge  ^ cliff  W castle wall  ~ water  v chasm  . grass  , flowery grass  = path  _ castle floor
 *  Objects: T tree  R rock  C corn (mielie)  B flower bud (Mielie's wand)  X thorn bush (Ruru's sword)
 *           x THICK thorn (needs the stone sword)  l magic lantern (needs the crystal wand)
 *           H bridge spot (5 wood)  K craft bench (pickaxe)  O boulder (pickaxe)  D dragon (eats mielies)
 *           N troll (eats flowers, stands on a bridge)  M push block  P pressure plate  G gate (opened by plate)
 *           L lantern (Mielie lights it)  Y crystal (pickaxe -> blue gem)  r red gem  E exit
 *           Q gem gate (needs blue, red, yellow)  Z crown  k Zombie King (holds the crown)
 *           J archery target (Lillie-Bee's arrow; lowers every drawbridge U in the area)
 *           U drawbridge over a chasm (raised until the target is hit)
 *           F something hanging up high (Lillie-Bee's arrow drops it; what falls is set in `hanging`)
 *           S Mielie start  s Ruru start  A Lillie-Bee start
 *  zombies: goofy wandering zombies. route = waypoints walked back and forth in straight lines.
 *           kind: 'plain' | 'bucket' | 'pumpkin'.  guards: 'bridge' = the bridge spot can't be built while it stands
 *           (it is across the river, so only Lillie-Bee's arrow can reach it).
 *  hanging: { 'x,y': { gem: 'r' } | { res: 'mielie', n: 2 } }  (default: 2 mielies)
 *  quest: Lillie-Bee's speech bubble at the start of the area. rows of icons (icon / head / n = count). say = 1-2 words.
 *  rev: bump when a map changes so old saves rebuild that area (inventory and gems are kept).
 *  boss: { id, at: [x, y] } the area's villain (defined in `bosses`). Every hero in its `needs` list has to get it once;
 *        it guards the exit (or the way on) and drops one piece of the Star-Elder Wand.
 *  New lands: add an area with its own boss + a piece name in `wand.pieces`, and list the area in a chapter.
 *  boss fights: first waves of the villain's minions (they chase and bump - never hurt; too many bumps and the fight
 *        just starts again), then Ruru breaks the villain's magic shield, then everyone else in `needs` gets them once.
 *  minis: resource mini-games launched from the area's nodes on the map (defined in `minigames`).
 *  chapter.twist: story event when every piece of the wand is found (cut-scene panels + a spell-breaking fight).
 */
window.MR_DATA = {
  dataVersion: 4,
  /* the party, in switch order. tool = icon on the switch button; ranged = shoots arrows (range comes from the bow) */
  heroes: [
    { id: 'mielie', tool: 'wand', color: '#ff8fc4' },
    { id: 'ruru', tool: 'sword', color: '#6cb8ff' },
    { id: 'lillie', tool: 'bow', color: '#4fc3a1', ranged: true }
  ],
  /* intro story panels (code-drawn scenes; one or two words each) */
  intro: [
    { scene: 'kingdom', say: 'Goudveld' },
    { scene: 'stolen', say: 'Oh no!' },
    { scene: 'sister', say: 'Lillie-Bee' },
    { scene: 'go', say: "Let's go!" }
  ],
  /* resource mini-games (30-60 s, replayable). Score -> stars via `stars` thresholds, reward[stars-1] of `res`
   * (0 stars still gives 1). kind = which game code runs it; add a new entry to reuse a kind with other numbers. */
  minigames: {
    chop: { kind: 'chop', name: 'Chop', icon: 'wood', res: 'wood', time: 30, stars: [4, 8, 13], reward: [2, 4, 6] },
    mine: { kind: 'mine', name: 'Mine', icon: 'stone', res: 'stone', time: 30, stars: [6, 12, 18], reward: [2, 4, 6] },
    catch: { kind: 'catch', name: 'Catch', icon: 'mielie', res: 'mielie', time: 30, stars: [6, 12, 18], reward: [2, 4, 6] },
    pairs: { kind: 'pairs', name: 'Pairs', icon: 'flower', res: 'flower', time: 45, stars: [2, 4, 6], reward: [2, 3, 5] }
  },
  /* POWER BOOST: the meter fills from hits, defeats and pickups. When full, a glowing button fires the active hero's
   * super move; Lillie-Bee's Arrow Rain can also be summoned while someone else plays (not while she is under the spell).
   * radius in tiles (99 = whole screen). Supers clear minions; on a villain they count as that hero's hit but never
   * finish one off. Forge upgrades for supers can later add entries like { radius, gain } per tier here. */
  power: { max: 100, gain: { hit: 14, defeat: 8, collect: 3, boss: 20, mirror: 12 } },
  supers: {
    ruru: { name: 'Shield Quake', radius: 3, color: '#6cb8ff' },
    mielie: { name: 'Star Storm', radius: 3.5, color: '#ff8fc4' },
    lillie: { name: 'Arrow Rain', radius: 99, color: '#ffd23f', summon: true }
  },
  /* the Star-Elder Wand: one piece per boss (draw keys: tip / stem / handle; any other name draws a star) */
  wand: { name: 'Star-Elder Wand', pieces: ['tip', 'stem', 'handle'] },
  /* WORLD MAP: a tall island in a cloudy sea. The Star-Elder Wand is the giant staff up the middle (the path);
   * villain lands sit on both sides, bottom to top. `area` = a playable area id (v1 = the first three);
   * lands without an area are 'coming soon' roadmap lands (locked + foggy). boss = DATA.bosses id if it has one.
   * theme = which scenery the code draws. The Evil Queen's crystal castle sits in the wand's crystal head on top. */
  worldMap: {
    lands: [
      { area: 'forest', boss: 'inkla', theme: 'sea', color: '#3fb6c9' },
      { area: 'hills', boss: 'thornessa', theme: 'thorn', color: '#46b85e' },
      { area: 'castle', boss: 'scarbo', theme: 'savanna', color: '#e39b3a' },
      { boss: 'frostine', theme: 'snow', color: '#9fd8f5' },
      { boss: 'blazio', theme: 'flame', color: '#ff7a3a' },
      { name: 'Queen Cardella', theme: 'cards', color: '#e8506a' },
      { name: 'Captain Barnacle', theme: 'pirate', color: '#4a8fd6' },
      { name: 'Lady Marigold', theme: 'fiesta', color: '#ff9f43' },
      { name: 'Vizier Zazz', theme: 'desert', color: '#e9c46a' },
      { name: 'Grimwhisker', theme: 'wolf', color: '#7d6bd1' },
      { name: 'Baron Gizmo', theme: 'robot', color: '#4fc3b0' },
      { name: 'Duke Gloomby', theme: 'gloom', color: '#5c6bd6' }
    ],
    top: { name: 'Crystal Castle' }
  },
  /* villains: original characters (storybook-villain archetypes, our own names and looks), goofy, never scary.
   * look = how the code draws them. needs = heroes that must each get them once. say = funny lines.
   * Entries without an area yet (future: true) are ready for later chapters. */
  bosses: {
    inkla: { name: 'Madame Inkla', look: 'seawitch', color: '#6a2c91', needs: ['ruru', 'mielie', 'lillie'], armor: 'ruru', piece: 'tip',
      minions: { kinds: ['blob', 'plain', 'blob'], waves: [2, 3] },
      about: 'A purple sea witch with wiggly octopus legs. She snatches voices into her seashell and sings with them, badly.',
      say: ['La-la-LAAA!', 'Mine, mine!', 'Blub?'], hurt: ['Glub!', 'My shell!'], lose: 'Blub blub!' },
    thornessa: { name: 'Thornessa', look: 'darkfairy', color: '#2fd36a', needs: ['ruru', 'mielie', 'lillie'], armor: 'ruru', piece: 'stem',
      minions: { kinds: ['raven', 'imp', 'bucket'], waves: [2, 3] },
      about: 'A horned dark fairy in black with green sparkle magic and a pet raven called Pip. Grumpy she was not invited to the Harvest Festival.',
      say: ['Not invited?!', 'Caw caw!', 'Hmm-hmm!'], hurt: ['Eek!', 'Caw!'], lose: 'Fine! I will bake a pie!' },
    scarbo: { name: 'Scarbo', look: 'lion', color: '#b5652a', needs: ['ruru', 'mielie', 'lillie'], armor: 'ruru', piece: 'handle',
      minions: { kinds: ['jackal', 'pumpkin', 'jackal'], waves: [2, 3, 3] },
      about: 'A dark-maned lion with a scratch over one eye who wants the castle throne. Very dramatic, very sneezy.',
      say: ['My throne!', 'Rrroar... achoo!', 'Bow to me!'], hurt: ['Rawr?!', 'My mane!'], lose: 'Achoo! I give up!' },
    frostine: { name: 'Frostine', look: 'snowqueen', color: '#7fd6ff', needs: ['mielie', 'ruru', 'lillie'], piece: 'gem', future: true, armor: 'ruru', minions: { kinds: ['snowball', 'plain'], waves: [3, 3] },
      about: 'An icy snow queen who freezes everything into snow-cones.', say: ['Brrr!', 'Ice ice!'], hurt: ['Melty!'], lose: 'Brr... bye!' },
    blazio: { name: 'Blazio', look: 'flamelord', color: '#4fa8ff', needs: ['ruru', 'mielie', 'lillie'], piece: 'gem', future: true, armor: 'ruru', minions: { kinds: ['ember', 'plain'], waves: [3, 3] },
      about: 'A hot-headed underworld lord with blue flame hair that turns red when he is cross.', say: ['Hot hot!', 'Grr!'], hurt: ['Ow, toasty!'], lose: 'Pfff... out!' }
  },
  chapters: [
    { id: 'ch1', name: 'Crown Quest', areas: ['forest', 'hills', 'castle'],
      /* PLOT TWIST: with the whole wand found, the Zombie King's sneaky spell turns Lillie-Bee into the Evil Queen.
       * Mielie and Ruru break the spell by zapping/bonking the magic mirrors around her (never hurting her). */
      twist: { area: 'castle', queenAt: [3, 4],
        mirrors: [[2, 4, 'mielie'], [4, 4, 'ruru'], [2, 6, 'ruru'], [4, 6, 'mielie']],
        panels: [{ scene: 'wand', say: 'Star-Elder Wand!' }, { scene: 'spell', say: 'Uh-oh!' }, { scene: 'queen', say: 'Evil Queen?!' }, { scene: 'mirrors', say: 'Break the spell!' }],
        quest: { say: 'Mirrors!', rows: [
          [{ head: 'mielie' }, { icon: 'wand' }, { icon: 'mirror_mielie' }],
          [{ head: 'ruru' }, { icon: 'sword' }, { icon: 'mirror_ruru' }],
          [{ icon: 'queen' }, { icon: 'arrow' }, { head: 'lillie' }, { icon: 'heart' }]] } } }
    // { id: 'ch2', name: 'Next land', areas: ['...'] }
  ],
  areas: {
    forest: {
      name: 'Forest', icon: 'tree', rev: 3, boss: { id: 'inkla', at: [5, 5] }, minis: ['chop', 'catch', 'pairs'], mapPos: [0.22, 0.72],
      map: [
        '########',
        '#..E..B#',
        '#.T....#',
        '#....C.#',
        '#,..T..#',
        '~~~H~~~~',
        '#...,..#',
        '###X####',
        '#.T..C.#',
        '#B.....#',
        '#..T..T#',
        '#.,..B.#',
        '#.ASs..#',
        '########'],
      zombies: [{ kind: 'plain', route: [[2, 9], [6, 9]] }, { kind: 'plain', route: [[1, 3], [4, 3]], guards: 'bridge' }],
      quest: { say: 'Go!', rows: [
        [{ icon: 'bow' }, { icon: 'arrow' }, { icon: 'zombie' }],
        [{ icon: 'wood', n: 5 }, { icon: 'arrow' }, { icon: 'bridge' }],
        [{ icon: 'zombie' }, { icon: 'arrow' }, { head: 'ruru' }, { icon: 'armor' }, { icon: 'boss_inkla' }, { icon: 'piece_tip' }]] }
    },
    hills: {
      name: 'Hills', icon: 'rock', rev: 5, boss: { id: 'thornessa', at: [5, 1] }, minis: ['mine', 'chop', 'catch'], mapPos: [0.72, 0.5],
      map: [
        '^^^^^^^^',
        '^..E...^',
        '^^^G^^^^',
        '^......^',
        '^.M..P.^',
        '^......^',
        '^^^^D^^^',
        '^R...J.^',
        '^vUvvvv^',
        '^^O^^^^^',
        '^T...R.^',
        '^R..KF.^',
        '^..T..C^',
        '^ASs.R.^',
        '^^^^^^^^'],
      zombies: [{ kind: 'bucket', route: [[2, 7], [5, 7]] }],
      hanging: { '5,11': { res: 'mielie', n: 2 } },
      quest: { say: 'Up!', rows: [
        [{ icon: 'bow' }, { icon: 'arrow' }, { icon: 'target' }],
        [{ icon: 'pick' }, { icon: 'arrow' }, { icon: 'boulder' }],
        [{ icon: 'mielie', n: 3 }, { icon: 'arrow' }, { icon: 'dragon' }],
        [{ icon: 'zombie' }, { icon: 'arrow' }, { head: 'ruru' }, { icon: 'armor' }, { icon: 'boss_thornessa' }, { icon: 'piece_stem' }]] }
    },
    castle: {
      name: 'Castle', icon: 'castle', rev: 4, boss: { id: 'scarbo', at: [3, 4] }, minis: ['mine', 'pairs', 'catch'], mapPos: [0.35, 0.24],
      map: [
        'WWWWWWWW',
        'W__k___W',
        'W______W',
        'WWWQWWWW',
        '#L.=..l#',
        '#..=...#',
        '##.=.Y.#',
        '#Fx=...#',
        '##.=..##',
        '~~~N~~~~',
        '#R.=...#',
        '#.T=.B.#',
        '#B.=.C.#',
        '#.ASs..#',
        '########'],
      zombies: [{ kind: 'pumpkin', route: [[4, 10], [6, 10], [6, 12]] }, { kind: 'plain', route: [[4, 5], [6, 5]] }],
      hanging: { '1,7': { gem: 'r' } },
      quest: { say: 'Crown!', rows: [
        [{ icon: 'bow' }, { icon: 'arrow' }, { icon: 'gem_r' }],
        [{ icon: 'zombie' }, { icon: 'arrow' }, { head: 'ruru' }, { icon: 'armor' }, { icon: 'boss_scarbo' }, { icon: 'piece_handle' }],
        [{ icon: 'gems' }, { icon: 'arrow' }, { icon: 'castle' }],
        [{ head: 'ruru' }, { head: 'mielie' }, { head: 'lillie' }, { icon: 'arrow' }, { icon: 'king' }]] }
    }
  },
  /* story characters */
  npcs: {
    sister: { alias: 'Lillie-Bee', hero: 'lillie', role: 'ranger',
      story: 'The Golden Mielie Crown keeps the fields of Goudveld growing. The clumsy Zombie King stole it before the Harvest Festival. Lillie-Bee, the kingdom ranger and big sister, sends Mielie and Ruru to get it back - and comes along with her bow.' }
  }
};
