/* Zusätzliche Bilanzkarte; die physische Aufteilung der Originalkarten bleibt getrennt. */
(() => {
  const Date = EC_TIME.Date, { esc } = WD;
  const PERIODS = { day: 'Heute', month: 'Monat', year: 'Jahr', billing: 'Abrechnung' };
  class FerrarisCard extends HTMLElement {
    constructor() {
      super(); this.attachShadow({ mode: 'open' }); this.period = 'day'; this.seq = 0;
      this.shadowRoot.addEventListener('click', (ev) => {
        const button = ev.target.closest('button[data-period]');
        if (button && PERIODS[button.dataset.period] && this.period !== button.dataset.period) {
          this.period = button.dataset.period; this.data = null; this.loadedKey = null; this.draw(); this.refresh();
        }
      });
    }
    setConfig(config) {
      if (!config.grid_import_total || !config.grid_export_total || !Array.isArray(config.pv_totals) || !config.pv_totals.length) throw new Error('Netzbezug, Einspeisung und mindestens einen PV-Ertragszähler auswählen');
      if (config.price_ct !== undefined && (typeof config.price_ct !== 'number' || !Number.isFinite(config.price_ct) || config.price_ct < 0)) throw new Error('Arbeitspreis in Cent/kWh angeben');
      const c = { billing_month: 1, billing_day: 1, ...config };
      EC_FERRARIS.windowFor('billing', Date.now(), c.billing_month, c.billing_day);
      if (new Set([c.grid_import_total, c.grid_export_total, ...c.pv_totals]).size !== c.pv_totals.length + 2) throw new Error('Jede Energiequelle nur einmal auswählen');
      WD.applyTheme(this, c, this.h);
      this.config = c; this.data = null; this.error = null; this.loadedKey = null; this.seq++;
      if (PERIODS[c.start_period]) this.period = c.start_period;
      this.draw(); if (this.isConnected) this.refresh();
    }
    set hass(hass) { this.h = hass; WD.applyTheme(this, null, hass); if (this.isConnected) this.refresh(); }
    connectedCallback() { this.draw(); clearInterval(this.timer); this.timer = setInterval(() => this.refresh(), 60000); this.refresh(); }
    disconnectedCallback() { clearInterval(this.timer); this.seq++; this.loadingKey = null; }
    getCardSize() { return 7; }
    getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
    static getConfigElement() { return document.createElement('energy-cockpit-ferraris-card-editor'); }
    static getStubConfig() { return { pv_totals: [], billing_month: 1, billing_day: 1 }; }
    async refresh() {
      if (!this.config || !this.h) return;
      const now = Date.now(), c = this.config, w = EC_FERRARIS.windowFor(this.period, now, c.billing_month, c.billing_day);
      const key = JSON.stringify([this.period, w.start, Math.floor(now / 300000), c]);
      if (key === this.loadedKey || key === this.loadingKey) return;
      const seq = ++this.seq; this.loadingKey = key;
      try {
        const result = await this.h.callWS({ type: 'recorder/statistics_during_period', start_time: new Date(w.start).toISOString(), end_time: new Date(w.end).toISOString(), period: w.period, statistic_ids: [c.grid_import_total, c.grid_export_total, ...c.pv_totals], types: ['change'], units: { energy: 'kWh' } });
        if (seq !== this.seq) return;
        this.data = EC_FERRARIS.aggregate(result, c, w); this.win = w; this.error = null; this.loadedKey = key;
      } catch (err) { if (seq === this.seq) { this.error = 'Die Statistik ist derzeit nicht abrufbar. Bitte später erneut versuchen.'; this.data = null; this.loadedKey = key; } }
      finally { if (seq === this.seq) { this.loadingKey = null; this.draw(); } }
    }
    draw() {
      if (!this.config) return;
      const c = this.config, d = this.data, number = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const energy = (n) => number.format(n) + ' kWh', money = (n) => n === null ? 'Preis fehlt' : number.format(n) + ' €';
      const date = (t) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const tile = (label, value) => '<div class="tile"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + '</div></div>';
      let body = this.error ? '<p role="status">' + esc(this.error) + '</p>' : !d ? '<p role="status">Statistik wird geladen …</p>' : !d.samples ? '<p role="status">Für diesen Zeitraum liegen noch keine gemeinsam auswertbaren Statistikwerte vor.</p>' :
        (!d.complete ? '<p class="warning" role="status"><b>Teilbilanz:</b> Es fehlen Statistikintervalle. Die folgenden Werte enthalten nur gemeinsam verfügbare Daten ab ' + esc(date(d.first)) + '; sie sind keine vollständige Abrechnung.</p>' : '') +
        '<div class="tiles">' + tile('Nettoänderung Ferraris', energy(d.net)) + tile('Netto-Arbeitskosten', money(d.netCost)) + tile('Wert der Solarproduktion', money(d.solarValue)) + '</div>' +
        '<div class="details">' + tile('Hausverbrauch, berechnet', energy(d.home)) + tile('Solarproduktion', energy(d.solar)) + tile('Netzbezug', energy(d.imported)) + tile('Einspeisung', energy(d.exported)) + '</div>' +
        '<p class="period">' + esc(date(this.win.start)) + ' bis ' + esc(date(this.win.end)) + ' · Europe/Berlin · bis zum letzten gemeinsamen Statistikintervall</p>' +
        (d.home < 0 ? '<p class="warning">Die Quellen ergeben einen negativen Hausverbrauch. Messintervalle und Zuordnung prüfen.</p>' : '') +
        (d.net < 0 ? '<p>Der negative Nettowert zeigt einen rechnerischen Erzeugungsüberschuss im gewählten Zeitraum, keine zugesagte Auszahlung.</p>' : '');
      this.shadowRoot.innerHTML = '<style>' + WD.themeCss() + ':host{display:block}ha-card{padding:22px 26px;border-radius:28px;overflow:hidden;background:radial-gradient(130% 90% at 50% 0%,var(--bg1) 0%,var(--bg0) 62%);border:1px solid rgba(var(--ov),.06);color:var(--txt);font-family:Inter,var(--ha-font-family-body,system-ui),sans-serif}h2{font-size:1.2rem;margin:0 0 16px}.tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}button{font:inherit;border:1px solid var(--stroke);border-radius:20px;padding:9px 16px;background:var(--panel);color:var(--txt);cursor:pointer}button[aria-pressed="true"]{background:rgba(56,189,248,.18);color:rgb(56,189,248)}.tiles,.details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.details{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:14px}.tile{border:1px solid var(--stroke);border-radius:22px;background:linear-gradient(160deg,rgba(var(--ov),.07),rgba(var(--ov),.015)),var(--panel);padding:16px 20px;min-width:0}.label,.foot,.period{color:rgb(var(--mut));font-size:.87rem;line-height:1.5}.value{font-size:1.55rem;font-weight:850;font-variant-numeric:tabular-nums;margin-top:8px;overflow-wrap:anywhere}.details .value{font-size:1.1rem}.warning{border-left:4px solid var(--warning-color);padding:10px 14px;background:var(--panel);line-height:1.5}.foot{margin-top:18px}@media(max-width:750px){.tiles{grid-template-columns:1fr}.details{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><ha-card><h2>' + esc(c.title || 'Ferraris-Bilanz') + '</h2><div class="tabs">' + Object.entries(PERIODS).map(([p, label]) => '<button data-period="' + p + '" aria-pressed="' + (this.period === p) + '">' + label + '</button>').join('') + '</div>' + body + '<p class="foot">Berechnete Verrechnung: Netzbezug − Einspeisung. Solarwert: gesamte Erzeugung × Arbeitspreis. ' + (c.price_ct === undefined ? 'Arbeitspreis bitte in den Karteneinstellungen ergänzen.' : 'Arbeitspreis: ' + esc(new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(c.price_ct)) + ' ct/kWh.') + '<br>Abrechnungsbeginn: ' + esc(c.billing_day + '.' + c.billing_month + '.') + ' · in den Karteneinstellungen änderbar.<br>Ohne Grundpreis. Kein ausgelesener Ferraris-Zählerstand. Bewertung zu einem festen Arbeitspreis; Tarifwechsel erfordern eine getrennte Bewertung.</p></ha-card>';
    }
  }
  const labels = { title: 'Titel', theme: 'Farbschema', grid_import_total: 'Netzbezug, saldierter Gesamtzähler', grid_export_total: 'Einspeisung, saldierter Gesamtzähler', pv_totals: 'PV-Ertragszähler (jede Anlage einmal)', price_ct: 'Arbeitspreis (Cent/kWh)', billing_month: 'Abrechnungsbeginn: Monat', billing_day: 'Abrechnungsbeginn: Tag', start_period: 'Zeitraum beim Öffnen' };
  WD.defineEditor('energy-cockpit-ferraris-card-editor', {
    formOnly: true, needsSetup: () => false, steps: () => [],
    form: () => ({ computeLabel: (s) => labels[s.name] || s.name, schema: [
      { name: 'title', selector: { text: {} } },
      { name: 'theme', selector: { select: { options: WD.THEME_OPTIONS } } },
      ...['grid_import_total', 'grid_export_total'].map((name) => ({ name, required: true, selector: { entity: { domain: 'sensor' } } })),
      { name: 'pv_totals', required: true, selector: { entity: { domain: 'sensor', multiple: true } } },
      ...[['price_ct', 0, 1000, 'any'], ['billing_month', 1, 12, 1], ['billing_day', 1, 31, 1]].map(([name, min, max, step]) => ({ name, selector: { number: { min, max, step, mode: 'box' } } })),
      { name: 'start_period', selector: { select: { options: Object.entries(PERIODS).map(([value, label]) => ({ value, label })) } } },
    ] }),
  });
  if (!customElements.get('energy-cockpit-ferraris-card')) customElements.define('energy-cockpit-ferraris-card', FerrarisCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'energy-cockpit-ferraris-card')) window.customCards.push({ type: 'energy-cockpit-ferraris-card', name: 'Energy-Cockpit Ferraris-Bilanz', description: 'Nettoenergie und Solarwert mit deutscher Zeit und einstellbarem Abrechnungsbeginn', preview: false });
})();
