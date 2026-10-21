// Strong Arm downgrade (docs/ai-work/2026-10-21-strong-arm-downgrade.md): every level change, up or down, is paid
// like the next level. One RESULT JSON with `checks` (PASS/FAIL lines). No physics needed, about 20 s.
// Run: DEV_PORT=5199 CDP_PORT=9423 node tools/smoke/smoke.mjs sad-out tools/smoke/scenario-strong-arm-downgrade.js
const g = window.gnome;
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
// Strong Arm today: $15 x1.5, x1.3 per level above the 5th (levels 1..6), then the 7th..9th change
const PRICES = [15, 23, 34, 51, 76, 149];
const LATER = [289, 564, 1098];

(async () => {
  const keep = g.state;
  try {
    const { freshState, loadState, blockSaves } = await import('/src/core/state.ts');
    const { UPGRADE_BY_ID } = await import('/src/data/upgrades.ts');
    blockSaves();
    const u = UPGRADE_BY_ID.throw;
    const st = freshState();
    st.money = 1e6;
    g.state = st;
    const lvl = () => g.state.upgrades.throw ?? 0;
    const pay = (dir) => { const m0 = g.state.money; g.shop.buy('throw', dir); return Math.round(m0 - g.state.money); };

    ok('D1', u.downgrade === true && !Object.values(UPGRADE_BY_ID).some((x) => x.id !== 'throw' && x.downgrade), 'only Strong Arm is downgradable');

    const down0 = pay(-1);
    ok('D2', down0 === 0 && lvl() === 0, `downgrade at level 0 does nothing (paid ${down0}, lvl ${lvl()})`);

    const up = []; for (let i = 0; i < 6; i++) up.push(pay(1));
    ok('D3', JSON.stringify(up) === JSON.stringify(PRICES) && lvl() === 6, `levels 1..6 cost ${up} (expected ${PRICES})`);
    ok('D4', g.player.ignoreWeight === true, 'level 6: weight is ignored');

    const hint = g.shop.rowData(u).down;
    ok('D5', /right-click/.test(hint) && hint.includes('$289'), `shop line shows the downgrade price: "${hint}"`);

    const seq = [pay(-1)]; const l1 = lvl(); const w5 = g.player.ignoreWeight;
    seq.push(pay(1)); const l2 = lvl();
    seq.push(pay(-1)); const l3 = lvl();
    ok('D6', JSON.stringify(seq) === JSON.stringify(LATER) && l1 === 5 && l2 === 6 && l3 === 5, `down/up/down costs ${seq}, levels ${l1}/${l2}/${l3}`);
    ok('D7', w5 === false, 'after 6 → 5 weight matters again (ignoreWeight false)');
    ok('D8', g.state.paidChanges?.throw === 9, `paid changes ${g.state.paidChanges?.throw} (expected 9)`);

    g.state.money = 0;
    const poor = pay(-1);
    ok('D9', poor === 0 && lvl() === 5 && g.state.paidChanges.throw === 9, `downgrade without money is refused (lvl ${lvl()})`);

    g.state.money = 1e6;
    g.state.upgrades.speed = 2;
    const m0 = g.state.money; g.shop.buy('speed', -1); const sp = Math.round(m0 - g.state.money);
    ok('D10', sp === 0 && g.state.upgrades.speed === 2 && g.state.paidChanges.speed === undefined, 'Running Shoes (no flag) cannot go down');

    // save/load: the count survives; an old save without it prices by the level
    const KEY = 'gnome-boozed-save-v1';
    const raw = localStorage.getItem(KEY);
    localStorage.setItem(KEY, JSON.stringify(g.state));
    const loaded = loadState();
    const old = freshState(); old.upgrades.throw = 3; old.money = 1e6;
    localStorage.setItem(KEY, JSON.stringify(old));
    const oldLoaded = loadState();
    if (raw === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, raw);
    ok('D11', loaded.paidChanges?.throw === 9 && loaded.upgrades.throw === 5, `save/load keeps the count (${loaded.paidChanges?.throw})`);
    g.state = oldLoaded;
    const oldNext = pay(1);
    ok('D12', oldNext === PRICES[3] && oldLoaded.paidChanges.throw === 4, `old save at level 3 pays ${oldNext} for level 4 (expected ${PRICES[3]})`);

    // rebirth builds the next run with freshState(old): the count resets with the level
    const reborn = freshState(loaded);
    ok('D13', reborn.paidChanges === undefined && reborn.upgrades.throw === undefined, 'rebirth resets Strong Arm and its count');
  } catch (e) {
    checks.push('FAIL exception ' + (e?.stack ?? e));
  }
  g.state = keep;
  window.__done = JSON.stringify({ errors, checks });
})();
