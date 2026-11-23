/* Kalenderzeit dieses Forks: immer Europe/Berlin. Kein Eingriff in window.Date. */
const EC_TIME = (() => {
  const NativeDate = Date, zone = 'Europe/Berlin';
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const parts = (t) => {
    if (!Number.isFinite(+t)) return null;
    const p = Object.fromEntries(fmt.formatToParts(new NativeDate(+t)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
    return [p.year, p.month - 1, p.day, p.hour, p.minute, p.second, ((+t % 1000) + 1000) % 1000];
  };
  const utc = (p) => { const d = new NativeDate(0); d.setUTCFullYear(p[0], p[1], p[2]); d.setUTCHours(p[3] || 0, p[4] || 0, p[5] || 0, p[6] || 0); return +d; };
  const offset = (t) => utc(parts(t)) - t;
  const fromParts = (p, preferred) => {
    if (p.some((x) => !Number.isFinite(x))) return NaN;
    const wanted = utc(p), offsets = [...new Set([-86400000, 0, 86400000].map((n) => offset(wanted + n)))];
    const candidates = offsets.map((o) => wanted - o);
    const exact = candidates.filter((t) => utc(parts(t)) === wanted).sort((a, b) => a - b);
    // Doppelte Herbststunde: Setter behalten den Offset; Konstruktoren wählen die frühere Stunde.
    if (exact.length) return exact.find((t) => offset(t) === preferred) ?? exact[0];
    // Nicht existente Frühlingsstunde vorwärts über die Lücke verschieben.
    return candidates.filter((t) => utc(parts(t)) >= wanted).sort((a, b) => utc(parts(a)) - utc(parts(b)))[0] ?? NaN;
  };
  class GermanDate extends NativeDate {
    constructor(...args) {
      if (args.length > 1) {
        const p = [Number(args[0]), Number(args[1]), args.length > 2 ? Number(args[2]) : 1, ...[3, 4, 5, 6].map((i) => args.length > i ? Number(args[i]) : 0)];
        if (p[0] >= 0 && p[0] <= 99) p[0] += 1900;
        super(fromParts(p));
      } else if (typeof args[0] === 'string' && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?$/.test(args[0])) {
        const m = args[0].match(/\d+/g).map(Number);
        super(fromParts([m[0], m[1] - 1, m[2], m[3], m[4], m[5] || 0, Number((args[0].split('.')[1] || '').padEnd(3, '0'))]));
      } else if (!args.length) super(); else super(args[0]);
    }
    getFullYear() { return parts(this)?.[0] ?? NaN; }
    getMonth() { return parts(this)?.[1] ?? NaN; }
    getDate() { return parts(this)?.[2] ?? NaN; }
    getHours() { return parts(this)?.[3] ?? NaN; }
    getMinutes() { return parts(this)?.[4] ?? NaN; }
    getSeconds() { return parts(this)?.[5] ?? NaN; }
    getMilliseconds() { return this.getUTCMilliseconds(); }
    getDay() { const p = parts(this); return p ? new NativeDate(utc(p)).getUTCDay() : NaN; }
    getYear() { return this.getFullYear() - 1900; }
    getTimezoneOffset() { return Number.isFinite(+this) ? -offset(+this) / 60000 : NaN; }
    _set(method, args) {
      const p = parts(this); if (!p) return this.setTime(NaN);
      const wall = new NativeDate(utc(p)); wall[method](...args);
      return this.setTime(fromParts([wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds()], offset(+this)));
    }
    setFullYear(...a) { return this._set('setUTCFullYear', a); }
    setMonth(...a) { return this._set('setUTCMonth', a); }
    setDate(...a) { return this._set('setUTCDate', a); }
    setHours(...a) { return this._set('setUTCHours', a); }
    setMinutes(...a) { return this._set('setUTCMinutes', a); }
    setSeconds(...a) { return this._set('setUTCSeconds', a); }
    setMilliseconds(...a) { return this._set('setUTCMilliseconds', a); }
    toDateString() { return Number.isFinite(+this) ? this.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' }) : 'Invalid Date'; }
    toLocaleDateString(locale, options) { return super.toLocaleDateString(locale, { ...options, timeZone: zone }); }
    toLocaleTimeString(locale, options) { return super.toLocaleTimeString(locale, { ...options, timeZone: zone }); }
    toLocaleString(locale, options) { return super.toLocaleString(locale, { ...options, timeZone: zone }); }
    static parse(text) { return +new GermanDate(text); }
  }
  return { Date: GermanDate, zone, parts, fromParts };
})();
