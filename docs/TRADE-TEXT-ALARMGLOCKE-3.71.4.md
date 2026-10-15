# Trade-Begleittext und Alarmglocke – 3.71.4

Nutzerauftrag vom 15.10.2026: Das optimierte Tradeverlaufsbild soll wieder den ausführlichen Telegram-Text der früheren Version erhalten. Die Glocke mit der aktiven Alarmzahl soll zu den eingestellten Alarmen führen.

## Tradebild und Text

Der gemeinsame Formatter enthielt die gewünschte Fassung weiterhin; seit der Bildüberarbeitung verwendete der Foto-Versand eine getrennte einzeilige Caption. `timgCaption` verwendet jetzt wieder den gemeinsamen Trade-Kartentext. Beispiel mit den Zahlen der Nutzervorlage:

```text
🟢 GEWINN · XRP/USDT Long
💶 Netto: +43,88 € · +89,54 %
⏱ Haltedauer: 1 Std. 52 Min.
📈 Max. Gewinn: +53,83 €
📉 Max. Verlust: 0,00 € (nie im Minus)
🕐 14:30:00
```

Alle Werte stammen dynamisch aus denselben Journal- und Verlaufsdaten wie das Bild; die Uhrzeit ist der Abschlusszeitpunkt in der lokalen Zeitzone. Ohne Euro-Wert erscheint USD, ohne Kerzen ein ausdrücklicher Hinweis auf nicht berechnete Maximalwerte. Die Bildzeichnung und ihre Kennzahlen werden nicht geändert.

Automatische und manuelle Sendungen verwenden denselben Weg: ein Foto mit mehrzeiliger HTML-Bildunterschrift. Der vorhandene Formatter begrenzt sicher auf 1024 Zeichen. Bei ausdrücklich abgelehntem HTML-Format folgt einmal dasselbe Foto mit dem gleichen Text als Klartext an dasselbe Ziel/Thema. Bei Netzwerkfehlern oder unklarer Zustellung erfolgt keine zusätzliche automatische Sendung. Die bestehenden Auftragszustände und Sperren gegen doppelte Bilder bleiben erhalten.

## Glocke mit Zahl

Die Zahl zählt alle aktiven Kurs-Alarme auf diesem Gerät. Das bisherige `span` ist jetzt ein nativer Button mit Vorlesebeschriftung und dem vorhandenen Navigationsweg zu „Kurs-Alarme“. Ein Tipp, Enter oder Leertaste zeigt die bestehende Alarmliste im passenden App-Bereich; es wird kein neues Alarmformular geöffnet. Bei null aktiven Alarmen verschwindet die Glocke. Ausgelöste Alarme bleiben weiterhin in der Liste.

Touch-Fläche mindestens 44 × 44 px. Die Kurs-Schaltfläche reserviert auf Touch dieselbe Zeilenhöhe, damit das Ein-/Ausblenden der Glocke die Leiste nicht verschiebt. Der Ton-Schalter in der oberen Werkzeugleiste behält seine bisherige Funktion.

## Prüfung und Veröffentlichung

Neue Prüfungen: `tests/unit-trade-caption.js` prüft das tatsächliche Caption-/Versandstück der App mit lokalen Antworten; `tests/m113.js` prüft native Alarmnavigation und Touch-/Tastaturbedienung bei 320/390/768/1440 px. Beide sind im seriellen Gesamtlauf registriert.

Zusätzlich werden die bestehenden Tradebild-/Zustellprüfungen `m55` und `m103`, Formatprüfungen, Höhen-/Mobilprüfungen, Alarmformular-, Vorauswahl- und Offline-/Releaseprüfungen seriell ausgeführt. Die Foto-Testattrappe liefert mehrzeilige Multipart-Felder mit CRLF; Textvergleiche vereinheitlichen diese protokollbedingten Umbrüche auf LF. PNG-Abmessungen und numerische Vergleiche bleiben erhalten. Es werden ausschließlich lokale Telegram-Attrappen angesprochen.

Der vollständige ältere 181-Programme-Lauf bleibt dem Stand 3.71.1 zugeordnet; dieser begrenzte Nachtrag wird anhand der betroffenen Versand-, Daten-, Navigations- und Mobilfälle geprüft. Der bekannte Fibonacci-Magnet-Altbefund ist im damaligen Nachweis dokumentiert. Die abschließenden Einzelresultate und die öffentliche Prüfung stehen im zugehörigen PR.

Release: App/Service Worker 3.71.4, neues unveränderliches Bündel mit 82 PWA-Dateien; vorherige Bündel unverändert. Dienstversion bleibt 2.15.0. Vorabprüfung im isolierten Browser; nach Veröffentlichung Pages-Build, Hash-/Größen-/MIME-Abgleich und öffentlicher Touchtest bei 320/390 px. Echte iPhone-/Safari-Abnahme bleibt offen.

## iPhone-Kontrolle

- App neu öffnen und Version 3.71.4 kontrollieren.
- Glocke mit Zahl antippen: vorhandene Kurs-Alarme erscheinen, ohne neues Formular.
- Beim nächsten regulären Tradeversand das neue Bild zusammen mit Netto, Haltedauer, Maximalwerten und Uhrzeit prüfen.
- Bereits gesendete Trades werden durch das Update nicht erneut verschickt.

Abschließende Fach-/UI-/Offlineprüfungen: **249/249 bestanden**. unit-trade-caption 17/17, unit-telegram-format 33/33, unit-release 6/6, m113 29/29, m55 49/49, m103 46/46, m5-heights 8/8, m109 15/15, m112 38/38, m69 8/8. Lint 0 Fehler, drei bekannte Warnungen; Release-Abgleich reproduzierbar. Vorabprüfung des endgültigen Stands bei 320/390 px: Glocke mindestens 44 × 44 px, Alarmliste sichtbar, keine JavaScript-Fehler. [Einzelnachweis](TRADE-TEXT-ALARMGLOCKE-3.71.4-TESTS.json).

Zusätzlicher Mobil-Lauf `m7`: zunächst 46/47. Der früher bereits dokumentierte Sicherungs-Zeitfall beim Schließen nach 200 ms schlug auch im ersten isolierten Nachtest fehl (12/13); unverändert wiederholt bestand er mit 13/13. Die bisherige Version 3.71.3 bestand im isolierten Vergleich ebenfalls mit 13/13. Diese Historie bleibt im Einzelnachweis erhalten; kein durchgängig grüner Gesamtlauf behauptet.
