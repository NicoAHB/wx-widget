// Optionaler, authentifizierter KI-Proxy. Schlüssel ausschließlich in Server-Umgebungsvariablen.
const PROMPT = 'Du erklärst ein bereits berechnetes Scalping-Signal. Die Regeln bestimmen Signal und Score; ändere sie niemals. Schreibe 2–4 kurze Sätze auf Deutsch. Nenne Warnungen und Vetos zuerst. Erkläre Gruppen und beide BTC-Stufen; 1m ist nur Frühwarnung. Bei offener Position erläutere Halten/Absichern/Aussteigen, Stop/Ziel und Zustand ausschließlich aus den gelieferten Daten. Erfinde keine Preise, Positionsdaten oder Renditeaussichten. Fehlende Werte bleiben unbekannt.';
export function validExplanation(context) {
  return context?.model === 'orderflow-1' && /^[A-Z0-9]{2,30}USDT$/.test(context.symbol) && ['buy', 'sell', 'wait', 'hold', 'secure', 'exit'].includes(context.signal)
    && ['flat', 'position'].includes(context.state) && Number.isFinite(context.score) && Math.abs(context.score) <= 7 && Array.isArray(context.groups) && context.groups.length === 5 && Array.isArray(context.warnings) && Array.isArray(context.vetoes) && context.btc && JSON.stringify(context).length <= 24000;
}
export class OrderflowExplainer {
  // prompt/valid/answer: Standard ist die Orderflow-Erklärung; der VWAP-Erklärer (unten) setzt eigene Werte und hat eine eigene 30-s-Sperre
  constructor({ env = process.env, fetcher = fetch, now = Date.now, prompt = PROMPT, valid = validExplanation, answer = (body, text) => ({ signal: body.context.signal, text }) } = {}) { this.env = env; this.fetcher = (url, options) => fetcher(url, options); this.now = now; this.prompt = prompt; this.valid = valid; this.answer = answer; this.lastAt = null; this.busy = false; }
  async explain(body) {
    if (!this.valid(body?.context) || !['openai', 'anthropic'].includes(body?.provider) || typeof body?.model !== 'string') return { status: 400, body: { ok: false, error: 'Ungültige Regelwerte oder Modellwahl.' } };
    const allowed = String(this.env.SCALPDESK_AI_MODELS || '').split(',').map(x => x.trim()).filter(Boolean), key = this.env[body.provider === 'openai' ? 'SCALPDESK_AI_OPENAI_KEY' : 'SCALPDESK_AI_ANTHROPIC_KEY'];
    if (!key || !allowed.includes(body.provider + ':' + body.model)) return { status: 503, body: { ok: false, error: 'KI-Modell am Dienst nicht eingerichtet. Nur Regeln bleibt aktiv.' } };
    if (this.busy || this.lastAt !== null && this.now() - this.lastAt < 30000) return { status: 429, body: { ok: false, error: 'KI-Erklärungen höchstens einmal pro 30 Sekunden.' } };
    this.busy = true; this.lastAt = this.now(); const controller = new AbortController(); let timer;
    try {
      const context = JSON.stringify(body.context), openai = body.provider === 'openai', request = openai ? { model: body.model, messages: [{ role: 'system', content: this.prompt }, { role: 'user', content: context }], max_completion_tokens: 400 } : { model: body.model, max_tokens: 400, system: this.prompt, messages: [{ role: 'user', content: context }] };
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('KI-Zeitlimit')); }, 8000); });
      const response = await Promise.race([this.fetcher(openai ? 'https://api.openai.com/v1/chat/completions' : 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', ...(openai ? { authorization: 'Bearer ' + key } : { 'x-api-key': key, 'anthropic-version': '2023-06-01' }) }, body: JSON.stringify(request), signal: controller.signal }), timeout]);
      if (!response.ok) throw new Error('KI-Antwort nicht verfügbar'); const json = await Promise.race([response.json(), timeout]), text = openai ? json.choices?.[0]?.message?.content : json.content?.filter(c => c.type === 'text').map(c => c.text).join('\n');
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new Error('KI-Text nicht verfügbar');
      return { status: 200, body: { ok: true, ...this.answer(body, text.trim()) } };
    } catch { return { status: 502, body: { ok: false, error: 'KI-Erklärung nicht verfügbar. Nur Regeln bleibt aktiv.' } }; }
    finally { clearTimeout(timer); this.busy = false; }
  }
}
// ---------- 2.16.0: optionale Erklärung der VWAP-Lage (Tendenz eher kaufen / eher verkaufen / abwarten, mit Begründung) ----------
// Die App rechnet Anker, VWAP, Band, Abstand, Steigung und die letzten Schlusskurse selbst (shared/vwap-situation.mjs) und schickt nur diese Zahlen.
// Die KI bewertet die Lage und begründet; sie erfindet keine Zahlen und ändert nichts an der Rechnung. Keine Anlageberatung.
const VWAP_PROMPT = 'Du bewertest die aktuelle Lage eines Kurses relativ zum VWAP (volumengewichteter Durchschnittspreis ab einem Anker) für einen Scalping-Trader. Nutze ausschließlich die gelieferten Zahlen; erfinde keine Preise, Ereignisse, Indikatoren oder Prognosen. Beginne mit genau einer dieser Tendenzen: „Tendenz: Eher kaufen.“, „Tendenz: Eher verkaufen.“ oder „Tendenz: Abwarten.“ Danach 3–4 kurze Sätze auf Deutsch: was der Anker bedeutet, wo der Kurs zu VWAP und Band steht, was Steigung und die letzten Schlusskurse zeigen und warum daraus die Tendenz folgt. Bei „Abwarten“ nenne, welche gelieferte Marke (VWAP oder Band) der Kurs erst erreichen oder verlassen müsste. Weise auf Schwächen hin (junger Anker, wenige Kerzen, Pendeln um den VWAP). Der VWAP allein ist eine dünne Grundlage und keine Anlageberatung; keine Gewinnzusagen.';
const VWAP_MODES = ['day', 'week', 'month', 'asia', 'london', 'ny', 'low', 'high', 'pdl', 'pdh', 'wl', 'wh', 'pwl', 'pwh', 'vol', 'anchor'];
const VWAP_LEAN = { 'eher kaufen': 'buy', 'eher verkaufen': 'sell', 'abwarten': 'wait' };
export function validVwap(c) {
  const n = v => typeof v === 'number' && Number.isFinite(v);
  return c?.model === 'vwap-1' && /^[A-Z0-9]{2,30}USDT$/.test(c.symbol) && VWAP_MODES.includes(c.mode) && typeof c.modeName === 'string' && c.modeName.length <= 40
    && typeof c.interval === 'string' && c.interval.length <= 5 && Number.isFinite(Date.parse(c.start))
    && n(c.price) && c.price > 0 && n(c.vwap) && c.vwap > 0 && n(c.upper) && n(c.lower) && n(c.distPct) && n(c.candles)
    && ['above-band', 'upper', 'at', 'lower', 'below-band'].includes(c.zone) && (c.slope === null || ['rising', 'flat', 'falling'].includes(c.slope))
    && !!c.recent && n(c.recent.n) && n(c.recent.above) && n(c.recent.below) && n(c.recent.crosses) && JSON.stringify(c).length <= 4000;
}
// Die Tendenz steht im ersten Satz; sie wird herausgelöst, der Rest ist die Begründung. Fehlt sie, bleibt der ganze Text und lean ist null.
export function vwapAnswer(body, text) {
  const m = /^\s*Tendenz:\s*(Eher kaufen|Eher verkaufen|Abwarten)\.?\s*/i.exec(text);
  return { mode: body.context.mode, lean: m ? VWAP_LEAN[m[1].toLowerCase()] : null, text: m ? text.slice(m[0].length).trim() || text : text };
}
export class VwapExplainer extends OrderflowExplainer {
  constructor(options = {}) { super({ ...options, prompt: VWAP_PROMPT, valid: validVwap, answer: vwapAnswer }); }
}
