// Endgame (plan 2026-10-21-plan-endgame.md, "Done when", with the Tools-tab exemption of 2026-10-21-plan-tree-expansion.md):
// x1.3 per level above the 5th, crates / placeable tools / Deep exempt, Deep caps 15/7/6/9. One RESULT JSON with `checks`.
// Run (about 1 min): URL_QUERY='' DEV_PORT=5199 CDP_PORT=9421 MAXPOLL=800 node tools/smoke/smoke.mjs endgame-out tools/smoke/scenario-endgame.js
// Prepend `window.FORCE_FAN_MAX = 4;` to a copy to see the guard fail (Done when 20).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); };
const g = window.gnome;
const R = {};
const checks = [];
const ok = (line, cond, info = '') => checks.push(`${cond ? 'PASS' : 'FAIL'} ${line} ${info}`);
const KEY = 'gnome-boozed-save-v1';

(async () => {
  try {
    const { freshState, blockSaves } = await import('/src/core/state.ts');
    const { UPGRADE_BY_ID, UPGRADES, upgradeCost } = await import('/src/data/upgrades.ts');
    const { Goals } = await import('/src/systems/goals.ts');
    const fanMax = window.FORCE_FAN_MAX ?? UPGRADE_BY_ID.fan.max;
    if (fanMax < 10) { window.__done = `FAIL: balance batch not landed (fan max ${fanMax})`; return; }
    blockSaves();
    const setState = (st) => { g.state = st; g.goals = new Goals(); g.goals.update = () => {}; };
    const s = freshState();
    s.money = 1e9; s.holeLevel = 11;
    s.upgrades = { value: 4, magGun: 1, magPower: 5, throw: 5, factorySpeed: 15, batch: 1, box: 5, crateSize: 5, fan: 5, robot: 5, autocrank: 5 };
    setState(s);
    g.paused = false;
    const node = (id) => document.querySelector(`.shop [data-buy="${id}"]`);
    const cost = (id) => node(id)?.querySelector('.cost')?.textContent ?? null;
    const showTab = (t) => { g.shop.tab = t; g.shop.render(); };

    // ---- 01_prices
    showTab('Factory');
    R.premium5 = cost('value');
    R.premiumAfford = node('value')?.classList.contains('afford');
    R.premiumDesc = node('value')?.dataset.desc;
    R.crank6 = cost('autocrank');
    R.gears16 = cost('factorySpeed');
    g.shop.buy('value');
    R.premium6 = cost('value');
    showTab('Magnet');
    R.coil6 = cost('magPower'); R.arm6 = cost('throw');
    showTab('Tools');
    R.box6 = cost('box'); R.crateSize6 = cost('crateSize'); R.fan6 = cost('fan'); R.robot6 = cost('robot');
    s.upgrades.robot = 11; showTab('Tools'); R.robot12 = cost('robot');
    // double click on the last affordable surcharged level
    s.money = 494;
    g.shop.buy('value'); g.shop.buy('value');
    R.premiumDouble = { level: s.upgrades.value - 5, money: s.money };

    // ---- 02_deep
    s.money = 0; s.shards = 2000; s.deep = { dValue: 10 }; s.stats.rebirths = 1;
    showTab('Deep');
    const pip = (id) => node(id)?.querySelector('.pips');
    R.caps = ['dValue', 'dStart', 'dCombo', 'dXp'].map((id) => pip(id)?.dataset.max).join('/');
    R.dValueNodeText = pip('dValue')?.textContent;
    R.keepToolsMax = Number(pip('dTools')?.dataset.max);
    R.dValue6price = upgradeCost(UPGRADE_BY_ID.dValue, 5);
    R.dValue11price = upgradeCost(UPGRADE_BY_ID.dValue, 10);
    R.dValueCost = cost('dValue');
    g.shop.buy('dValue');
    R.afterBuy = { shards: s.shards, dValue: s.deep.dValue };
    // Keep Tools carries tool levels; the next price of a kept robot 11 and fan 5
    s.upgrades.robot = 11; s.upgrades.fan = 5; showTab('Tools');
    R.afterRebirthKeptRobotNext = cost('robot'); R.afterRebirthKeptFanNext = cost('fan');
    s.upgrades.value = 0; s.deep = { dValue: 15 };
    R.valueScale15 = +(g.hole.valueScale / g.hole.mult).toFixed(6);

    // ---- 03_legend
    s.deep = { dValue: 10 }; s.upgrades.value = 5; s.upgrades.robot = 5;
    const doc = new DOMParser().parseFromString(`<div>${g.legend.tools()}</div>`, 'text/html');
    const row = (name) => [...doc.querySelectorAll('tr.lg-up')].find((tr) => tr.children[0]?.textContent === name);
    R.premiumPrice = row('Premium Gnomes')?.children[3].textContent;
    R.robotPrice = row('Cleaning Robot')?.children[3].textContent;
    R.deepValueLevel = row('Deep Value')?.children[2].textContent;

    // ---- 04_oldsave: a real boot in an iframe from localStorage
    const old = freshState();
    old.money = 12345; old.deep = { dValue: 10 }; old.upgrades = { value: 20 };
    localStorage.setItem(KEY, JSON.stringify(old));
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px;opacity:0.01;pointer-events:none';
    f.src = '/?lowfx';
    document.body.appendChild(f);
    let ig = null;
    for (let i = 0; i < 300 && !(ig = f.contentWindow?.gnome)?.shop; i++) await sleep(100);
    await sleep(500);
    const st = ig.state;
    R.oldsave = { dValue: st.deep.dValue, value: st.upgrades.value, money: st.money };
    ig.shop.tab = 'Deep'; ig.shop.render();
    R.oldsave.next = ig.shop.views.get('dValue')?.head;
    ig.shop.tab = 'Factory'; ig.shop.render();
    R.oldsave.head = ig.shop.views.get('value')?.head;
    // the boot clamp (main.ts) only lowers levels above a cap and has no note: "none" = nothing was lowered
    R.oldsave.clampNote = st.deep.dValue === 10 && st.upgrades.value === 20 ? 'none' : 'clamped';
    f.remove();
    localStorage.removeItem(KEY);
  } catch (e) {
    R.error = String((e && e.stack) || e);
  }
  ok('1', R.premium5 === '$254', R.premium5);
  ok('2', R.premium6 === '$494' && R.coil6 === '$209' && R.arm6 === '$149' && R.gears16 === '$513k', `${R.premium6} ${R.coil6} ${R.arm6} ${R.gears16}`);
  ok('3', R.box6 === '$70' && R.crateSize6 === '$70', `${R.box6} ${R.crateSize6}`);
  ok('4', R.fan6 === '$1.08k', R.fan6);
  ok('5', R.dValue6price === 8 && R.dValue11price === 58 && R.dValueCost === '💎 58', `${R.dValue6price} ${R.dValue11price} ${R.dValueCost}`);
  ok('6', R.caps === '15/7/6/9' && (R.dValueNodeText ?? '').includes('10/15'), `${R.caps} ${R.dValueNodeText}`);
  ok('7', R.keepToolsMax === 1);
  ok('8', R.oldsave?.dValue === 10 && (R.oldsave?.next ?? '').endsWith('💎 58') && R.oldsave?.clampNote === 'none', JSON.stringify(R.oldsave));
  ok('9', R.oldsave?.value === 20 && R.oldsave?.head === 'LVL 20/20 · MAX' && R.oldsave?.money === 12345, JSON.stringify(R.oldsave));
  ok('10', R.afterRebirthKeptRobotNext === '$7.17k' && R.afterRebirthKeptFanNext === '$1.08k', `${R.afterRebirthKeptRobotNext} ${R.afterRebirthKeptFanNext}`);
  ok('11', R.premiumPrice === '$494' && R.deepValueLevel === '10/15' && R.robotPrice === '$1.49k', `${R.premiumPrice} ${R.deepValueLevel} ${R.robotPrice}`);
  ok('12', R.premiumAfford === true && (R.premiumDesc ?? '').includes('now: x1.4 money'), `${R.premiumAfford} ${R.premiumDesc}`);
  ok('13', R.valueScale15 === 4, R.valueScale15);
  ok('17', R.robot6 === '$1.49k' && R.robot12 === '$7.17k', `${R.robot6} ${R.robot12}`);
  ok('18', R.crank6 === '$5.92k', R.crank6);
  ok('23', R.premiumDouble?.level === 1 && R.premiumDouble?.money === 0, JSON.stringify(R.premiumDouble));
  ok('afterBuy', R.afterBuy?.shards === 1942 && R.afterBuy?.dValue === 11, JSON.stringify(R.afterBuy));
  window.__done = JSON.stringify({ ...R, checks });
})();
