const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function setup() {
  const elements = new Map();
  class HTMLElement {
    constructor() { this.isConnected = true; this.style = { setProperty() {}, removeProperty() {} }; }
    getAttribute() { return null; }
    setAttribute() {}
    attachShadow() { return this.shadowRoot = { innerHTML: '', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }; }
  }
  const context = vm.createContext({ HTMLElement, window: { addEventListener() {} }, document: { addEventListener() {} }, navigator: {}, customElements: { get: (k) => elements.get(k), define: (k, v) => elements.set(k, v) }, setInterval() {}, clearInterval() {} });
  for (const file of ['german-time.js', 'common.js', 'ferraris.js']) vm.runInContext(readFileSync(path.join(root, 'src', file), 'utf8'), context);
  vm.runInContext("WD.defineEditor=()=>{}; EC_TIME.Date.now=()=>Date.parse('2026-11-24T02:00:00Z');", context);
  vm.runInContext(readFileSync(path.join(root, 'src/ferraris-card.js'), 'utf8'), context);
  const Card = elements.get('energy-cockpit-ferraris-card');
  const card = new Card();
  card.setConfig({ grid_import_total: 'i', grid_export_total: 'e', pv_totals: ['p'], price_ct: 40, title: '<script>kein HTML</script>' });
  return card;
}
function series(start, count, change) { return Array.from({ length: count }, (_, i) => ({ start: start + i * 3600000, change })); }
test('Karte fordert deutsche Intervalle und kWh an und schützt eigene Texte', async () => {
  const c = setup(), start = Date.parse('2026-11-23T23:00:00Z'); let request;
  c.h = { callWS: async (r) => { request = r; return { i: series(start, 3, 2), e: series(start, 3, 0), p: series(start, 3, 1) }; } };
  await c.refresh();
  assert.equal(request.start_time, '2026-11-23T23:00:00.000Z');
  assert.equal(request.units.energy, 'kWh');
  assert.match(c.shadowRoot.innerHTML, /6,00 kWh/);
  assert.match(c.shadowRoot.innerHTML, /2,40 €/);
  assert.match(c.shadowRoot.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(c.shadowRoot.innerHTML, /<script>/);
  assert.doesNotMatch(c.shadowRoot.innerHTML, /<b>Teilbilanz/);
});
test('Netzwerkfehler erzeugen einen Hinweis statt einer Nullrechnung', async () => {
  const c = setup(); c.h = { callWS: async () => { throw Error('offline'); } };
  await c.refresh();
  assert.match(c.shadowRoot.innerHTML, /Statistik ist derzeit nicht abrufbar/);
  assert.doesNotMatch(c.shadowRoot.innerHTML, /0,00 €/);
});
test('später gestartete Messungen bleiben sichtbar als Teilbilanz markiert', async () => {
  const c = setup(), start = Date.parse('2026-11-24T00:00:00Z');
  c.h = { callWS: async () => ({ i: series(start, 1, 2), e: series(start, 1, 0), p: series(start, 1, 1) }) };
  await c.refresh(); assert.match(c.shadowRoot.innerHTML, /<b>Teilbilanz/);
});
test('veraltete Antworten überschreiben keinen inzwischen gewechselten Zeitraum', async () => {
  const c = setup(), resolvers = [], start = Date.parse('2026-11-23T23:00:00Z');
  c.h = { callWS: () => new Promise((r) => { resolvers.push(r); }) };
  const pending = c.refresh(); c.setConfig({ grid_import_total: 'i2', grid_export_total: 'e2', pv_totals: ['p2'], price_ct: 40 });
  resolvers[0]({ i: series(start, 3, 99), e: series(start, 3, 0), p: series(start, 3, 1) });
  await pending; assert.equal(c.data, null);
  resolvers[1]({ i2: series(start, 3, 2), e2: series(start, 3, 0), p2: series(start, 3, 1) });
  await new Promise(setImmediate);
  assert.equal(c.data.net, 6);
});
