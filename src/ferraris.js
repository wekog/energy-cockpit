/* Reine Berechnungen. Zähler und Tarif stehen ausschließlich in der HA-Konfiguration. */
const EC_FERRARIS = (() => {
  const Date = EC_TIME.Date;
  const stamp = (v) => typeof v === 'number' ? v : Date.parse(v);
  const boundary = (year, month, day) => new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate()));
  const windowFor = (period, now, month = 1, day = 1) => {
    const d = new Date(now);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > new Date(2000, month, 0).getDate()) throw new Error('Ungültiger Abrechnungsbeginn');
    let start;
    if (period === 'day') start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    else if (period === 'month') start = new Date(d.getFullYear(), d.getMonth(), 1);
    else if (period === 'year') start = new Date(d.getFullYear(), 0, 1);
    else if (period === 'billing') { start = boundary(d.getFullYear(), month, day); if (+start > +d) start = boundary(d.getFullYear() - 1, month, day); }
    else throw new Error('Unbekannter Zeitraum');
    return { start: +start, end: +d, period: period === 'day' ? 'hour' : 'day' };
  };
  const balance = (imported, exported, solar, priceCt) => {
    if (![imported, exported, solar].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) throw new Error('Ungültige Energiemenge');
    const rate = typeof priceCt === 'number' && Number.isFinite(priceCt) && priceCt >= 0 ? priceCt / 100 : null, net = imported - exported;
    return { imported, exported, solar, net, home: solar + net, solarValue: rate === null ? null : solar * rate, netCost: rate === null ? null : net * rate };
  };
  const aggregate = (result, config, win) => {
    const solarIds = [...new Set(config.pv_totals)], ids = [config.grid_import_total, config.grid_export_total, ...solarIds];
    if (new Set(ids).size !== ids.length) throw new Error('Netz- und PV-Zähler müssen unterschiedliche Quellen sein');
    const maps = Object.fromEntries(ids.map((id) => [id, new Map((result[id] || []).filter((r) => stamp(r.start) >= win.start && stamp(r.start) < win.end && typeof r.change === 'number' && Number.isFinite(r.change) && r.change >= 0).map((r) => [stamp(r.start), r.change]))]));
    const slots = [...new Set(ids.flatMap((id) => [...maps[id].keys()]))].sort((a, b) => a - b), common = slots.filter((t) => ids.every((id) => maps[id].has(t)));
    const known = new Set(common); let missing = slots.length - common.length;
    for (let d = new Date(win.start); +d < win.end;) {
      const t = +d; if (win.period === 'hour') d = new Date(t + 3600000); else d.setDate(d.getDate() + 1);
      if (+d <= win.end && !known.has(t)) missing++;
    }
    if (!common.length) return { samples: 0, missing, complete: false };
    const sum = (id) => common.reduce((n, t) => n + maps[id].get(t), 0);
    return { ...balance(sum(config.grid_import_total), sum(config.grid_export_total), solarIds.reduce((n, id) => n + sum(id), 0), config.price_ct), samples: common.length, missing, complete: missing === 0, first: common[0] };
  };
  return { windowFor, balance, aggregate };
})();
