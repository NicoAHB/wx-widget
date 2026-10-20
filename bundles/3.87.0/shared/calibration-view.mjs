// Anzeige der Kalibrierung in den Lernständen (3.84.0): ein Satz mit dem Urteil, einklappbar die Stufen, darunter der Vergleich
// Live gegen Rücktest. Nur textContent; kein HTML aus Daten.
const el = (doc, tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const pct = v => `${Math.round(v * 100)} %`;
export function createCalibrationBox(doc) {
  const box = el(doc, 'div', 'calibration'), line = el(doc, 'p', 'calibration-line'), details = el(doc, 'details', 'calibration-bins'), table = el(doc, 'table', 'calibration-table'), drift = el(doc, 'p', 'calibration-drift');
  line.setAttribute('role', 'status'); details.append(el(doc, 'summary', '', 'Stufen: genannt gegen erreicht'), table); box.append(el(doc, 'strong', '', 'Stimmen die Prozentzahlen?'), el(doc, 'small', 'calibration-hint', 'Die beim Signal genannte Wahrscheinlichkeit gegen den tatsächlichen Ausgang (Live- und Rücktest-Signale). Trennschärfe 0,50 = Zufall, 1,00 = perfekt.'), line, details, drift);
  return {
    box,
    update(report, vs) {
      line.textContent = report.text; line.dataset.verdict = report.verdict; table.replaceChildren();
      details.hidden = !report.bins.length;
      if (report.bins.length) {
        const head = el(doc, 'tr'); for (const h of ['Genannt', 'Signale', 'Ø genannt', 'Erreicht']) head.append(el(doc, 'th', '', h)); table.append(head);
        for (const b of report.bins) { const row = el(doc, 'tr', b.thin ? 'thin' : ''); for (const t of [`${pct(b.from)}–${pct(b.to)}`, `${b.n}${b.thin ? ' (wenig)' : ''}`, pct(b.meanP), pct(b.rate)]) row.append(el(doc, 'td', '', t)); table.append(row); }
      }
      drift.textContent = vs?.text || ''; drift.hidden = !vs?.text; drift.dataset.verdict = vs?.warn ? 'warn' : 'ok';
    }
  };
}
