import { ctx } from '../core/context';
import { inQuad } from '../core/ease';
import { daily } from '../systems/daily';

const CARDS: [string, string][] = [
  ['GNOME DISPOSAL INC.', 'Welcome aboard, new hire.'],
  ['The factory makes gnomes.', 'Nobody wants them.'],
  ['The hole in the backyard eats them.', 'It pays cash. Feed it, it grows.'],
  ['When the game starts, follow the GOAL panel, top left.', 'Click to start hustling'],
];
const AUTO_MS = 5000; // cards before the last move on by themselves, so the intro cannot delay the tutorial
const GUARD_MS = 300; // input right after a card appears is ignored: the second press of a double-click on START HUSTLING
const FADE_MS = 200;
// Esc and modifiers (also from Cmd/Alt+Tab) are not user gestures: they could never grant the lock on the last card
const IGNORED = new Set(['Escape', 'Shift', 'Control', 'Alt', 'Meta']);

// text cards between START HUSTLING and the first pointer lock, once per save
export class Intro {
  wanted(): boolean {
    return !daily.active && !ctx.state.seenIntro && ctx.state.stats.playTime <= 1;
  }

  show(done: () => void): void {
    const el = document.createElement('div');
    el.className = 'menu intro';
    const card = document.createElement('div');
    card.className = 'menu-card';
    el.appendChild(card);
    document.body.appendChild(el);
    let i = 0;
    let timer = 0;
    let shownAt = 0;
    // the last card waits for a gesture: pointer lock needs one; a hidden or blurred window holds the timer
    const arm = () => {
      clearTimeout(timer);
      if (i < CARDS.length - 1 && !document.hidden) timer = window.setTimeout(advance, AUTO_MS);
    };
    const hold = () => clearTimeout(timer);
    const onVisibility = () => (document.hidden ? hold() : arm());
    const render = () => {
      card.innerHTML = `<div class="logo small">${CARDS[i][0]}</div><div class="subtitle">${CARDS[i][1]}</div>`;
      card.classList.remove('show');
      void card.offsetWidth; // restarts the fade-in
      card.classList.add('show');
      shownAt = performance.now();
      if (i > 0) ctx.audio.whisper();
      arm();
    };
    const advance = () => {
      clearTimeout(timer);
      if (++i < CARDS.length) return render();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', hold);
      window.removeEventListener('focus', arm);
      document.removeEventListener('visibilitychange', onVisibility);
      el.removeEventListener('mousedown', onInput);
      ctx.state.seenIntro = true;
      done(); // inside the gesture, so the lock is granted
      el.style.pointerEvents = 'none';
      const t0 = performance.now();
      const fade = (now: number) => {
        const k = Math.min(1, (now - t0) / FADE_MS);
        el.style.opacity = String(1 - inQuad(k));
        if (k < 1) requestAnimationFrame(fade);
        else el.remove();
      };
      requestAnimationFrame(fade);
    };
    const onInput = () => {
      if (performance.now() - shownAt >= GUARD_MS) advance();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!IGNORED.has(e.key) && !e.repeat) onInput();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', hold);
    window.addEventListener('focus', arm);
    document.addEventListener('visibilitychange', onVisibility);
    el.addEventListener('mousedown', onInput);
    render();
  }
}
