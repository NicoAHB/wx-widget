# Adaptive AI-Grid (Rauschen-Trader)

Die neue Auswahl im Trading-Bot ergänzt die bestehende **Modellsimulation** um öffentliche Bitget-Daten und geprüfte Limitpläne für einen **USDT-Futures-Long-Bestand**. Verkäufe dürfen diesen Bestand ausschließlich reduzieren. Ohne bestätigten eigenen Kauf-Fill sind Verkaufsziele bedingte Pläne.

Die aktuelle Oberfläche lädt und prüft per Knopfdruck. Sie überwacht das Grid nicht automatisch, erzeugt keine Fills, sendet keine privaten Börsenorders und berechnet keine erfundenen Ausführungsgewinne. Lokal und im serverbestätigten Modelllauf arbeitet derselbe Rechenkern. Für Oracle benötigt das Grid die Dienstquelle 2.11.0; eine ältere Version erhält keinen Grid-Startauftrag. Die private VM wird durch die Pages-Veröffentlichung nicht aktualisiert. Ein privater Oracle-Executor mit belegten Beständen, Fills und Stoporders ist ein eigener nächster Integrationsschritt.

## Bedienung und Prüfung

1. Trading-Bot öffnen, Strategie **Adaptive AI-Grid (Rauschen-Trader)** wählen. Die eigenen Grid-Einstellungen öffnen sich; Richtung Long und eine Position sind festgelegt.
2. Eigene Übungsbasis, Risiko, nominale Exposition, Hebel und Grid-Kapital eingeben. **Übungswerte einsetzen** füllt ausschließlich leere Felder; eigene Angaben bleiben erhalten. Beispielkapital 100 USDT ist eine Modellannahme.
3. Bot bewusst aktivieren und Modelllauf starten. **Bitget-Range und Grid prüfen** lädt 14 Tage geschlossene 15m-Kerzen, Kontraktraster, laufendes Volumen und Geld-/Briefkurs im vorhandenen Worker.
4. Unterstützung, Widerstand, Schrittweite, Stop und Gesamtbudget auf der Karte prüfen. **Limit-Pläne** öffnen: Kaufpreis, Menge und Ziel nach Fill. Fehlen Spielraum oder Gebührenmarge, entstehen keine neuen Kaufpläne.
5. Eigene Entwurfswerte ändern und Status laden: Der Entwurf bleibt, der bestätigte Lauf verwendet weiterhin seine ursprünglichen Regeln. Reload zeigt die bestätigten Werte. KI-/Bot-Archiv exportiert das Original; ein Import aktiviert den Bot nicht.
6. Ohne Netz oder nach 30 Sekunden fordert die Karte zur erneuten Prüfung auf. Es entstehen keine neuen Pläne im Hintergrund. Pause und bestehende Gewinn-/Verlustsperren haben Vorrang.

Öffentliche Live-Probe am 09.10.2026 um 10:24 UTC: zehn öffentliche GET-Abfragen, 1344 geschlossene Kerzen auf sieben Seiten, aktuelles 15m-Volumen, BTC-USDT-Futures-Kontraktraster und Geld-/Briefkurs vollständig normalisiert. Cloud-Transport über vorhandenen Proxy mit aktiver TLS-Prüfung; bare Node-Fetch war direkt nicht erreichbar. Das ist keine reale Browser-/CORS-Abnahme.

Reale iPhone-/iPad-/Safari-/Provider-CORS-Abnahme und Aktualisierung einer privaten Oracle-VM bleiben getrennte Abnahmen.

## Dynamische Range

Eine Quelle: Bitget, USDT-FUTURES, ausgewählter Coin, USDT. Keine Spot-Ersatzkurse. 14 Tage × 96 Kerzen = **1344 vollständig geschlossene UTC-15m-Kerzen**, sieben öffentliche Historienseiten. Lücken oder zu kurze Listings sperren die Bewertung. Die 14 Tage wärmen Wilder-ATR14 und RSI14 auf; die aktuellen Bollinger-Bänder verwenden die letzten 20 Schlusskurse.

Mit `μ = Mittelwert(C₁…C₂₀)` und `σ² = Σ(Cᵢ−μ)²/20`:

```text
Bollinger: μ ± 2σ
Halbspanne h = max(2σ, 1,5 × ATR14)
Unterstützung L = μ − h
Widerstand U = μ + h
ER20 = |C₂₀−C₁| / Σ|Cᵢ−Cᵢ₋₁|
Seitwärtsfreigabe: ER20 ≤ 0,35; bei vollständig flacher Reihe ER20 = 0
```

