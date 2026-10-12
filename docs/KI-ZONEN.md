# KI-Zonen (Kauf- und Verkaufszonen)

Seit **3.68.0**. Knopf **Zonen** in der Chart-Werkzeugleiste rechts neben **KI** und dem Magneten 🧲. An = grün, aus = grau. Der Zustand wird gespeichert (auch in Sicherung und GitHub-Sync, Schlüssel `scalpdesk.kizones.v1`), Standard ist aus.

Vollständig **lokal** im Browser: keine externe API, kein Schlüssel, keine Kosten, keine Fremdbibliothek (eigener Code in `shared/ki-zones.mjs`). Volumenprofil/POC, EMA 200 und Bollinger kommen aus den vorhandenen Funktionen der App.

## Darstellung

- **Grün** = Kaufzone (aus Swing-Tiefs), **rot** = Verkaufszone (aus Swing-Hochs), halbtransparent und **hinter den Kerzen**.
- Jede Zone beginnt beim ersten Swing-Punkt und reicht bis zum **rechten Chartrand**.
- Beschriftung rechts: Preisbereich und Score, z. B. „Kauf 63.313–63.573 · 58“ (am Handy gekürzt „Verk.“).
- **Grau, gestrichelt** = deutlich durchbrochen (nach dem letzten Swing ein Schlusskurs mindestens 0,3 ATR jenseits der Zone). Am PC steht zusätzlich „durchbrochen“.
- **Beschriftung antippen** zeigt die Gründe, z. B. „9 Berührungen, Ø Abprall 1,4 ATR, hohes Volumen, oberes Bollinger-Band, zuletzt in der letzten Kerze“.
- Je Seite nur die **drei stärksten** Zonen.

## Berechnung (je Zeitrahmen 5m bis 1d)

Grundlage sind die letzten bis zu 500 **abgeschlossenen** Kerzen des Charts.

1. **Swing-Punkte (Fraktale):** Ein Hoch/Tief zählt, wenn es höher/tiefer ist als die Nachbarkerzen links und rechts – 3 Kerzen bei 5m/15m, 4 bei 30m–2h, 5 ab 4h. Die jüngsten Kerzen ohne rechte Nachbarn ergeben noch keinen Swing.
2. **Gruppierung:** Swing-Punkte einer Seite werden nach Preis sortiert und zusammengefasst, solange der Abstand zum vorigen höchstens 0,6 ATR und zum ersten der Gruppe höchstens 1,5 ATR beträgt (eindimensionale Distanzgruppierung, wie DBSCAN mit einem Punkt Mindestgröße). Überlappende Zonen derselben Seite werden vereinigt.
3. **Zonenbreite:** Gruppenspanne plus 0,15 ATR Rand oben und unten, mindestens 0,5 ATR.
4. **Score 1–100** (Gewichte):
   - Berührungen 25 – Swing-Punkte bzw. Kerzenfolgen mit Docht in der Zone, deren Schluss nicht jenseits der Zone liegt (voll ab 5).
   - Abprall 15 – durchschnittliche Gegenbewegung nach einer Berührung in ATR (voll ab 3 ATR).
   - Volumen 15 – Volumendichte der Zone im Volumenprofil im Verhältnis zum Durchschnitt („hohes Volumen“ ab 1,5×).
   - Aktualität 15 – nimmt mit dem Abstand zur letzten Berührung ab.
   - Übereinstimmung 30 – POC 8, EMA 200 6, S/R-Level des Charts 6, Bollinger-Band (unteres für Kauf, oberes für Verkauf) 4, Periodenhoch/-tief 6.
   - Durchbrochene Zonen erhalten 60 % ihres Werts.
5. Je Seite die drei höchsten Scores.

Zeitrahmen 1m, 1w und 1M: keine Zonen (Hinweis beim Einschalten).

## Neuberechnung und Leistung

- Neu gerechnet wird nur bei **Zeitrahmen- oder Coinwechsel** und bei einem **neuen Kerzenschluss**. Ein/Aus zeichnet nur neu.
- Zwischenspeicher je Coin/Markt/Zeitrahmen (bis 16 Einträge): Zurückwechseln rechnet nicht erneut.
- Beim Wechsel zeigt die App zuerst zwischengespeicherte Kerzen und lädt dann frische; die Zonen folgen den frischen Daten.
- Messung: 500 Kerzen in unter 1 ms (Unit-Test-Grenze 20 ms). Ein Web Worker ist deshalb nicht nötig.

## Prüfen

- `node tests/unit-ki-zones.js` (16 Fälle: Zonen an Unterstützung/Widerstand, höchstens 3 je Seite, ATR-Breite, Volumen, S/R/POC/EMA/Bollinger, Durchbruch, nur bestätigte Fraktale, Leistung).
- `node tests/m98.js` (22 Fälle, 390 und 1440 px: Knopf neben KI/Magnet, aus/an grau/grün, gespeichert, hinter den Kerzen, bis zum rechten Rand, Details beim Antippen, kein Neuberechnen beim Umschalten, Zwischenspeicher, 1m ohne Zonen, Neustart).

Auf dem iPhone: Chart auf 15m oder 1h, **Zonen** antippen – grüne und rote Flächen erscheinen; eine Beschriftung antippen zeigt die Gründe. Noch einmal **Zonen** antippen blendet sie sofort aus.

Hinweis: Zonen sind eine regelbasierte Lesehilfe aus vergangenen Kursen, keine Kauf- oder Verkaufsempfehlung.
