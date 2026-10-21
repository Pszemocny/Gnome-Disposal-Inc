const SUFFIXES = ['', 'k', 'm', 'b', 't', 'qa', 'qi', 'sx', 'sp', 'oc', 'no', 'dc'];

export function money(v: number): string {
  if (!isFinite(v)) return '∞';
  const neg = v < 0;
  v = Math.abs(v);
  let i = 0;
  while (v >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i++;
  }
  const s = i === 0 ? (v < 10 && v % 1 !== 0 ? v.toFixed(1) : Math.floor(v).toString()) : v < 10 ? String(+v.toFixed(2)) : v < 100 ? String(+v.toFixed(1)) : Math.floor(v).toString();
  return (neg ? '-' : '') + '$' + s + SUFFIXES[i];
}

export function num(v: number): string {
  return money(v).replace('$', '');
}

// h:mm:ss, hours unbounded (a long run can pass 24 h)
export function clock(t: number): string {
  const s = Math.floor(t);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
}

export function secs(t: number): string {
  return Math.ceil(t) + 's';
}
