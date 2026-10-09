// Optionaler, authentifizierter KI-Proxy. Schlüssel ausschließlich in Server-Umgebungsvariablen.
const PROMPT = 'Du erklärst ein bereits berechnetes Scalping-Signal. Die Regeln bestimmen Signal und Score; ändere sie niemals. Schreibe 2–4 kurze Sätze auf Deutsch. Nenne Warnungen und Vetos zuerst. Erkläre Gruppen und beide BTC-Stufen; 1m ist nur Frühwarnung. Bei offener Position erläutere Halten/Absichern/Aussteigen, Stop/Ziel und Zustand ausschließlich aus den gelieferten Daten. Erfinde keine Preise, Positionsdaten oder Renditeaussichten. Fehlende Werte bleiben unbekannt.';
export function validExplanation(context) {
  return context?.model === 'orderflow-1' && /^[A-Z0-9]{2,30}USDT$/.test(context.symbol) && ['buy', 'sell', 'wait', 'hold', 'secure', 'exit'].includes(context.signal)
    && ['flat', 'position'].includes(context.state) && Number.isFinite(context.score) && Math.abs(context.score) <= 7 && Array.isArray(context.groups) && context.groups.length === 5 && Array.isArray(context.warnings) && Array.isArray(context.vetoes) && context.btc && JSON.stringify(context).length <= 24000;
}
export class OrderflowExplainer {
  constructor({ env = process.env, fetcher = fetch, now = Date.now } = {}) { this.env = env; this.fetcher = (url, options) => fetcher(url, options); this.now = now; this.lastAt = null; this.busy = false; }
  async explain(body) {
    if (!validExplanation(body?.context) || !['openai', 'anthropic'].includes(body?.provider) || typeof body?.model !== 'string') return { status: 400, body: { ok: false, error: 'Ungültige Regelwerte oder Modellwahl.' } };
    const allowed = String(this.env.SCALPDESK_AI_MODELS || '').split(',').map(x => x.trim()).filter(Boolean), key = this.env[body.provider === 'openai' ? 'SCALPDESK_AI_OPENAI_KEY' : 'SCALPDESK_AI_ANTHROPIC_KEY'];
    if (!key || !allowed.includes(body.provider + ':' + body.model)) return { status: 503, body: { ok: false, error: 'KI-Modell am Dienst nicht eingerichtet. Nur Regeln bleibt aktiv.' } };
    if (this.busy || this.lastAt !== null && this.now() - this.lastAt < 30000) return { status: 429, body: { ok: false, error: 'KI-Erklärungen höchstens einmal pro 30 Sekunden.' } };
    this.busy = true; this.lastAt = this.now(); const controller = new AbortController(); let timer;
    try {
      const context = JSON.stringify(body.context), openai = body.provider === 'openai', request = openai ? { model: body.model, messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: context }], max_completion_tokens: 400 } : { model: body.model, max_tokens: 400, system: PROMPT, messages: [{ role: 'user', content: context }] };
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('KI-Zeitlimit')); }, 8000); });
      const response = await Promise.race([this.fetcher(openai ? 'https://api.openai.com/v1/chat/completions' : 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', ...(openai ? { authorization: 'Bearer ' + key } : { 'x-api-key': key, 'anthropic-version': '2023-06-01' }) }, body: JSON.stringify(request), signal: controller.signal }), timeout]);
      if (!response.ok) throw new Error('KI-Antwort nicht verfügbar'); const json = await Promise.race([response.json(), timeout]), text = openai ? json.choices?.[0]?.message?.content : json.content?.filter(c => c.type === 'text').map(c => c.text).join('\n');
      if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new Error('KI-Text nicht verfügbar');
      return { status: 200, body: { ok: true, signal: body.context.signal, text: text.trim() } };
    } catch { return { status: 502, body: { ok: false, error: 'KI-Erklärung nicht verfügbar. Nur Regeln bleibt aktiv.' } }; }
    finally { clearTimeout(timer); this.busy = false; }
  }
}
