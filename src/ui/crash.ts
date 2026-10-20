// Shows runtime errors on screen and keeps the last 5 in localStorage and sends them to logs/errors.log on the dev machine, so a crash on a playtest build leaves a trace.
const KEY = 'gnome-boozed-errors';
// in the release build this is assets/index-<hash>.js, which names the build
const BUILD = new URL(import.meta.url).pathname;

let box: HTMLDivElement | null = null;
let more = 0;
let sent = 0;

// Fire-and-forget to the dev/preview server (vite.config.ts). On GitHub Pages the endpoint is missing: the beacon just fails, no event.
function send(message: string, stack: string, url: string): void {
  if (sent >= 20) return;
  sent++;
  try {
    navigator.sendBeacon(`${import.meta.env.BASE_URL}__errors`, JSON.stringify({ message, stack: stack.slice(0, 8000), url, build: BUILD }));
  } catch {
    // a failed send must never become a new reported error
  }
}

function report(message: string, stack = ''): void {
  const entry = { message, stack, time: new Date().toISOString(), url: location.href };
  send(message.slice(0, 2000), stack, entry.url);
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-5)));
  } catch {
    // storage full, blocked or holding junk: the box still shows
  }
  if (box) {
    more++;
    box.querySelector('.crash-more')!.textContent = `+${more} more`;
    return;
  }
  const full = `${message}\n${stack}\nbuild: ${BUILD}\ntime: ${entry.time}\nurl: ${entry.url}`;
  box = document.createElement('div');
  box.className = 'crash';
  box.innerHTML = '<div class="crash-head"><b>The game hit an error</b><span class="crash-more"></span><button class="crash-copy">Copy</button><button class="crash-close">×</button></div><pre></pre>';
  const pre = box.querySelector('pre')!;
  pre.textContent = `${message}\n${stack.split('\n').slice(0, 8).join('\n')}\nbuild: ${BUILD}\ntime: ${entry.time}`;
  box.querySelector('.crash-copy')!.addEventListener('click', () => {
    const select = () => {
      pre.textContent = full;
      getSelection()?.selectAllChildren(pre);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(full).catch(select);
    else select();
  });
  box.querySelector('.crash-close')!.addEventListener('click', () => box!.classList.add('hidden'));
  document.body.appendChild(box);
}

export function installCrashReport(): void {
  window.addEventListener('error', (e) => report(e.message || String(e.error), e.error?.stack ?? ''));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    report(r instanceof Error ? r.message : `Unhandled rejection: ${String(r)}`, r instanceof Error ? (r.stack ?? '') : '');
  });
}

export function watchCanvas(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('webglcontextlost', () => report('The graphics context was lost (WebGL context lost). Reload the page.'));
}
