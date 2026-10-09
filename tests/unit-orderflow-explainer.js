let pass = 0, fail = 0; const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const { OrderflowExplainer } = await import('../server/orderflow-explainer.mjs'); let at = 1760000040000, requests = [];
  const context = { model: 'orderflow-1', symbol: 'BTCUSDT', signal: 'hold', state: 'position', score: 3, groups: Array.from({ length: 5 }, () => ({ vote: 0 })), warnings: [], vetoes: [], btc: { one: 1, five: 2 }, position: { side: 'long', entry: 100 } }, request = { provider: 'openai', model: 'allowed', context };
  const proxy = new OrderflowExplainer({ env: { SCALPDESK_AI_MODELS: 'openai:allowed,anthropic:allowed', SCALPDESK_AI_OPENAI_KEY: 'test-only', SCALPDESK_AI_ANTHROPIC_KEY: 'test-only' }, now: () => at,
    fetcher: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => url.includes('anthropic') ? { content: [{ type: 'text', text: 'Position wird gestützt.' }] } : { choices: [{ message: { content: 'Position wird gestützt.' } }] } }; } });
  check('Ohne Einrichtung sicherer Regel-Fallback', (await new OrderflowExplainer({ env: {} }).explain(request)).status === 503);
  check('Anbieter/Modell nicht frei missbrauchbar', (await proxy.explain({ ...request, model: 'unlisted' })).status === 503 && requests.length === 0);
  const result = await proxy.explain(request); check('OpenAI bekommt fertigen BTC-/Positionskontext und unveränderliches Signal', result.status === 200 && result.body.signal === 'hold' && requests[0].url === 'https://api.openai.com/v1/chat/completions' && JSON.parse(requests[0].body.messages[1].content).btc.five === 2);
  check('Kein zweiter Aufruf vor 30 Sekunden', (await proxy.explain(request)).status === 429 && requests.length === 1); at += 30000;
  check('Anthropic unterstützt mit derselben Regelentscheidung', (await proxy.explain({ ...request, provider: 'anthropic' })).status === 200 && requests[1].url === 'https://api.anthropic.com/v1/messages');
  check('Ungültige Scores/Zustände vor Netzwerk abgewiesen', (await proxy.explain({ ...request, context: { ...context, score: 99 } })).status === 400 && (await proxy.explain({ ...request, context: { ...context, state: 'unknown' } })).status === 400);
  const failed = new OrderflowExplainer({ env: { SCALPDESK_AI_MODELS: 'openai:allowed', SCALPDESK_AI_OPENAI_KEY: 'test-only' }, fetcher: async () => { throw new Error('unreachable'); } });
  check('Fehlende Anbieterantwort erhält Regelbetrieb ohne Geheimnisse', (await failed.explain(request)).status === 502 && !JSON.stringify(await failed.explain(request)).includes('test-only'));
  let timeoutSignal; const slow = new OrderflowExplainer({ env: { SCALPDESK_AI_MODELS: 'openai:allowed', SCALPDESK_AI_OPENAI_KEY: 'test-only' }, fetcher: async (url, init) => { timeoutSignal = init.signal; return new Promise(() => {}); } }), started = Date.now(), expired = await slow.explain(request);
  check('Echtes 8-s-Zeitlimit bricht hängenden Anbieter ab, Regelbetrieb bleibt', expired.status === 502 && timeoutSignal.aborted && Date.now() - started >= 7900 && Date.now() - started < 11000 && !slow.busy);
  const { Watcher } = await import('../server/scalpdesk-247.mjs'), watcher = new Watcher({ token: '123456789:test-only', chat: '12345', key: 'k'.repeat(43), origins: ['https://nicoahb.github.io'], listen: '127.0.0.1:0', log: () => {} }); watcher.orderflowExplainer = proxy; at += 30000; let server;
  try { const port = await watcher.listenNow(); server = watcher.server; const send = (headers = {}, body = request) => fetch('http://127.0.0.1:' + port + '/v1/orderflow/explain', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    check('Echter Endpoint ohne Schlüssel 401 vor KI-Aufruf', (await send()).status === 401);
    check('Echter Endpoint fremde Herkunft 403 vor KI-Aufruf', (await send({ authorization: 'Bearer ' + 'k'.repeat(43), origin: 'https://fremd.example' })).status === 403);
    const answer = await send({ authorization: 'Bearer ' + 'k'.repeat(43), origin: 'https://nicoahb.github.io' }); check('Authentifizierter Endpoint erklärt denselben Positionszustand mit CORS', answer.status === 200 && answer.headers.get('access-control-allow-origin') === 'https://nicoahb.github.io' && (await answer.json()).signal === 'hold');
    check('HTTP-Regelprüfung lehnt ungültigen Score ab', (await send({ authorization: 'Bearer ' + 'k'.repeat(43) }, { ...request, context: { ...context, score: 8 } })).status === 400);
  } finally { await new Promise(r => server.close(r)); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
