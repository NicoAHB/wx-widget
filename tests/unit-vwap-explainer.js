// 2.16.0 – optionale KI-Erklärung der VWAP-Lage am eigenen 24/7-Dienst (POST /v1/vwap/explain): Kontextprüfung, Anbieter/Modell nur aus der Erlaubnisliste,
// Tendenz (eher kaufen / eher verkaufen / abwarten) wird aus dem ersten Satz gelöst, 30-s-Sperre, Fehler ohne Geheimnisse, echter Endpunkt mit Schlüssel und Herkunft.
// Aufruf: node unit-vwap-explainer.js
let pass = 0, fail = 0; const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const { VwapExplainer, OrderflowExplainer, validVwap, vwapAnswer } = await import('../server/orderflow-explainer.mjs');
  let at = 1760000040000, requests = [], reply = 'Tendenz: Eher kaufen. Der Kurs liegt über dem VWAP und das Band steigt.';
  const context = { model: 'vwap-1', symbol: 'BTCUSDT', mode: 'pdh', modeName: 'ab Vortag-Hoch', interval: '15m', start: '2026-10-19T14:15:00.000Z', ageHours: 20.5, candles: 82, price: 70250, vwap: 70100, upper: 70400, lower: 69800, distPct: 0.214, sigma: 0.5, zone: 'upper', slope: 'rising', slopePct: 0.08, slopeBars: 12, recent: { n: 24, above: 20, below: 4, crosses: 2, streak: { side: 'above', count: 9 } } };
  const request = { provider: 'openai', model: 'allowed', context };
  const env = { SCALPDESK_AI_MODELS: 'openai:allowed,anthropic:allowed', SCALPDESK_AI_OPENAI_KEY: 'test-only', SCALPDESK_AI_ANTHROPIC_KEY: 'test-only' };
  const proxy = new VwapExplainer({ env, now: () => at, fetcher: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => url.includes('anthropic') ? { content: [{ type: 'text', text: reply }] } : { choices: [{ message: { content: reply } }] } }; } });

  check('validVwap: gültig / ungültig', validVwap(context) && !validVwap({ ...context, model: 'orderflow-1' }) && !validVwap({ ...context, mode: 'jahr' }) && !validVwap({ ...context, price: NaN }) && !validVwap({ ...context, zone: 'mitte' }) && !validVwap({ ...context, symbol: 'BTC' }) && !validVwap({ ...context, start: 'gestern' }) && !validVwap({ ...context, recent: null }) && validVwap({ ...context, slope: null, sigma: null }));
  check('Ohne Einrichtung 503, Modell außerhalb der Liste 503, beides ohne Netzaufruf', (await new VwapExplainer({ env: {} }).explain(request)).status === 503 && (await proxy.explain({ ...request, model: 'unlisted' })).status === 503 && requests.length === 0);
  check('Ungültiger Kontext oder Anbieter vor dem Netz mit 400 abgewiesen', (await proxy.explain({ ...request, context: { ...context, mode: 'x' } })).status === 400 && (await proxy.explain({ ...request, provider: 'andere' })).status === 400 && requests.length === 0);
  const result = await proxy.explain(request);
  check('OpenAI bekommt den VWAP-Kontext und die VWAP-Anweisung (Tendenz, keine erfundenen Zahlen)', result.status === 200 && requests[0].url === 'https://api.openai.com/v1/chat/completions' && JSON.parse(requests[0].body.messages[1].content).vwap === 70100 && /Tendenz: Eher kaufen/.test(requests[0].body.messages[0].content) && /erfinde keine/i.test(requests[0].body.messages[0].content) && /keine Anlageberatung/.test(requests[0].body.messages[0].content));
  check('Antwort: Modus zurück, Tendenz „kaufen“ gelöst, Begründung ohne den Tendenz-Satz', result.body.ok === true && result.body.mode === 'pdh' && result.body.lean === 'buy' && result.body.text === 'Der Kurs liegt über dem VWAP und das Band steigt.' && !('signal' in result.body));
  check('Zweiter Aufruf vor 30 Sekunden gesperrt (429), danach wieder möglich', (await proxy.explain(request)).status === 429 && requests.length === 1); at += 30000;
  reply = 'Tendenz: Eher verkaufen. Der Kurs liegt unter dem unteren Band.';
  const sell = await proxy.explain({ ...request, provider: 'anthropic' });
  check('Anthropic wird ebenso unterstützt; Tendenz „verkaufen“', sell.status === 200 && requests[1].url === 'https://api.anthropic.com/v1/messages' && sell.body.lean === 'sell' && requests[1].body.system.startsWith('Du bewertest die aktuelle Lage')); at += 30000;
  reply = 'tendenz: abwarten. Erst ein Schluss über 70400 würde etwas ändern.'; const wait = await proxy.explain(request); at += 30000;
  check('Tendenz „abwarten“ (Groß-/Kleinschreibung egal)', wait.body.lean === 'wait' && wait.body.text.startsWith('Erst ein Schluss'));
  reply = 'Der Kurs liegt über dem VWAP.'; const none = await proxy.explain(request); at += 30000;
  check('Ohne Tendenz-Satz bleibt der ganze Text, lean ist null (nichts wird erfunden)', none.status === 200 && none.body.lean === null && none.body.text === reply);
  check('vwapAnswer: Tendenz allein ergibt den vollen Text statt eines leeren', vwapAnswer({ context }, 'Tendenz: Abwarten.').text === 'Tendenz: Abwarten.' && vwapAnswer({ context }, 'Tendenz: Abwarten.').lean === 'wait');
  const failed = new VwapExplainer({ env: { SCALPDESK_AI_MODELS: 'openai:allowed', SCALPDESK_AI_OPENAI_KEY: 'test-only' }, fetcher: async () => { throw new Error('unreachable'); } }), bad = await failed.explain(request);
  check('Anbieter nicht erreichbar: 502 ohne Schlüssel in der Antwort', bad.status === 502 && !JSON.stringify(bad).includes('test-only') && failed.busy === false);
  const orderflow = new OrderflowExplainer({ env }), ofContext = { model: 'orderflow-1', symbol: 'BTCUSDT', signal: 'hold', state: 'position', score: 3, groups: Array.from({ length: 5 }, () => ({ vote: 0 })), warnings: [], vetoes: [], btc: { one: 1, five: 2 } };
  check('Orderflow-Erklärer bleibt unverändert (eigener Kontext, eigener Antwortaufbau); VWAP-Kontext lehnt er ab', (await orderflow.explain({ provider: 'openai', model: 'allowed', context })).status === 400 && (await proxy.explain({ ...request, context: ofContext })).status === 400);

  const { Watcher } = await import('../server/scalpdesk-247.mjs'), watcher = new Watcher({ token: '123456789:test-only', chat: '12345', key: 'k'.repeat(43), origins: ['https://nicoahb.github.io'], listen: '127.0.0.1:0', log: () => {} });
  reply = 'Tendenz: Eher kaufen. Der Kurs liegt über dem VWAP.'; watcher.vwapExplainer = proxy; at += 30000; let server;
  try {
    const port = await watcher.listenNow(); server = watcher.server;
    const send = (headers = {}, body = request) => fetch('http://127.0.0.1:' + port + '/v1/vwap/explain', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    check('Echter Endpunkt ohne Schlüssel 401, fremde Herkunft 403 – jeweils vor dem KI-Aufruf', (await send()).status === 401 && (await send({ authorization: 'Bearer ' + 'k'.repeat(43), origin: 'https://fremd.example' })).status === 403);
    const before = requests.length, answer = await send({ authorization: 'Bearer ' + 'k'.repeat(43), origin: 'https://nicoahb.github.io' }), json = await answer.json();
    check('Authentifizierter Endpunkt: 200, CORS, Modus und Tendenz', answer.status === 200 && answer.headers.get('access-control-allow-origin') === 'https://nicoahb.github.io' && json.mode === 'pdh' && json.lean === 'buy' && requests.length === before + 1);
    check('HTTP-Prüfung lehnt ungültigen Kontext ab (400)', (await send({ authorization: 'Bearer ' + 'k'.repeat(43) }, { ...request, context: { ...context, zone: 'x' } })).status === 400);
    const health = await (await fetch('http://127.0.0.1:' + port + '/v1/health')).json(); check('Dienstversion 2.16.0', health.v === '2.16.0');
  } finally { await new Promise(r => server.close(r)); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
