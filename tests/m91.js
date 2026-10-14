// Tatsächlicher Worker-/Multipart-Versand: HTML zuerst, Klartext nur nach eindeutigem Formatfehler.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
async function waitSent(filter, count) { for (let i = 0; i < 60; i++) { const rows = (await h.ctl('/sent')).filter(filter); if (rows.length >= count) return rows; await h.sleep(100); } return (await h.ctl('/sent')).filter(filter); }
(async () => {
  await h.setup(); const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
    await ctx.addInitScript(() => {
      if (localStorage.getItem('seeded91')) return; localStorage.setItem('seeded91', '1');
      const token = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';
      localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token, chat: '987654321', bchat: '9001', tchat: '9002', pchat: '9003' }, ev: { pulse: false, news: false } }));
      localStorage.setItem('scalpdesk.history.v1', JSON.stringify([{ id: 'fallback-photo-91', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: 64000, leverage: 1, qty: .01, margin: 640, openedAt: Date.now() - 7200000, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, exit: 65000, fees: 0, pnl: 10, pnlSource: 'calc', closedAt: Date.now() - 3600000, fx: 1.16, note: 'A & B <prüfen>' }]));
    });
    page.on('pageerror', e => errors.push(e.message)); await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g06);
    await page.evaluate(() => document.getElementById('chan-open').click()); await h.ctl('/sentreset'); await h.ctl('/chan?tgformat=1');
    await page.click('[data-tg-test-target="patterns"]'); let sent = await waitSent(s => s.svc === 'tg' && !s.method, 2);
    check('Worker: erst HTML, nach Format-Ablehnung genau ein Klartextversuch', sent.length === 2 && sent[0].parse_mode === 'HTML' && sent[0].formatRejected && !sent[1].parse_mode && !sent[1].text.includes('<b>'));
    check('Fallback behält den Chartmuster-Chat und dieselbe Information', sent.every(s => s.chat_id === '9003') && sent[1].text.includes('TEST') && sent[1].text.includes('Chartmuster'));
    await h.ctl('/sentreset'); await h.ctl('/chan?tgfail=400&match=TEST'); await page.click('[data-tg-test-target="patterns"]'); await page.waitForFunction(() => !document.querySelector('[data-tg-test-target="patterns"]').disabled);
    sent = (await h.ctl('/sent')).filter(s => s.svc === 'tg' && !s.method); check('Andere 400-Ablehnung löst keinen zweiten Versand aus', sent.length === 1 && sent[0].parse_mode === 'HTML'); await h.ctl('/chan?tgfail=');
    await page.evaluate(() => document.getElementById('chan-dialog').close()); await h.ctl('/sentreset'); await h.ctl('/chan?tgformat=1');
    await page.evaluate(() => { document.getElementById('tgb-on').checked = true; document.getElementById('tgb-on').dispatchEvent(new Event('change')); document.getElementById('tgb-now').click(); });
    sent = await waitSent(s => s.method === 'sendDocument', 2);
    check('Sicherung: HTML-Beschriftung und einmaliger Klartext-Fallback', sent.length === 2 && sent[0].parse_mode === 'HTML' && sent[0].formatRejected && !sent[1].parse_mode && sent[1].caption.includes('SCALP-DESK-SICHERUNG'));
    check('Sicherung bleibt im eigenen Chat; Schema/Inhalt der Datei unverändert', sent.every(s => s.chat_id === '9001') && JSON.parse(sent[1].file).app === 'scalp-desk');
    await page.evaluate(() => { document.getElementById('tgb-on').checked = false; document.getElementById('tgb-on').dispatchEvent(new Event('change')); });
    await page.evaluate(() => __g06.timgPreview('fallback-photo-91')); await page.waitForSelector('#timg-img:not([hidden])'); await h.ctl('/sentreset'); await h.ctl('/chan?tgformat=1'); await page.click('#timg-send');
    sent = await waitSent(s => s.method === 'sendPhoto', 1); await page.waitForTimeout(1200); sent = (await h.ctl('/sent')).filter(s => s.method === 'sendPhoto'); await h.ctl('/chan?tgformat=0');
    // 3.71.0: Die Bildunterschrift des Trade-Bilds ist eine Zeile ohne HTML („XRP/USDT Long 20× · +43,88 € (+89,5 %) · 1:52 Std.“) – keine Formatablehnung, kein Zweitversand
    check('3.71.0: Trade-Bild: einzeilige Bildunterschrift ohne HTML, genau ein Versand in den Trades-Chat (keine Formatablehnung möglich)', sent.length === 1 && !sent[0].parse_mode && !sent[0].formatRejected && sent[0].chat_id === '9002' && /^[A-Z0-9]+\/USDT (Long|Short) [\d,]+× · [+−][\d.,]+ (€|USD)/.test(sent[0].caption) && !/[<>\n]/.test(sent[0].caption), JSON.stringify(sent.map(s => ({ pm: s.parse_mode, rej: s.formatRejected, cap: s.caption }))));
    check('… vollständiges PNG (1080 breit)', sent.length === 1 && sent[0].bytes > 10000 && sent[0].png && sent[0].w === 1080);
    check('Keine Laufzeitfehler', errors.length === 0); await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
