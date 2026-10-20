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

export function secs(t: number): string {
  return Math.ceil(t) + 's';
}
