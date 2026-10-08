# Orderflow-Panel – PDF-Etappe 1

Veröffentlichte Version App/Service Worker **3.53.0**, Dienstquelle unverändert **2.9.0**. Die bisherigen KI-Verbesserungen wurden zuvor getrennt mit **3.52.0** veröffentlicht. Dieser Schritt setzt ausschließlich das Kerzen-Panel aus Bild 1 der angehängten PDF um. Öffentliche Dateien und Lieferung: [Liefernachweis](PDF-ETAPPE-1-LIEFERUNG.md).

## Änderungen

- Zwei Blöcke mit jeweils vier geschlossenen Kerzen und einer laufenden Zeile „jetzt“: **1 Minute** und **1 Stunde**, neueste Kerze unten, Zeiten UTC. Kauf-/Verkaufsanteile und vorzeichenbehaftetes Delta, deutsche kompakte Zahlen, feste Zeilen ohne Austausch ihrer DOM-Knoten.
- Öffentliche **Binance USDT-Futures** als sichtbare Quelle. Der bestehende Binance-Worker bündelt beide Abonnements; kein zusätzlicher Worker und keine doppelte Futures-Verbindung. Bei einem Spot-Hauptchart nutzt derselbe Worker zusätzlich seine Futures-Marktverbindung. Der Hauptchart kann weiterhin Spot anzeigen. Zusätzliche Futures-Meldungen erreichen dessen Preis-/Positions-/Alarmverarbeitung nicht.
- Vorhandene aktuelle rohe Futures-Kerzen werden wiederverwendet. Fehlende Starthistorie wird über den bestehenden API-Client ergänzt: höchstens 30 Minuten- und 5 Stundenkerzen. Kerzenlücken und Wiederverbindungen lösen begrenzte Nachladungen aus, kein zweiter dauernder REST-Feed.
- Umschalter **USDT / Coins**, lokal gespeichert und Bestandteil des persönlichen Backups. Beide Einheiten verwenden die jeweils gelieferten Taker-Felder. Fehlende oder ungültige Werte erscheinen als „—“; echter Nullumsatz bleibt neutral. Info erklärt die Rechnung und die nächste Handlung.
- Eigenständige Datenqualität pro Zeitebene: Live, REST, unvollständig, veraltet, getrennt oder pausiert. Nach mehr als **5 Sekunden** ohne passende frische Kerze ist die Anzeige veraltet. Andere Streams oder eine neue Zeichnung machen alte Daten nicht frisch. Unbekannte Futures-Symbole werden benannt und deren Zusatzabos abgeschaltet.
- Bei ausreichend breitem Chartcontainer im Querformat rechts **380 px**, auf Handy/hochkant darunter. Beide bestehenden Layouts sowie Hell/Dunkel/Eigene Farbe bleiben nutzbar. Im Hauptchart-Vollbild ist das Zusatzpanel ausgeblendet; Chart und Divergenz-Halo behalten ihre Bedienung.

## Was lässt sich einstellen?

In dieser Etappe nur die **Anzeigeeinheit USDT oder Coins**, direkt im Panel. Standard ist USDT. Die Erkennung/Regelgüte bestehender Chartmuster, KI-Modelle, Originalpläne, Positionen und Handelsberechnungen werden nicht verändert. Es gibt noch keinen neuen Ring, keine neue Kauf-/Verkaufsempfehlung und keine KI-Abfrage.

## Kurzer iPad-Test

1. Zuerst persönliche Daten sichern. [Die App über HTTPS öffnen](https://nicoahb.github.io/wx-widget/weather-widget-v2.html) und Version **3.53.0** prüfen; bei einer vorhandenen PWA das angebotene Update bewusst übernehmen und neu öffnen.
2. BTC oder ETH öffnen. Beide Kerzenblöcke sind gefüllt, die unterste Zeile heißt „jetzt“. Auf den nächsten Minutenwechsel warten: die bisherige Zeile erhält ihre UTC-Zeit, eine neue „jetzt“-Zeile beginnt unten.
3. USDT → Coins umschalten, App schließen/neu öffnen: Auswahl bleibt erhalten. „i“ öffnen und die Erklärung lesen. „Neu laden“ gleicht die Historie ab; Wiederholung ist zeitlich begrenzt.
4. iPad quer/hoch drehen und Standard/Dashboard wechseln. Rechts erscheint das Panel nur bei genügend Platz; sonst darunter. Hell, Dunkel und eigene Hintergrundfarbe prüfen. Zahlen bleiben lesbar; Hauptchart-Vollbild öffnen und über dessen Schließen-Button wieder verlassen.
5. Pause/Weiter testen. Internet kurz trennen: „getrennt“ bzw. „veraltet“ darf nicht wie frische Daten wirken. Nach Wiederverbindung müssen die Werte wieder vollständig sein. Coin wechseln: kein alter Coin darf stehen bleiben. Ein Spot-only Coin zeigt fehlende Futures ausdrücklich.

Die automatische Prüfung ersetzt keinen Test auf einem realen iPad/Safari. Gemäß PDF wird **erst nach dessen Rückmeldung mit Etappe 2 begonnen**. Komplette HTML-Datei und PWA-Paket gehören zusammen: die HTML-Datei importiert die versionierten Module; auf dem iPad über HTTPS bereitstellen, nicht allein als lokale Datei öffnen.

## Prüfung

`tests/unit-orderflow.js` prüft den tatsächlichen reinen Kern; `tests/m74.js` den echten bestehenden Worker/REST-Weg, absichtlich verschiedene Spot-/Futures-Kurse, Datenqualität, echten Minutenabschluss, feste Zeilen, Speicherung, mobile Anordnung und Kontraste. Alle 123 registrierten Ziele wurden vollständig seriell geprüft; nach dem vollständigen unveränderten Leistungsnachlauf m6 3909/3909 Einzelprüfungen grün. Lint 0 Fehler (3/2 bestehende Warnungen). Erstbefunde und Rohlogs stehen im [Testnachweis](PDF-ETAPPE-1-TESTNACHWEIS.md).

Automatische Abnahme und Veröffentlichung/Liefernachweis abgeschlossen. Offen: echte iPad-/Safari-/CORS-Abnahme und Rückmeldung vor Etappe 2. Spätere PDF-Etappen 2–7 sind hier nicht umgesetzt.
