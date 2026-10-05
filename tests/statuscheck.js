const h = require('./harness');
(async () => {
  await h.setup(); const b = await h.launch(), errors = [];
  try {
    const p = await b.newPage(); h.collect(p, errors);
    await p.goto(h.URL_BASE + '/status-check.html');
    await p.waitForFunction(() => !document.getElementById('run').disabled, null, { timeout: 20000 });
    console.log(await p.evaluate(() => ({ verdict: document.getElementById('verdict').textContent, live: [...document.querySelectorAll('#list-live li')].map(li => li.dataset.state + ': ' + li.querySelector('.msg').textContent), notify: [...document.querySelectorAll('#list-notify li')].map(li => li.dataset.state + ': ' + li.querySelector('.msg').textContent) })));
    await h.ctl('/blockws?on=1'); await p.click('#run');
    await p.waitForFunction(() => !document.getElementById('run').disabled, null, { timeout: 20000 });
    console.log(await p.evaluate(() => ({ verdict: document.getElementById('verdict').textContent, advice: document.getElementById('advice').textContent, live: [...document.querySelectorAll('#list-live li')].map(li => li.dataset.state + ': ' + li.querySelector('.msg').textContent) })));
  } finally { console.log(errors.filter(e => !/WebSocket|403/.test(e)).join('\n') || 'no errors'); await b.close(); await h.teardown(); }
})();
