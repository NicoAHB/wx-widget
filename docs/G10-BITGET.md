# G10(b) – öffentliche Bitget-Daten

Arbeitsstand 3.44.0, Datenvertrag `bg-public-1`, Fachmodell `cf-1`. `shared/bitget-public.mjs` ist ein eigener Transportadapter;
die Fachrechnung bleibt in den unveränderten G10(a)-Modulen. Keine private Kontoabfrage, keine Orders und keine Zugangsdaten.
Noch kein automatischer Abruf beim Appstart: Karten/Scheduler/Musterintegration folgen in G10(c), historischer Backtest in (d), Dienst in (e).
Bestehende Binance-Charts, Positionen und Alarme erhalten ihre bisherigen Quellen.

## Quellen und Grenzen

Nur `https://api.bitget.com`, GET, Produkt `USDT-FUTURES`, aktiver USDT-Perpetual:

| V2-Endpunkt | Verwendung |
| --- | --- |
| `/api/v2/mix/market/contracts` | Instrument/Status/Marginwährung; Preis-Tick und Mengen-/Mindestgrenzen |
| `/api/v2/mix/market/history-candles` | geschlossene Marktpreis-OHLCV, nur Basisvolumen (Feld 5) |
| `/api/v2/mix/market/current-fund-rate` | aktuell angekündigte Rate mit tatsächlichem `fundingRateInterval` und `nextUpdate` |

Intervalle: 1h → `1H`, 4h → `4H`, 1d → **`1Dutc`**. Tages-/4h-Grenzen ausdrücklich UTC. Kein Mark-/Indexpreis als Ersatz.
Tickgröße = `priceEndStep * 10^-pricePlace`; Mengenraster aus `sizeMultiplier`. Kontraktstatus/Quote/Margin/Tick fehlen → nicht bewertbar.
Fundingrate als Dezimalbruch, Bitget-Konvention positiv = Long zahlt. Kein angenommener 8h-Takt bei fehlendem Feld.
Aktuelle Rate trägt `kind:'current', costsComplete:false`: weder belegte historische Kosten noch sicher bekannte künftige Abrechnung.

