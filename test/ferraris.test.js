const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
for (const file of ['german-time.js', 'ferraris.js']) vm.runInContext(readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
const F = vm.runInContext('EC_FERRARIS', context);
test('Ferraris verrechnet Einspeisung zum festen Bezugspreis und erhält negative Nettowerte', () => {
  const r = F.balance(100, 30, 50, 40);
  assert.equal(r.net, 70); assert.equal(r.home, 120); assert.equal(r.netCost, 28); assert.equal(r.solarValue, 20);
  assert.ok(Math.abs(F.balance(2, 5, 10, 40).netCost + 1.2) < 1e-10);
  assert.equal(F.balance(0, 0, 0, 0).netCost, 0);
  assert.equal(F.balance(1, 0, 0, undefined).netCost, null);
  assert.throws(() => F.balance(null, 0, 0, 40));
});
test('Abrechnungsbeginn ist konfigurierbar und rollt ins Vorjahr zurück', () => {
  const now = Date.parse('2026-02-01T12:00:00Z');
  assert.equal(new Date(F.windowFor('billing', now).start).toISOString(), '2025-12-31T23:00:00.000Z');
  assert.equal(new Date(F.windowFor('billing', now, 4, 15).start).toISOString(), '2025-04-14T22:00:00.000Z');
  assert.throws(() => F.windowFor('billing', now, 4, 31));
  assert.equal(new Date(F.windowFor('billing', now, 2, 29).start).toISOString(), '2025-02-27T23:00:00.000Z');
});
const start = Date.parse('2026-11-23T23:00:00Z'), hour = 3600000;
const cfg = { grid_import_total: 'i', grid_export_total: 'e', pv_totals: ['p1', 'p2'], price_ct: 40 };
const row = (n, change) => ({ start: start + n * hour, change });
test('beide PV-Quellen, echte Nullwerte und identische Intervalle', () => {
  const d = F.aggregate({ i: [row(0, 2)], e: [row(0, 0)], p1: [row(0, 1)], p2: [row(0, 2)] }, cfg, { start, end: start + hour, period: 'hour' });
  assert.equal(d.complete, true); assert.equal(d.solar, 3); assert.equal(d.home, 5); assert.equal(d.netCost, 0.8);
});
test('fehlende Quellen, gemeinsame Lücken und negative Messfehler sind keine Nullwerte', () => {
  const result = { i: [row(0, 2)], e: [row(0, 0)], p1: [row(0, 1)], p2: [row(0, 2)] };
  assert.equal(F.aggregate(result, cfg, { start, end: start + 3 * hour, period: 'hour' }).complete, false);
  result.p2 = [row(0, null)];
  assert.equal(F.aggregate(result, cfg, { start, end: start + hour, period: 'hour' }).samples, 0);
  result.p2 = [row(0, -1)];
  assert.equal(F.aggregate(result, cfg, { start, end: start + hour, period: 'hour' }).samples, 0);
});
test('Statistikzeilen außerhalb des Zeitraums und doppelte PV-Zähler werden nicht addiert', () => {
  const result = { i: [row(0, 2), row(1, 99)], e: [row(0, 0)], p1: [row(0, 1)], p2: [row(0, 2)] };
  assert.equal(F.aggregate(result, cfg, { start, end: start + hour, period: 'hour' }).net, 2);
  assert.equal(F.aggregate(result, { ...cfg, pv_totals: ['p1', 'p1'] }, { start, end: start + hour, period: 'hour' }).solar, 1);
});
