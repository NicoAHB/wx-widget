# Testnachweis Vorauswahl 3.71.1 – 15.10.2026

Auftrag: Raster/Liste, gemeinsames Touch-Sortieren und lesbare Zahlen im bestehenden Panel; anschließend testen und online stellen. Basis: `main` bei `d5142dd472fbb552c601225ebaac21b08aa0fa93` (3.71.0). Release-PR: https://github.com/NicoAHB/wx-widget/pull/125.

## Gesamtlauf und abschließende Nachprüfungen

`bash tests/lint.sh`: **0 Fehler**, drei bereits vorhandene Warnungen (`usableFx`, `ALARM_ICON`, `fx`). `bash tests/run-all.sh`: alle **181 Prüfprogramme seriell** ausgeführt, Browser niemals parallel. Erstlauf: **5757/5769** gezählte Einzelprüfungen; `statuscheck`, `smoke`, `visual` melden zusätzlich keine Fehler. Der Erstlauf hat wegen der unten aufgeführten Abweichungen Rückgabewert 1; ein vollständig grüner Gesamtlauf wird ausdrücklich nicht behauptet.

Nach dem Gesamtlauf wurde die Zahlenmessung von Canvas auf DOM-Range korrigiert: Canvas berücksichtigt die CSS-Tabellenziffern nicht zuverlässig. Eine zusätzliche Probe mit Inter, langen Preisen aus vielen Einsen und 30 Zahlenfeldern schlug vorher in allen 30 Feldern fehl; danach passen **30/30**. Der native Test `m112` enthält diese Regression jetzt ebenfalls. Die betroffenen Tests wurden am abschließenden App-Stand erneut seriell geprüft:

| Prüfung | Ergebnis |
| --- | --- |
| unit-wl – bestehende Signallogik und 5m-Zeitraum | 71/71 |
| m112 – neue Ansicht, Touch-Gesten, Persistenz, Zahlenbreiten | 33/33 |
| m111 – bestehende Vorauswahl, Filter und Daten | 23/23 |
| m53 sort – bisherige Sortier-/Abbruch-/Tastaturfälle | 26/26 |
| m45 – bestehende Zeitraum-/Daten-/Layoutprüfung | 75/75 |
| m69 – Offline-App nach dem Release-Build | 8/8 |
| unit-release – tatsächliche Lieferliste und Importgraph | 6/6 |
| build-release.mjs --check | App 3.71.1, Dienst 2.15.0, 82 PWA-/94 Dienstdateien konsistent |

**228/228 gezielte Vorauswahl-Prüfungen** bestanden (unit-wl, m112, m111, m53 sort, m45). Nach den Nachprüfungen bestehen 180 der 181 Programme; `m18` bleibt mit dem unten dokumentierten Altbefund offen.

`git diff --check` erfolgreich. App und Service Worker tragen 3.71.1, neues unveränderliches Bündel `bundles/3.71.1/`. Ältere Bündel und die Dienstversion bleiben unverändert.

## Eingeordnete Abweichungen

- **Bildkarten-Renderer fehlte in der Testumgebung:** vorhandene Abhängigkeiten mit `npm ci --prefix server` installiert, keine Paketdateien geändert. Nachprüfung: `unit-pattern-card` **71/71**, `unit-pnl-card` **15/15**, `unit-price-alarm-card` **14/14**, einschließlich der vorher übersprungenen Renderfälle.
- **unit-fvg:** Die unveränderte Zufallsfixture begann bei Zeitstempel 0. Python interpretierte diese Zahlen als Sekunden und überschritt den Pandas-Zeitbereich. Nur die Zeitbasis der Fixture auf eindeutige Millisekunden ab 01.01.2026 gesetzt; dieselben 4000 OHLC-Datensätze und Erwartungen. Nachprüfung **10/10**.
- **m45:** Das gemeinsame Abrufprotokoll enthielt zusätzlich Futures-Orderflow (30 Kerzen) und unabhängige Spot-Chart-Schnappschüsse. Die Prüfung verlangt jetzt ausdrücklich Spot-Kacheln, einen Abruf des erwarteten Intervalls und unverändert vollständige/lückenlose Serien und richtige Abonnements. Andere Panels dürfen weiterhin ihre eigenen Intervalle laden. Keine Änderung an Produktions-Kursabrufen oder Berechnungen.
- **Bekannte offene Fibonacci-Magnetabweichung (`m18`):** am Release-Stand **29/31**; zwei Prüfungen erhalten „Fib 38,2 %“ statt „Fib 50 %“. Auf dem unveränderten Ausgangsstand in einem eigenen Worktree ebenfalls reproduziert (erster Vergleich **30/31**, Wiederholung **29/31** mit exakt denselben beiden Fehlern; der Klickfall schwankt). Der Befund war bereits im bisherigen HANDOVER dokumentiert. Fibonacci-/Magnetcode und Test wurden für diesen Vorauswahl-Auftrag nicht verändert. Das ist die verbleibende fachliche Testabweichung, kein bestanden gemeldeter Fall.
- Ein zusätzlicher Aufruf von `unit-release` ohne die nötige Prozess-/Netzwerkfreigabe meldete `spawnSync … EPERM`; mit der üblichen Testfreigabe **6/6**. Der direkte Build-Abgleich war ebenfalls erfolgreich.

## Grenzen und Veröffentlichung

Browser: Chromium auf Linux, Touch-Ereignisse nativ über das Browserprotokoll; 320/390/430/768 px. Marktdaten und Versandziele sind lokale Testattrappen. Eine echte iPhone-/Safari-Abnahme bleibt offen; [Checkliste](VORAUSWAHL-LISTE-TOUCH.md#iphone-test-checkliste).

Nach Merge wird der erfolgreiche GitHub-Pages-Build für genau den Merge-Commit geprüft. Die öffentliche App, der Service Worker, die Lieferliste und alle 82 PWA-Dateien werden mit dem lokal geprüften Stand abgeglichen (Dateigröße/SHA-256, JavaScript-MIME-Typen). Den abschließenden Online-Nachweis enthält PR #125.

Einzelresultate aller Prüfprogramme: [VORAUSWAHL-3.71.1-TESTERGEBNISSE.json](VORAUSWAHL-3.71.1-TESTERGEBNISSE.json).