Der ATR-Boden verhindert ein rechnerisch kollabiertes Grid bei kleinen Schlusskursbewegungen mit größeren Dochten. ER blockiert gerichtete Trends. Diese Regeln sind adaptiv und regelbasiert; sie sind kein trainiertes KI-Modell und keine belegte Erfolgswahrscheinlichkeit. Die aktive alte Grenze wird vor einer Neuberechnung auf Ausbruch geprüft. Eine Neuzentrierung erfolgt nur ohne eigenen Bestand und offene Orders, frühestens bei einer neuen geschlossenen 15m-Kerze.

## Gebühren, Kapital und Mengen

Eine Runde muss beide Gebühren, Kostenreserve und gewünschte Nettospanne decken. Konservativ gilt je Seite der höhere Maker-/Taker-Wert. Mit Gebühren `fₑ`, `fₓ`, Reserve `b` und gewünschter Nettospanne `n`, jeweils als Anteil:

```text
Mindestverhältnis k = (1 + fₑ + b + n) / (1 − fₓ) − 1
Schritt Δ = auf Tick aufrunden(max((U−L)/(Linien−1), U×k, Tick))
Netto je Einheit = Verkauf×(1−fₓ) − Kauf×(1+fₑ) − Kauf×b
Netto ≥ Kauf×n
```

Startmodell: Maker/Taker je **0,1 %**, Slippage-/Fundingreserve zusammen **0,1 %**, gewünschtes Netto **0,1 %**. Daraus folgt mindestens **0,400400… %** Abstand; bei Kauf 100 und Verkauf 100,41 bleiben im Szenario 0,10959 USDT je Einheit. Spread, Tickrundung und Range werden zusätzlich geprüft. Diese Werte sind keine belegten persönlichen Börsentarife; Funding hängt außerdem von Haltedauer und Abrechnung ab.

Kaufpläne liegen unter Geldkurs, Verkaufspläne über Briefkurs. Preise werden auf das Kontraktraster gerundet, Mengen exakt abgerundet und jedes Paar danach erneut netto geprüft. Zu viele gewünschte Linien werden reduziert. Zu kleine Budgets werden nicht erhöht.

```text
Nominalbudget = min(Grid-Margin × Hebel, eigene maximale Exposition)
Verfügbar = Nominalbudget − eigener Long-Wert − reservierte Kaufwerte
Risikobudget = feste Laufbasis × eigener Risikoanteil
Verfügbares Risiko = Risikobudget − eigenes Stoprisiko − reserviertes Kaufrisiko
```

Das Stoprisiko berücksichtigt Ein-/Ausstiegsgebühren und Reserve. Hebel vervielfacht kein Verlustbudget. Verkäufe bleiben unter eigener unreservierter Long-Menge; niemals neue Shorts. Ein Stop ist ein Modellpreis, keine garantierte Verlustbegrenzung bei Kurslücken oder fehlender Ausführung. Liquidationspreis und tatsächliches Cross-Risiko benötigen den späteren belegten Konto-/Positionsadapter.

## Ausbruchschutz

- **Unter L:** sofort keine neuen Käufe, Grid pausiert. Ein Volumenspike ≥ 2,5× bestätigt den Dump. Voreinstellung **Pause** erhält bestehende Schutzmaßnahmen. Wahl **Schließen** erzeugt ausschließlich eine reduzierende Absicht für belegten eigenen Long-Bestand, auch wenn der Spike erst nach der ersten Pause bestätigt wird.
- **Über U, RSI14 > 70 und Volumenspike:** keine Nachkäufe, Grid-Take-Profits pausieren, Trendbegleitung. Trailingstop `max(alter Stop, höchster Kurs − 1,5×ATR14)` wird ausschließlich enger.
- **Stop erreicht:** verriegelter Schließplan. Reservierte TP-Mengen müssen vor einem neuen Schließauftrag kontrolliert storniert und Bestand erneut belegt werden. Bestandskonflikt verhindert neue Kauf- und Schließaufträge.
- **Preis kehrt zurück oder Reload:** Dump-/Stop-Verriegelung bleibt. Ein bewusst neuer Lauf verlangt den vorhandenen Nullbestands-/Orderabgleich; keine automatische Entsperrung.

