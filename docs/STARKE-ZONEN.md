# Starke Zonen, Signale und Backtest (seit 3.68.1)

Alles läuft lokal mit reiner Regel-Logik auf den vorhandenen Kerzen und Indikatoren – keine externe API, kein Schlüssel. Konstanten und Regeln stehen zentral in `shared/zone-strength.mjs` (`ZONE_STRENGTH`, `ZONE_SIGNAL`). **Starke Zone heißt nicht sichere Zone: Entscheidungshilfe, keine Garantie.**

## 1. Konfluenz-Score je Zone (0–100)

Bewertet werden die KI-Zonen (siehe [KI-ZONEN.md](KI-ZONEN.md)). Jede Faktorgruppe zählt **höchstens einmal**; weitere Faktoren derselben Gruppe erscheinen nur in der Erklärung.

| Gruppe | Gewicht | Faktoren (Quelle in der App) |
|---|---|---|
| Struktur | 25 | „Zone 4h“ = POC/Value Area/EMA 200/Bollinger der Analyse-Ebene (`ana.calc`, nur wenn sie vom Chart-Zeitrahmen abweicht), Periodenhoch/-tief, Fibonacci des letzten ZigZag-Schwungs (`fibSwing`), Unterstützung/Widerstand des Charts |
| Volumen | 25 | POC und Value-Area-Kante (`volumeProfile`), hohe Volumendichte der Zone (≥ 1,5 × Durchschnitt) |
| Derivate | 10 | Liquidationscluster (`lmClustersNow`), Whale-Käufe/-Verkäufe – **nur mit echten Daten**, sonst nicht bewertet |
| Trend | 20 | Kurs über/unter EMA 200, Trend 1h und 4h (EMA 20 zu EMA 50 aus der Signalbewertung) |
| Auslöser | 20 | RSI-Divergenz (`rsiDivergences`), Umkehrkerze der KI-Mustererkennung (pat-1, z. B. Hammer, Engulfing), Bollinger-Rand |

Ein Preisniveau zählt, wenn es höchstens 0,25 ATR neben der Zone liegt (Bollinger 0,5 ATR); Divergenz und Umkehrkerze höchstens 20 Kerzen alt.

**Starke Zone:** Score ≥ 70 **und** mindestens 3 verschiedene Gruppen, nicht durchbrochen. Liegt die Zone **gegen die EMA-200-Richtung** (Kaufzone unter EMA 200 bzw. Verkaufszone darüber), gilt sie erst ab **85** als stark. Mit den Startgewichten erreicht z. B. Struktur + Volumen + Trend genau 70.

## 2. Knopf „Zonen“ mit drei Zuständen

Die Beschriftung zeigt jeweils die nächste Aktion: **Zonen** (aus, neutral) → **Starke Zonen** (alle Zonen wie bisher, grün) → **Zonen ausblenden** (nur starke Zonen, kräftiges Grün) → wieder **Zonen**. Der Zustand wird gespeichert; ein gespeichertes „an“ aus 3.68.0 gilt als „alle Zonen“. In engen Breiten ist die Knopfgruppe seitlich wischbar statt umzubrechen.

## 3. Erklärung bei starken Zonen

- Beim Wechsel auf „Starke Zonen“: Hinweis „Nur Zonen, bei denen mehrere unabhängige Faktoren zusammentreffen (Score ≥ 70 …)“ bzw. ehrlich „Gerade keine starke Zone“.
- Label: „★ Kauf 63.313–63.573 · 90“. Antippen listet die erfüllten Faktoren, z. B. „Score 90/100 aus 4 Faktorgruppen: Fib 0,5 + hohes Volumen + Trend 1h ▼ + Trend 4h ▼ + Umkehrkerze (Bärisches Engulfing). Entscheidungshilfe, keine Garantie.“

## 4. Ein- und Ausstiegssignale

Eigener Knopf **Signale** neben „Zonen“, unabhängig vom Zonen-Zustand; immer mit den starken Zonen.

