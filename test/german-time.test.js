const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
vm.runInContext(readFileSync(path.join(root, 'src/german-time.js'), 'utf8') + '\nglobalThis.api=EC_TIME;', context);
const D = context.api.Date;
test('deutsche Kalenderwerte und Mitternacht unabhängig vom Rechner', () => {
  for (const zone of ['UTC', 'Asia/Baghdad', 'America/New_York', 'Pacific/Honolulu']) {
    const code = readFileSync(path.join(root, 'src/german-time.js'), 'utf8') + `\nconst d=new EC_TIME.Date('2026-11-23T23:30:00Z');d.setHours(0,0,0,0);console.log(d.toISOString());`;
    assert.equal(execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim(), '2026-11-23T23:00:00.000Z');
  }
});
test('Sommer- und Winterzeit, Tage mit 23 und 25 Stunden', () => {
  assert.equal(+new D(2026, 2, 30) - +new D(2026, 2, 29), 23 * 3600000);
  assert.equal(+new D(2026, 9, 26) - +new D(2026, 9, 25), 25 * 3600000);
  assert.equal(new D('2026-07-01T12:00:00Z').getHours(), 14);
  assert.equal(new D('2026-12-01T12:00:00Z').getHours(), 13);
});
test('Kalenderänderungen über Monats- und Jahresgrenzen', () => {
  const d = new D(2026, 0, 1); d.setDate(0);
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2025, 11, 31]);
  d.setMonth(0); assert.equal(d.getMonth(), 0);
  assert.equal(new D(2026, 12, 1).getFullYear(), 2027);
});
test('doppelte und fehlende Stunden sind definiert', () => {
  assert.equal(new D(2026, 2, 29, 2, 30).toISOString(), '2026-03-29T01:30:00.000Z');
  assert.equal(new D(2026, 9, 25, 2, 30).toISOString(), '2026-10-25T00:30:00.000Z');
  const d = new D('2026-10-25T01:30:00Z'); d.setMinutes(35);
  assert.equal(d.toISOString(), '2026-10-25T01:35:00.000Z');
});
test('lokale ISO-Uhrzeit und Anzeige sind deutsch, Zeitstempel bleiben unverändert', () => {
  assert.equal(new D('2026-11-24T00:00:00').toISOString(), '2026-11-23T23:00:00.000Z');
  assert.equal(new D('2026-11-24T00:00:00+03:00').toISOString(), '2026-11-23T21:00:00.000Z');
  assert.equal(new D('2026-11-24T00:00:00Z').toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), '01:00');
  assert.ok(Number.isNaN(+new D('ungueltig')));
  assert.ok(Number.isNaN(+new D(2026, NaN, 1)));
});