Laufendes 15m-Volumen wird gegen den zeitanteiligen Median der letzten 20 geschlossenen Kerzen verglichen, mindestens mit einer Minutenbasis. Ist keine aktuelle Kerze vorhanden, wird ausdrücklich die letzte geschlossene Kerze als Volumenbasis genannt. Ungültige oder veraltete Daten geben kein neues Grid frei. Momentaufnahmen ersetzen keine kontinuierliche Ausbruchüberwachung.

## Einstellbare und automatische Parameter

| Nutzer im Dashboard | Regelkern automatisch |
|---|---|
| Coin, feste Laufbasis, Risiko %, nominale Exposition, Hebel | Öffentliche 14-Tage-Historie, Quellen-/Zeit-/Lückenprüfung |
| Grid-Kapital als maximale Margin | BB20/2σ, Wilder-ATR14/RSI14, ER20 |
| Gewünschte 3–30 Linien, Start 8 | Range, gerundete Schrittweite, gebührenbedingte Linienreduktion |
| Maker-/Taker-Gebühren, minimale Nettospanne | Exakte Mengen nach Kapital und Stoprisiko, Mindestwerte |
| Slippage-/Fundingreserve | Dump-/Pumpstatus, alte Range zuerst, Stop nur enger |
| Dump-Aktion Pause oder Schließplan | Stabile Absichten, kein Verkauf ohne eigenen Long-Beleg |
| Bestehende Gewinn-/Verlustgrenzen | Vorrang bestehender Sperren und Bestandsprüfung |

Technische Startwerte stehen gemeinsam in `GRID_POLICY`/`GRID_DEFAULTS` oben im Modul. Änderungen an Modellregeln erfordern eine neue Modellversion; gespeicherte Originale werden nicht still umgerechnet.

## Architektur und Schnittstelle

`shared/adaptive-grid.mjs` enthält `AdaptiveAIGridStrategy` mit den drei gewünschten Methoden. `shared/adaptive-grid-feed.mjs` nutzt den bestehenden öffentlichen Bitget-Transport im vorhandenen `confluence-worker`; es entsteht kein zusätzlicher Worker oder permanenter Kursfeed. Bot-Runtime speichert bestätigte Konfiguration, Originalrange, Zustand und Absichten mit Command-ID/Revision atomar. Kein automatischer Start, keine Zugangsdaten.

Python-Pseudocode derselben Schnittstelle; die produktive Implementierung bleibt im bestehenden JavaScript-/Node-Stack und verwendet dessen exakte Geldrechnung:

```python
class AdaptiveAIGridStrategy:
    def calculate_dynamic_range(self, scope, candles, as_of):
        require_closed_contiguous_1344_utc_candles(scope, candles, as_of)
        return bb_atr_rsi_efficiency_and_volume(candles)

    def monitor_market_and_breakout(self, candidate, quote, inventory, guard):
        require_fresh_same_market_quote_and_owned_long(inventory, quote)
        apply_existing_limits_and_inventory_veto_first(guard)
        check_old_active_range_before_recentring(candidate, quote)
        return persist_dump_pause_or_trend_with_tightening_stop()

    def place_grid_orders(self, **inputs):
        status = self.monitor_market_and_breakout(**inputs)
        if status.blocks_entries:
            return protection_and_reducing_intents_only(status)
        levels = fee_aware_tick_grid(inputs)
        return exact_budgeted_buy_and_owned_reduce_only_sell_intents(levels)

# Späterer Oracle-Executor, nicht Bestandteil der aktuellen Ausführung:
# 1. Öffentliche Bewertung serverseitig neu prüfen, private Bestände/Fills belegen.
# 2. Revision/Run-Owner prüfen, Absichten dauerhaft serialisieren.
# 3. Eigene Orders mit kryptografisch abgeleiteter clientOid abgleichen.
# 4. Erst bestätigte Fills als Bestand buchen, dann reduce-only Ziele setzen.
# 5. Bei Dump/Stop kontrolliert eigene Nachkäufe/TPs stornieren und neu abgleichen.
#    Fremdorders und bestehende Schutzorders erhalten; Restmenge erst danach schließen.
```

`place_grid_orders()` liefert in dieser Version ausschließlich `planned`-Absichten. `accepted` wäre später nur eine Orderannahme, kein Fill. `partiallyFilled`, `filled`, `cancelled`, Gebühren und Funding brauchen echte Nachweise. Strategietests und Kostenpläne belegen keine Profitabilität; dafür sind anschließend realistische Fill-/Funding-Backtests und Vorwärtstests nötig.