- **Long** nur, wenn die Schlusskerze eine starke Kaufzone berührt und darüber schließt, der **Trend-Filter** passt (Kurs über EMA 200 oder 1h und 4h aufwärts) und mindestens ein **Auslöser** höchstens 3 Kerzen alt vorliegt (RSI-Divergenz, Umkehrkerze, Bollinger-Rand). **Short** spiegelverkehrt.
- **Stop:** hinter dem letzten ZigZag-Tief/-Hoch (wenn höchstens 2 ATR hinter der Zone) bzw. hinter der Zone, plus 0,15 ATR.
- **Ziel:** nächste Gegenzone, POC oder Liquidationscluster; **Ausstieg** zusätzlich bei Gegensignal. Stop vor Ziel, wenn beides in einer Kerze liegt.
- Nur bei **CRV ≥ 1,5**.
- **Hebel** einstellbar (1–50, Start 5) in „Starke Zonen · Signale & Backtest“: Der Stop darf höchstens 70 % des Abstands bis zum Liquidationspreis nutzen, sonst kein Signal.
- Elliott, Prognose und Wellen-Prognose bleiben reine Anzeige und sind nie Auslöser.
- Darstellung: grüne ▲ Einstieg, rote ▼ Ausstieg, für das offene Signal Stop-, Ziel- und Einstiegslinie. Antippen eines Markers zeigt Einstieg, Stop, Ziel, CRV, Auslöser, Hebel/Liquidation.
- Die Marker stammen aus demselben Walk-forward wie der Backtest (je Kerze nur Daten bis dahin). Für die jüngste Kerze zählen zusätzlich Liquidationscluster, Whales und S/R live. Neu gerechnet wird bei neuem Kerzenschluss, Coin-/Zeitrahmenwechsel oder geändertem Hebel.

## 5. Backtest

In „Starke Zonen · Signale & Backtest“ → **Backtest starten**. Walk-forward über die geladenen, abgeschlossenen Kerzen des Charts (ab Kerze 210 für EMA 200): Je Kerze werden Zonen, Score und Signal **nur aus Daten bis zu dieser Kerze** berechnet; die Folgekerzen dienen nur der Auswertung.

- **Zone gehalten:** Berührt eine Kerze eine Zone (Score von vor der Berührung), gilt sie als gehalten, wenn der Kurs danach mindestens 1 ATR wegläuft, bevor ein Schluss 0,3 ATR jenseits liegt (höchstens 30 Kerzen; sonst unentschieden und nicht gezählt).
- **Signale:** dieselben Regeln wie im Chart, eine Position zur Zeit.
- **Tabelle je Score-Stufe** (<50, 50–69, 70–84, ≥85): getestete Zonen, gehalten (Anzahl und %), Signale, Trefferquote, Ø Ergebnis (R und % auf den Einsatz mit Hebel, ohne Gebühren), Ø CRV, max. Drawdown in R.
- Liquidationscluster und Whales gibt es nicht als Historie: Die Derivate-Gruppe zählt im Backtest nicht; S/R-Linien ebenfalls nicht.
- Wenige Fälle (z. B. 500 Kerzen) ergeben unsichere Zahlen.
- Im Chart-Vollbild steht die Klappfläche oben unter der Kopfzeile und scrollt geöffnet in sich; der Kopf bleibt stehen, der Chart behält mindestens 160 px (3.68.2). Der Backtest gibt nach höchstens 12 ms Rechenzeit ab, die Bedienung bleibt flüssig.

## Prüfen

- `node tests/unit-zone-strength.js` (28): Gruppen je einmal, Schwellen 70/85, 3 Gruppen, Derivate nur mit Daten, Faktortext, Signalregeln (Trend, Auslöser, CRV, Liquidation, Short), Positionsführung, „Zone gehalten“, Tabelle, keine Elliott-/Prognose-Eingaben.
- `node tests/m98.js` (32): drei Zustände, Farben, Hinweis, Faktorliste, ohne Neuberechnung, alte Einstellung.
- `node tests/m100.js` (25, davon Vollbild-Teil): Fläche oben, scrollt in sich, Minimieren danach.
- `node tests/m99.js` (14): Panel, Hebel, Backtest-Tabelle, **kein Look-Ahead** (gleiche Signale/Scores bei um 40 Kerzen gekürzter Reihe), Abbrechen, Signale-Knopf, ▲/▼, Linien, Details, Ausblenden, Leiste ohne Überlauf.
