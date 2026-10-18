// 3.68.1: Heikin-Ashi-Kerzen – reine Anzeige-Umrechnung der OHLC-Kerzen des Hauptcharts.
// HA_Close = (Open + High + Low + Close) / 4
// HA_Open  = (HA_Open_vorher + HA_Close_vorher) / 2, für die allererste Kerze das normale Open
// HA_High  = max(High, HA_Open, HA_Close), HA_Low = min(Low, HA_Open, HA_Close)
// Zeit, Volumen und alle übrigen Felder bleiben unverändert. Eine Kerze mit ungültigen Werten wird unverändert
// durchgereicht und die Reihe danach neu begonnen (kein Weiterrechnen mit NaN).
export function heikinAshi(rows) {
  const out = new Array(rows.length); let prevOpen = null, prevClose = null;
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (!c || ![c.open, c.high, c.low, c.close].every(Number.isFinite)) { out[i] = c; prevOpen = prevClose = null; continue; }
    const close = (c.open + c.high + c.low + c.close) / 4, open = prevOpen === null ? c.open : (prevOpen + prevClose) / 2;
    out[i] = { ...c, open, close, high: Math.max(c.high, open, close), low: Math.min(c.low, open, close), heikinAshi: true };
    prevOpen = open; prevClose = close;
  }
  return out;
}
