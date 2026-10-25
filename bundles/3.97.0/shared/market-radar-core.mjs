// market-radar-1: nachvollziehbare Marktbeobachtung aus vorhandenen Quellen, keine Handelsstimme.
export const RADAR_MODEL = 'market-radar-1';
export const RADAR_CONFIG = Object.freeze({ quoteMs: 5000, fundingMs: 180000, oiMs: 600000,
  newsMs: 4 * 3600000, calendarMs: 12 * 3600000, volumeBars: 20, volumeMultiple: 2,
  oiChangePct: 3, fundingPct: .1, eventWindowMs: 15 * 60000, newHeadlineMs: 3600000 });
const finite = v => typeof v === 'number' && Number.isFinite(v);
const fresh = (at, now, max) => finite(at) && at > 0 && at <= now && now - at <= max;
const same = (source, symbol) => source?.symbol === symbol;
const sum = xs => xs.reduce((s, v) => s + v, 0);

function activity(input, now, live, cfg) {
  const rows = same(input.futures, input.symbol) && Array.isArray(input.futures.series) ? input.futures.series : [];
  const closed = rows.filter(c => c?.closed && finite(c.time) && finite(c.end) && c.end <= now).slice(-(cfg.volumeBars + 1));
  const last = closed.at(-1), baseline = closed.slice(0, -1);
  const contiguous = closed.length === cfg.volumeBars + 1 && closed.every((c, i) => c.time % 60000 === 0 && c.end === c.time + 60000 && (!i || c.time === closed[i - 1].end));
  const volumesValid = closed.every(c => finite(c.usdt?.total) && c.usdt.total >= 0);
  const mean = baseline.length ? sum(baseline.map(c => c.usdt?.total ?? 0)) / baseline.length : 0;
  const ready = !!(live && contiguous && volumesValid && mean > 0 && last.end === Math.floor(now / 60000) * 60000);
  const ratio = ready ? last.usdt.total / mean : null;
  const taker = ready && last.usdt.total > 0 && finite(last.usdt.buy) && last.usdt.buy >= 0 && last.usdt.buy <= last.usdt.total ? last.usdt.buy / last.usdt.total : null;
  const w = input.whales, wn = input.receivedNow ?? now;
  const whaleLive = !!(same(w, input.symbol) && w.enabled && w.connected && ['spot', 'futures'].includes(w.market) && finite(w.since) && w.since <= wn);
  const span = whaleLive ? Math.min(60000, wn - w.since) : 0;
  const whales = whaleLive && Array.isArray(w.rows) ? w.rows.filter(r => fresh(r.seen, wn, 60000) && finite(r.usd) && r.usd >= w.min) : [];
  const buys = whales.filter(w => !w.sell), sells = whales.filter(w => w.sell);
  return { ready, status: ready ? ratio >= cfg.volumeMultiple ? 'attention' : 'quiet' : 'missing', at: ready ? last.end : null,
    ratio, mean: ready ? mean : null, volume: ready ? last.usdt.total : null, taker,
    bars: ready ? closed.map(c => c.usdt.total) : [],
    whales: { ready: whaleLive, span, market: whaleLive ? w.market : null, min: finite(w?.min) ? w.min : null,
      buyCount: buys.length, sellCount: sells.length, total: sum(whales.map(w => w.usd)), at: whales.at(-1)?.seen ?? null } };
}
function positioning(input, now, cfg) {
  const f = input.funding, oi = input.oi;
  const fundingReady = same(f, input.symbol) && finite(f.rate) && fresh(f.at, now, cfg.fundingMs) && !f.error;
  const oiReady = same(oi, input.symbol) && finite(oi.change) && finite(oi.priceChange) && fresh(oi.at, now, cfg.oiMs) && !oi.error;
  const fundingPct = fundingReady ? f.rate * 100 : null;
  const risk = fundingReady && Math.abs(fundingPct) >= cfg.fundingPct;
  const unusualOi = oiReady && Math.abs(oi.change) >= cfg.oiChangePct;
  return { status: risk ? 'risk' : unusualOi ? 'attention' : fundingReady && oiReady ? 'quiet' : 'missing', fundingReady, oiReady,
    fundingPct, fundingAt: fundingReady ? f.at : null, oiChange: oiReady ? oi.change : null,
    priceChange: oiReady ? oi.priceChange : null, oiAt: oiReady ? oi.at : null, risk, unusualOi };
}
function context(input, now, cfg) {
  const base = input.symbol.replace(/USDT$/, ''), n = input.news, calendar = input.calendar;
  const newsFresh = !!n && fresh(n.fetchedAt, now, cfg.newsMs);
  const covered = newsFresh && (n.covered?.includes(base) || n.news?.[base]?.length > 0 || n.binance?.some(b => b.coins?.includes(base)));
  const calendarReady = !!calendar && fresh(calendar.fetchedAt, now, cfg.calendarMs);
  const announcements = covered ? (n.binance || []).filter(b => b.coins?.includes(base) && b.imp === 'high' && finite(b.t) && b.t <= now &&
    (now - b.t <= 86400000 || finite(b.at) && b.at >= now && b.at <= now + 86400000)).map(b => ({
      id: b.code, title: b.title, source: 'Binance', publishedAt: b.t, eventAt: b.at,
      url: /^[0-9a-f]{32}$/.test(b.code) ? 'https://www.binance.com/en/support/announcement/' + b.code : '',
      risk: ['delist', 'pair', 'margin', 'futures-delist', 'monitor'].includes(b.kind), kind: 'announcement'
    })) : [];
  const headlines = covered ? (n.news?.[base] || []).filter(x => x.imp === 'high' && fresh(x.t, now, 86400000)).map(x => ({
    id: x.url, title: x.title, source: x.outlet || 'Google News', url: x.url, publishedAt: x.t, risk: false, kind: 'headline'
  })) : [];
  const items = [...announcements, ...headlines].sort((a, b) => Number(b.risk) - Number(a.risk) || b.publishedAt - a.publishedAt).slice(0, 2);
  const events = calendarReady ? (calendar.events || []).filter(e => e.cur === 'USD' && e.impact === 'high' && finite(e.t) && e.t >= now - cfg.eventWindowMs && e.t <= now + 86400000).sort((a, b) => a.t - b.t) : [];
  const event = events[0] || null, eventRisk = !!event && Math.abs(event.t - now) <= cfg.eventWindowMs;
  const newsRisk = items.some(x => x.risk), recent = items.some(x => fresh(x.publishedAt, now, cfg.newHeadlineMs));
  return { status: eventRisk || newsRisk ? 'risk' : recent ? 'attention' : covered && calendarReady ? 'quiet' : 'missing',
    newsFresh, newsReady: !!covered, calendarReady, newsAt: n?.fetchedAt ?? null, calendarAt: calendar?.fetchedAt ?? null,
    calendarSource: calendar?.source || 'Forex Factory', event, eventRisk, newsRisk, recent, items };
}

