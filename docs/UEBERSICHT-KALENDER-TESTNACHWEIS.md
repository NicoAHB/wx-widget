# Testnachweis für Scalp Desk 3.66.0

Die gemeinsame Veröffentlichung enthält den Positionierungs-Score, automatische Geräteansichten, eingeklappte Erklärungen, den Tagesstandard der Vorauswahl und einen kostenfreien öffentlichen Krypto-Kalenderauszug. Handels-/Erkennungsregeln und Dienstversion 2.12.0 bleiben erhalten.

## Umfang und Ergebnis

Alle **171 registrierten Zielprogramme** wurden seriell vollständig ausgeführt. Nach den vollständigen relevanten Nachläufen sind **5576/5576 gezählte Kriterien** sowie Rauch- und Sichtprüfung grün. Alle **100 Browser-/Oberflächenziele** wurden vollständig nachgeprüft. Node-Fachmodule sind bytegleich zum Erstlauf; ihre Ergebnisse werden übernommen. Lint: **0 Fehler, 3 bekannte Warnungen**. Releasegraph: **6/6**, 75 PWA-/73 Dienstdateien.

Die neuen Kernprüfungen umfassen Vorauswahl **64/64**, Krypto-Kalender **31/31**, Gerätezuordnung **22/22** und Positionierung **38/38**. Native Oberfläche: neue Optimierungen **27/27**, Geräte/Navigation **122/122**, Positionierung **39/39**. Offline-Sicherung, vollständiger nativer Arbeitsbereich und tatsächlicher Service-Worker-Start sind enthalten. Kein Browser-/Installer-Test lief parallel.

[Alle Erst-/Nachläufe, Rückgabewerte und Produkt-Hashes](UEBERSICHT-KALENDER-TESTNACHWEIS.json).

## Erstbefunde und Korrekturen

Der erste Lauf auf `58be7c6` führte alle 171 Ziele in **95,1 Minuten** aus. Die **157 geschützten Produktdateien** blieben währenddessen unverändert. Ergebnis: 5228/5285 gezählte Kriterien; 29 Zielprogramme mit Befund. M94/M92/M67/M63 brachen vor ihrer Abschlusszählung ab; positive Teilfälle werden nicht als bestandene vollständige Ziele gezählt.

Die ältere isolierte Widgetfixture ordnete echte App-Knoten falsch zurück: Orderflow stand vor dem Chart und belegte damit dessen flexible Spalte; der Plot war auf PC/iPad exakt 380px breit. Footer/Leisten waren vertauscht, leere `details` erzeugten anonyme Grid-Plätze. Generische ältere Geräteprofile und der weiter aktive Fokus-Kontext führten außerdem zu anderen CSS-Baselines, gekürzten Listen, versteckten Feldern und fehlender Popup-Platzierung. Das Gerüst stellt jetzt ausdrücklich den ursprünglichen Widgetkontext wieder her. Die tatsächliche Produktnavigation und Gerätewahl werden separat nativ geprüft. HTML/Module/SW werden nicht ersetzt; keine Gesamtansicht oder Testschalter wurden in die App eingebaut. Der bestehende `__g05`-Diagnosezugriff zeigt zusätzlich den UI-Zustand.

Ein Zwischenlauf M74 hatte 71/73, bis die anonymen Boxen leerer Klappwrapper ausschließlich in der Fixture entfernt wurden; vollständiger Nachlauf 73/73. M22 hatte später 25/26 durch 51px zwischen Heatmap und Whales: Die ursprüngliche HTML-Reihenfolge lautet **Fibonacci → Heatmap → Whales**, die Fixture hatte Fib hinter die Heatmap gesetzt. Diese Rückgabe wurde korrigiert; der Test und seine unveränderte 2px-Grenze bleiben erhalten. M22 vollständig 26/26; Fib-/Heatmap-/Touch-/Panel-/Vollbildfälle einschließlich M23/M74/M75/M10 erneut vollständig grün.

M14 hatte 16/18, weil er die Ladeplatzhalter vor Fertigstellung seiner isolierten Ansicht maß: 441–504px vor dem Umbau gegenüber 38–42px danach. Der Test wartet jetzt auf die passende Ansicht und hält ausschließlich die öffentliche BTC-4h-/500er-Analyseantwort bis zur ersten Messung zurück. Danach wird dieselbe echte Antwort freigegeben und die fertige Analyse abgewartet. Beide Handyprofile messen neun echte Platzhalter; vollständiger Nachlauf 18/18 mit unveränderten Höhengrenzen.

M92/M94 richten vor sichtbarkeitsabhängigen Folgeprüfungen den tatsächlichen Plot ins Fenster. Der öffentliche Krypto-Datenpfad wurde im Markt-Mock ergänzt; zuvor erzeugte das Öffnen sämtlicher Erklärungen dort einen unbeabsichtigten 404. Keine Fehlerfilter oder fachlichen Grenzwerte wurden gelockert.

## Letzter Programmstand

Nach den fachlichen Prüfungen wurden ausschließlich die drei neuen HTML-Blöcke mit ihrem Versionskommentar **3.66.0** gekennzeichnet. Beide vollständigen JavaScript-ASTs sind identisch, ebenso sämtliche HTML-/CSS-Markups außerhalb der Scripts. Nur HTML-Hash und SW-Buildkennung ändern sich dadurch. Das neue Bündel wird zusätzlich mit nativer M97/M84, vollständiger UI-/Offline-, Status-, Rauch- und Sichtprüfung geprüft; ihre vollständigen Ergebnisse stehen in der JSON-Datei. Alle Fachmodule, Engine und Dienst bleiben bytegleich.

Jede Folgegruppe besitzt einen eigenen Hashsatz und eigene Rohlogs unter `/workspace/.wx-widget-tools/release-3.66-*`. Zwischenbefunde wurden nicht überschrieben. Die JSON-Datei führt vollständige Erst-/Nachläufe getrennt und übernimmt je Ziel das letzte vollständige Ergebnis.

## Reale Quelle und Grenzen

Der Kalender-Collector wurde mit der tatsächlichen öffentlichen CoinMarketCal-Seite und exakt dem Workflow-User-Agent ausgeführt: **13 gültige laufende/kommende Termine**, ohne API-Schlüssel. Die URL `/en/` liefert HTTP 301; Curl folgt jetzt höchstens drei HTTPS-Weiterleitungen mit unverändertem Zeit-/Größenlimit. Bashblöcke des Workflows syntaktisch geprüft. Der öffentliche Kalender-Job und alle veröffentlichten PWA-Hashes werden zusätzlich nach dem Merge überprüft.

Dies ist eine technische Abnahme mit lokalem Binance-/Telegram-Mock und echten Modulen/Workern. Reale Safari-Geräte, persönliche Telegram-Chats und die private Oracle-VM wurden hier nicht bedient. Der Nutzer übernimmt den neuen 2h-Musterzeitraum einmal bewusst am bestehenden Dienst. Der Krypto-Auszug ist unvollständig und hat keine automatische Alarm-/Bot-Stimme.
