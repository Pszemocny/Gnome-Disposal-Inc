import { ctx } from '../core/context';
import { money } from '../core/format';
import { applyQuality, lowfx, prefs, saveSettings, type Quality } from '../core/settings';
import { wipeSave } from '../core/state';
import { ACHIEVEMENTS } from '../data/achievements';
import { daily, yardUrl } from '../systems/daily';
import changelog from '../../CHANGELOG.md?raw';

const latestBuild = changelog.match(/^## (.+)$/m)?.[1] ?? '';

// tiny Markdown subset for CHANGELOG.md: escape first, then headings, bullets and `code`
export function changelogHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  let html = '';
  let inList = false;
  for (const line of md.split('\n')) {
    const li = line.startsWith('- ');
    if (inList && !li) html += '</ul>';
    if (li && !inList) html += '<ul>';
    inList = li;
    if (li) html += `<li>${inline(line.slice(2))}</li>`;
    else if (line.startsWith('## ')) html += `<h3>${inline(line.slice(3))}</h3>`;
    else if (line.trim() && !line.startsWith('# ')) html += `<p>${inline(line)}</p>`;
  }
  return inList ? html + '</ul>' : html;
}

export class Menu {
  private el: HTMLDivElement;
  visible = false;
  private resetArmed = false;

  constructor(private onPlay: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'menu hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'play') this.onPlay();
      if (a === 'ach') this.renderAchievements();
      if (a === 'news') this.el.innerHTML = `<div class="menu-card">
        <div class="logo small">WHAT'S NEW</div>
        <div class="changelog">${changelogHtml(changelog)}</div>
        <button class="btn" data-a="back">Back</button></div>`;
      // both keep the other URL flags (e.g. ?lowfx)
      if (a === 'daily') {
        const q = new URLSearchParams(location.search);
        q.set('daily', '');
        location.href = `${location.pathname}?${q.toString()}`;
      }
      if (a === 'yard') location.href = yardUrl();
      if (a === 'back') this.show(ctx.state.stats.playTime > 1 ? 'pause' : 'title');
      if (a === 'reset') {
        if (!this.resetArmed) {
          this.resetArmed = true;
          (e.target as HTMLElement).textContent = 'Click again to delete everything';
          return;
        }
        wipeSave();
        location.reload();
      }
    });
    // M is handled in audio.ts; keep the checkbox in sync when the menu is open
    window.addEventListener('keydown', (e) => {
      const cb = this.el.querySelector<HTMLInputElement>('input[name="mute"]');
      if (e.code === 'KeyM' && cb) cb.checked = prefs.muted;
    });
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === 'sens') prefs.sensitivity = Number(t.value);
      if (t.name === 'invy') prefs.invertY = t.checked;
      if (t.name === 'sens' || t.name === 'invy') return saveSettings();
      if (t.name === 'vol') return ctx.audio.setVolume(Number(t.value));
      if (t.name === 'mute') return ctx.audio.setMuted(t.checked);
      if (t.name === 'quality') {
        prefs.quality = t.value as Quality;
        saveSettings();
        applyQuality(ctx.renderer, ctx.scene);
        // a new pixel ratio clears the canvas; the resize handler in main.ts redraws the frozen frame behind the menu
        window.dispatchEvent(new Event('resize'));
      }
    });
  }

  show(mode: 'title' | 'pause'): void {
    this.visible = true;
    this.resetArmed = false;
    const s = ctx.state;
    const settings = `
      <div class="settings">
        <label>Mouse sensitivity <input type="range" name="sens" min="0.25" max="3" step="0.05" value="${prefs.sensitivity}"></label>
        <label class="cb"><input type="checkbox" name="invy" ${prefs.invertY ? 'checked' : ''}> Invert Y</label>
        <label>Volume <input type="range" name="vol" min="0" max="1" step="0.05" value="${prefs.volume}"></label>
        <label class="cb"><input type="checkbox" name="mute" ${prefs.muted ? 'checked' : ''}> Mute (M)</label>
        <label>Graphics <select name="quality" ${lowfx ? 'disabled title="Low while ?lowfx is in the address"' : ''}>${(['low', 'medium', 'high'] as const)
          .map((q) => `<option value="${q}" ${(lowfx ? 'low' : prefs.quality) === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`)
          .join('')}</select></label>
      </div>`;
    const news = `<button class="btn" data-a="news">What's new${latestBuild ? ` (${latestBuild})` : ''}</button>`;
    const how = `
      <div class="how">
        <p>You run an <b>illegal gnome disposal business</b>. The <b>gnome factory</b> makes gnomes, the <b>hole</b> in your backyard eats them and spits out money.</p>
        <ul>
          <li>Stand at the <b>GNOME FACTORY</b> and <b>hold E</b> to make gnomes.</li>
          <li><b>Hold LMB</b>: your magnet grabs one gnome (the <b>Magnet Gun</b> from the shop grabs lots; <b>C</b> switches between hands and your tool, <b>hold Tab</b> picks the tool). <b>Release</b> to drop, <b>RMB</b> to throw. Heavy gnomes fly shorter.</li>
          <li>Trick shots pay more and stack (up to x20): AIR x2 (no bounce), LONG SHOT x2.5 (8 m), TRICK x3 (trampoline), SNIPER x4 (14 m), BULLSEYE x5 (through the golden hoop next to the hole).</li>
          <li><b>F</b> kick · <b>WASD</b> move · <b>Shift</b> sprint · <b>Space</b> jump · <b>H</b> all controls</li>
          <li>Walk over coins to collect them. Feed gnomes fast for <b>combos</b>.</li>
          <li>Spend money at the <b>SHOP</b> computer (<b>E</b>). Place tools with <b>1-0</b>. Fill a <b>crate</b> and dump it into the hole.</li>
          <li><b>E</b> on the <b>lever</b> beside the factory switches Auto Crank; <b>E</b> on a tool fixes it and swaps a blown <b>fuse</b>.</li>
          <li>Eat magic mushrooms. Watch out for greedy, angry and saboteur gnomes.</li>
          <li>Feed the hole. It grows. It hungers. Something waits at the bottom.</li>
        </ul>
      </div>`;
    this.el.innerHTML =
      mode === 'title'
        ? `<div class="menu-card title">
            <div class="logo">GNOME<br/>DISPOSAL INC.</div>
            <div class="subtitle">${daily.active ? `DAILY CHALLENGE ${daily.date} · 5 minutes` : 'a backyard gnome disposal simulator'}</div>
            <button class="btn big" data-a="play">${s.stats.playTime > 1 ? 'CONTINUE' : 'START HUSTLING'}</button>
            ${how}
            <div class="row-btns"><button class="btn" data-a="ach">Achievements (${s.achievements.length}/${ACHIEVEMENTS.length})</button>${
              daily.active ? '<button class="btn" data-a="yard">Back to your yard</button>' : `<button class="btn" data-a="daily">Daily challenge ${daily.date}</button>`
            }${news}</div>
            ${settings}
          </div>`
        : `<div class="menu-card">
            <div class="logo small">PAUSED</div>
            <div class="stats">${money(s.money)} · Hole lvl ${s.holeLevel} · ${s.stats.gnomesEaten} gnomes eaten · best combo ${s.stats.maxCombo}</div>
            <button class="btn big" data-a="play">RESUME</button>
            <div class="row-btns"><button class="btn" data-a="ach">Achievements (${s.achievements.length}/${ACHIEVEMENTS.length})</button>${news}</div>
            ${settings}
            ${how}
            ${daily.active ? '' : '<button class="btn danger" data-a="reset">Reset save</button>'}
          </div>`;
    this.el.classList.remove('hidden');
  }

  private renderAchievements(): void {
    const s = ctx.state;
    this.el.innerHTML = `<div class="menu-card">
      <div class="logo small">ACHIEVEMENTS</div>
      <div class="ach-grid">${ACHIEVEMENTS.map((a) => {
        const has = s.achievements.includes(a.id);
        return `<div class="ach ${has ? 'has' : ''}"><b>${has || !a.secret ? a.name : '??? (secret)'}</b><span>${has || !a.secret ? a.desc : 'Keep exploring...'}</span></div>`;
      }).join('')}</div>
      <button class="btn" data-a="back">Back</button></div>`;
  }

  hide(): void {
    this.visible = false;
    this.el.classList.add('hidden');
  }
}
