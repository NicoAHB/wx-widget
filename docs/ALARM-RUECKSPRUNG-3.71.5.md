# Alarm-Rücksprung und Bewegungs-Hinweis – 3.71.5

Nutzerauftrag vom 15.10.2026: Die Glocke mit Alarmzahl soll beim zweiten Antippen zur vorherigen Ansicht einschließlich Scrollposition zurückführen. Zusätzlich soll die pauschale Meldung „Zu wenig Bewegung … ein Ziel von 1 % ist unrealistisch“ korrigiert oder entfernt werden.

## Glocke als Umschalter

Der erste Tipp merkt sich den aktiven Bereich/Tab, den Klappzustand der Vorauswahl, die Seitenposition und die Scrollpositionen der vorhandenen Desktopspalten. Anschließend öffnet derselbe vorhandene Navigationsweg die Kurs-Alarme. Der zweite Tipp stellt den gemerkten Zustand wieder her. Die abschließende Positionskorrektur erfolgt nach dem beim Bereichswechsel vorgesehenen Neuzeichnen des Charts. Noch ausstehende Scroll-Frames werden abgebrochen, laufendes weiches Scrollen endet unmittelbar; auch schnelles zweimaliges Antippen führt zurück.

Der Rückweg bleibt nach Löschen oder Auslösen des letzten aktiven Alarms über „🔔 0“ erreichbar. Erst nach der Rückkehr verschwindet die Glocke ohne aktive Alarme. Enter und Leertaste verwenden denselben Weg. Die Vorlesebeschriftung nennt abhängig vom Zustand „Alarme öffnen“ oder „Zur vorherigen Ansicht zurück“; `aria-pressed` kennzeichnet den Abstecher.

Eine bewusste andere Bereichs- oder Zielnavigation verwirft den alten Rücksprung. Der nächste Glockentipp merkt sich dann die neu gewählte Ausgangsansicht. Der Abstecher ist flüchtiger UI-Zustand, keine neue dauerhafte Nutzereinstellung. Alarm- und Handelsdaten werden durch die Navigation nicht geändert.

## Pauschale Bewegungswarnung entfernt

Die alte Warnung verglich ATR × √Anzahl der Kerzen des gewählten Zeitraums mit einer festen Schwelle von 1 %. Ein kurzer Zeitraum unterschreitet diese Schwelle häufig auch bei deutlicher Bewegung des Gesamtmarkts; die Rechnung belegt außerdem nicht, dass ein Kursziel „unrealistisch“ ist.

Deshalb wird der Warnblock einschließlich Info-Symbol nicht mehr erzeugt. Der ergänzende Text im Kachel-Tooltip und der veraltete Methodik-Satz sind ebenfalls entfernt. Es bleibt kein reservierter Platz für den Warnblock. Die vorhandenen Daten, ATR-Diagnosewerte, Scores, Indikatoren, Zeitraumwahl, Charts und Alarme bleiben erhalten. Es wird keine neue Handels- oder Volatilitätsschwelle eingeführt.

## Prüfumfang

`m114` prüft den Rücksprung aus Chart, Positionen, Einstellungen und Analysen bei 320/390/768/1440 px: gescrollte Ausgangsansicht, gleicher Bereich und Tab, abweichender Vorauswahl-Klappzustand, exakte Position, mehrmaliges und schnelles Umschalten, bewusste andere Navigation, Touch sowie Enter/Leertaste. `m113` prüft zusätzlich den erreichbaren Rückweg nach Löschen des letzten Alarms.

`m45` prüft das Ausbleiben der Warnung über alle Zeiträume sowie mit ausdrücklich ruhigen und stark bewegten Kerzen, weiterhin gemeinsam mit unabhängigen Prozent-, Signal-, Datenstrom-, Tastatur- und Mobilprüfungen. Ergänzend werden bestehende Vorauswahl-, Alarmformular-, Höhen-, Scroll-, Offline- und Releaseprüfungen seriell ausgeführt. Browserläufe erfolgen nicht parallel. Es werden keine echten Telegram-Nachrichten versandt.

Für diesen begrenzten Frontend-Nachtrag wird vom vollständigen, etwa 2,5-stündigen Gesamtlauf abgewichen: geprüft werden die betroffenen Navigations-, Vorauswahl-, Mobil-, Offline- und Releasewege. Der ältere vollständige Lauf bleibt dem damaligen Stand 3.71.1 zugeordnet. Die konkreten Resultate stehen im [Einzelnachweis](ALARM-RUECKSPRUNG-3.71.5-TESTS.json); der PR enthält den abschließenden öffentlichen Nachweis. Echte iPhone-/Safari-Abnahme bleibt separat offen.

App und Service Worker erhalten gemeinsam 3.71.5 mit eigenem unveränderlichem Bündel. Die Dienstversion bleibt 2.15.0; veröffentlichte ältere Bündel werden nicht verändert. Veröffentlichung über den vorhandenen GitHub-Pages-Weg, anschließend exakter Hash-/Größen-/Modultypabgleich der öffentlichen Dateien und Touchtest über HTTPS bei 320/390 px.

## iPhone-Kontrolle

- Version 3.71.5 öffnen, in einem Bereich nach unten scrollen, Glocke zweimal antippen: derselbe Bereich steht wieder an derselben Stelle.
- Mit geöffneter und geschlossener Vorauswahl sowie nach Scrollen innerhalb der Alarme wiederholen; auch schnelles zweimaliges Antippen prüfen.
- Vorauswahl-Coin öffnen und Zeiträume einschließlich 1m wechseln: kein Hinweis „Zu wenig Bewegung“ und keine leere Warnzeile.

Abschließende gezielte Prüfungen: **356/356 bestanden**. unit-wl 71/71, m45 75/75, m114 92/92, m113 33/33, m109 15/15, m112 38/38, m5-heights 8/8, m7-calm 10/10, m69 8/8, unit-release 6/6. Lint: 0 Fehler, drei bekannte Warnungen; Release-Abgleich reproduzierbar.

Vorabprüfung des endgültigen Lieferstands im isolierten mobilen Browser bei 320/390 px bestanden: Rückkehr jeweils exakt von/zu Scrollposition 347 px, schnelles erneutes Antippen stabil, Warnblock und Tooltip-Zusatz entfernt, Touchflächen ≥ 44 × 44 px und keine JavaScript-Fehler.