V2-Pfade mit dem [offiziellen SDK](https://github.com/BitgetLimited/v3-bitget-api-sdk/tree/9e6ee012ded8f4430ad44243e33829f571b1adb5/bitget-python-sdk-api/bitget/v2/mix)
abgeglichen; aktuelle Antwortfelder/UTC-Zeitebenen/History-Grenzen zusätzlich mit dem [Referenzclient CCXT vom 06.10.2026](https://github.com/ccxt/ccxt/blob/5ab829220121112e4303a4fedf5b8be29776d33f/ts/src/bitget.ts).
Herstellerseiten: [Kerzenhistorie](https://www.bitget.com/api-doc/contract/market/Get-History-Candle-Data),
[Kontrakte](https://www.bitget.com/api-doc/contract/market/Get-All-Symbols-Contracts),
[Fundingrate](https://www.bitget.com/api-doc/contract/market/Get-Current-Funding-Rate).
Direkte Herstellerseiten/Live-API in dieser Cloud bisher durch Domainfreigabe blockiert (403 am Proxy), **keine echte Bitget-/CORS-Abnahme behauptet**.
`www.bitget.com` und `api.bitget.com` im Cloud-Entwurf ergänzt; Aktivierung verlangt Prüfen/Speichern und Veröffentlichen der Umgebung.

## API und gespeicherte Fortsetzung

`createBitgetPublicClient({fetch?, now?, wait?, timeoutMs?, spacingMs?})` erzeugt einen Client mit gemeinsamer serieller Warteschlange.
Standard: mindestens 150 ms zwischen Anfrageanfängen, 8 s Timeout. Nur öffentliche GETs, Cookies weggelassen, kein Body/Auth-Header,
Weiterleitungen abgelehnt. Antwort während des Empfangs auf maximal 1 MiB begrenzt; Erfolgscode `00000` und Providerzeit prüfen (nicht zukünftig, höchstens 30 s alt).
429: `Retry-After` als Sekunden/HTTP-Datum beachten, Folgeaufrufe vor `retryAt` führen keinen neuen Abruf aus. Kein endloser Retry.
Abbruch über `AbortSignal`; Fehler geben deutsche Gründe. Ein Client je App/Worker/Dienst, keine unabhängigen Clients je Coin/Tick anlegen.

`load({selection,config?,saved?,signal?})`: Auswahl = Instrument, Basis-/Kontextintervall, Horizont, ausdrücklich gewählte maximale
Haltedauer, Slippage und `indicatorAnchors:{base,context}`. Keine Kosten-/Einsatzwerte erfinden. Kontext muss höher als Basis sein.
Basis-/Kontextanker an ihren UTC-Grenzen; ein neuer Anker ist eine bewusste Modell-/Parameterentscheidung des späteren Adapters.

Rückgabe:

- `bereit`: `data:{scope,base,context,funding,contract,patterns:null}`, `saved` und `progress`.
- `nicht bewertbar`: Grund; fehlendes Funding erhält nutzbare Kurs-/Kontraktdaten, aber `funding:null` und keine Score-Freigabe.
  Sonstige fehlerhafte/unvollständige Daten ergeben `data:null`. Vorheriger übergebener Zustand bleibt unverändert.
- `nachladen`: begrenzter Job, `saved` zur Fortsetzung, keine fertigen Daten/Signal-Freigabe.
- `abgebrochen`: keine Freigabe; vorherigen Zustand behalten.

`scope.asOf` entsteht **nach** den Abrufen, keine rückwirkende Signalerzeugung. Kerzen werden erst nach Schluss und tatsächlichem Empfang
bekannt (`knownAt`). Letzte geschlossene Kerze und vollständiger EMA200-Warm-up auf beiden Ebenen nötig. Bei Stundenwechsel während
des Ladens erneut laden. Höherer Trend nutzt gemäß Nutzerentscheidung seinen eigenen letzten geschlossenen Kurs.

`saved`: Schema 1, Markt-/Modell-/Parameter-/Horizont-/Haltedauer-/Slippage-/Ankerkennung, je Ebene ein Indikatorzustand **vor** dem
gespeicherten Ausschnitt und höchstens 512 Kerzen. Ältere Kerzen im gemeinsamen Kern ins Checkpoint übernehmen; der ursprüngliche
Startanker bleibt erhalten. Fortsetzung lädt neue Kerzen plus die letzte gespeicherte Kontrollkerze. Abweichende Kontrollkerze ist ein
Datenkonflikt, kein stilles Überschreiben. Falsche Revision, geänderte Parameter trotz gleicher Revision, fremde Quelle und beschädigter
Zustand werden abgelehnt. Kein neuer EMA-Start bei Chart-Zoom. Persistenz in App/Oracle folgt in (c)/(e).

Der feste 512-Kerzen-Ausschnitt definiert den lokalen Struktur-/Musterkontext dieses Datenmodells; ältere Strukturen werden nicht behauptet.
Änderung dieser Konvention verlangt neue Modell-/Parameterrevision und getrennte Quoten. Gleiches Feedmodell in allen Laufzeiten verwenden.
`patterns:null` ist noch keine erfolgreiche leere Analyse: in (c) G09-Engine auf diesen **Bitget**-Kerzen anwenden, keine Binance-Fälle einmischen.

## Begrenzte Historienjobs

`range({symbol,timeframe,from,to,maxPages?,signal?})` lädt vorwärts in geschlossenen UTC-Zeitfenstern: höchstens 200 Kerzen/Seite,
zusätzlich höchstens 90 Tage/Seite (Tageskerzen daher höchstens 90). Maximal acht Seiten je Job. Cursor und Preisabdeckung explizit;
Folgejob setzt ab `nextFrom` fort. Identische Dubletten einmal, widersprüchliche Dubletten/OHLCV/UTC-Grenzen/Datenlücken abgelehnt.
Fehlender Listing-Warm-up ist kein kürzerer EMA. Rückgabe ist Preisabdeckung des angefragten Ausschnitts, kein Nachweis von 90 Tagen/2 Jahren
Signal-/Kostenhistorie. Historische Kenntniszeit-/Latenzmodelle und belegte Fundinghistorie gehören zu G10(d); heutige Empfangszeiten nicht zurückdatieren.

Tests: `unit-bitget.js` 54 Fachprüfungen, `m62.js` 8 Prüfungen für Node/Browser/Worker, echtes Browser-fetch mit lokalen Antworten,
Netzausfall und frischen Offline-Import. Alle externen Antworten sind feste lokale Testdaten, keine echten Kurse oder Nachrichten.