// Jede Quelle behält ihren Markt und ihre eigene Zeitbasis; fehlende Quellen stimmen nicht für „ruhig“.
export function marketRadar(input, cfg = RADAR_CONFIG) {
  const now = input.now, symbol = typeof input.symbol === 'string' ? input.symbol : '';
  if (!finite(now) || !/^[A-Z0-9]{2,24}USDT$/.test(symbol)) throw Error('Marktradar: ungültiger Coin oder Zeitpunkt.');
  const quote = same(input.futures, symbol) ? input.futures.quote : null;
  const live = !input.paused && !input.offline && quote?.fresh === true && finite(quote.price) && quote.price > 0 && fresh(quote.at, now, cfg.quoteMs);
  const a = activity(input, now, live, cfg), p = positioning(input, now, cfg), c = context(input, now, cfg), flags = [];
  if (a.ready && a.ratio >= cfg.volumeMultiple) flags.push({ id: 'volume', severity: 'attention', label: 'Volumenspike' });
  if (live && p.unusualOi) flags.push({ id: 'oi', severity: 'attention', label: 'Open Interest auffällig' });
  if (live && p.risk) flags.push({ id: 'funding', severity: 'risk', label: 'Funding extrem' });
  if (c.eventRisk) flags.push({ id: 'macro', severity: 'risk', label: 'USD-Termin im 15-Minuten-Fenster' });
  if (c.newsRisk) flags.push({ id: 'announcement', severity: 'risk', label: 'Wichtige Binance-Risikomeldung' });
  if (c.recent && !c.newsRisk) flags.push({ id: 'news', severity: 'attention', label: 'Neue wichtige Meldung' });
  const coverage = [a.ready, p.fundingReady, p.oiReady, c.newsReady, c.calendarReady].filter(Boolean).length;
  const status = input.paused ? 'paused' : input.offline ? 'offline' : !live ? quote ? 'stale' : 'loading'
    : flags.some(f => f.severity === 'risk') ? 'risk' : flags.length ? 'attention' : coverage < 5 ? 'partial' : 'quiet';
  return { model: RADAR_MODEL, symbol, now, quote: live ? { price: quote.price, at: quote.at } : null, live,
    status, coverage, flags: input.paused || input.offline ? [] : flags, activity: a, positioning: p, context: c };
}
