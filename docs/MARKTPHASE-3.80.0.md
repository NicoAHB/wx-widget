# Einheitliche Marktphase · 3.80.0

In der vorhandenen Coin-Signalkarte rechts neben dem Coin-Namen: ein runder Richtungspfeil und ein Info-Button. Aufwärts ↗ grün, Abwärts ↘ rot, Seitwärts → grau, fehlende Daten – grau. Der Pfeil wird als skalierbarer Vektor gezeichnet, damit er auch ohne passende Schrift-Glyphe eindeutig bleibt.

Die Erweiterung ist reine Information. Vier/fünf Signalregeln, Long-/Short-Zähler, „Abwarten“, Telegram, Chartfarben und Chartgeometrie werden dadurch nicht verändert.

## 1. Zentrale Berechnung

Dateien: `shared/market-phase-core.mjs`, `shared/market-phase-feed.mjs`, `shared/directional-movement.mjs`, `shared/indicators.mjs`; Anbindung in `weather-widget-v2.html`.

`getMarktphase(coin)` ist die einzige Quelle für Pfeil und Info-Werte. Konstante `PHASE_ZEITRAHMEN = '1h'`, sämtliche Startwerte oben in `MARKET_PHASE`. Alle Vorauswahl-Coins, derselbe Börsenmarkt wie deren Signalkarte, normale geschlossene OHLC-Kerzen. Keine Abhängigkeit von Chart-Zeitrahmen, Signalbewertungs-Zeitraum oder Heikin-Ashi.

Vorhandene EMA-/ATR-Bausteine und der gemeinsame Wilder-ADX werden verwendet. Die bestehende bestätigte Swing-Funktion unterstützt zusätzlich 3 Kerzen links/rechts; ihre bisherigen Aufrufer behalten unverändert den 2/2-Standard. Für die Marktphase werden diese festen bestätigten Swings statt eines vom Chart-ZigZag-Prozentwert abhängigen offenen Schenkels verwendet.

Vier Stimmen:

1. Zwei höhere Hochs **und** Tiefs → Aufwärts; beide tiefer → Abwärts, sonst Seitwärts.
2. EMA 20 > 50 > 200 und EMA 50 über 10 Kerzen mindestens +0,3 ATR → Aufwärts; umgekehrt Abwärts, sonst Seitwärts.
3. ADX 14 unter 20 → Seitwärts; sonst +DI/−DI bestimmt die Richtung.
4. Effizienz über 30 Kerzen: Betrag der Netto-Bewegung / Summe aller absoluten Bewegungen. Unter 0,25 → Seitwärts, sonst Netto-Richtung.

Mindestens 3/4 gleiche Stimmen ergeben den Kandidaten; sonst Seitwärts. Ein anderer Kandidat muss zwei geschlossene Stunden in Folge gelten. Die Info nennt auch eine noch ausstehende Bestätigung und die tatsächliche heutige Stimmenzahl der gehaltenen Phase.

Für exakt gleiche Live-/Neustart-/Historienwerte erhält jede Messung ein festes Fenster von 300 Kerzen. Die letzten 100 Kandidaten werden von einer neutralen Startphase aus schrittweise wiederholt. Dafür sind 399 geschlossene 1H-Kerzen nötig. Dieselben endlichen Fenster gelten im Phasen-Check, ohne Vorgriff auf spätere Kerzen.

Zwischenspeicher in der vorhandenen IndexedDB, Abfrage/Berechnung nur beim ersten Laden oder nach einem neuen Stunden-Schluss. Neue Versuche bei Fehlern sind zeitlich begrenzt; fremder Markt, Datenlücken und veraltete Daten ergeben keinen geratenen Pfeil. CPU-Arbeit läuft im Modul-Worker.

Test: BTC und mehrere Coins prüfen. Chart nacheinander auf 1m, 5m, 15m, 1h, 4h und 1d wechseln sowie HA umschalten: Pfeil, sämtliche Info-Zahlen und 1H-Schlusszeit bleiben identisch. Erst nach einer neuen geschlossenen Stunde dürfen sie sich ändern.

## 2. Pfeil in der Signalkarte

Dateien: `shared/market-phase-view.mjs`, `weather-widget-v2.html`.

Direkt beim Namen, genau eine sichtbare Pfeilrichtung. Screenreader nennt beispielsweise „Marktphase: Aufwärts“. Info-Touchziel 44 × 44 px, runde bestehende i-Gestaltung, keine Blink-Animation. Vektorpfeil mit Richtung zusätzlich zur Farbe. Keine Umordnung bestehender Signalkarten-Inhalte.

Test: Aufwärts-/Abwärts-/Seitwärts-Coin öffnen. Karte und Listenansicht sowie Handy-/Tablet-Hochformat prüfen. Ohne Daten muss die Marke neutral bleiben.

## 3. Info-Fenster

Datei: `shared/market-phase-view.mjs`, bestehende Info-Fenster-Positionierung der App.

„Marktphase (1H-Chart)“ zeigt Phase und Stimmen, bestätigte Hoch-/Tief-Paare, EMA-Werte und Steigungsschwelle, ADX/+DI/−DI, Effizienz und Netto-/Gesamtbewegung. Dazu feste 1H-Grundlage, Hysterese-Verzögerung, Informationscharakter und tatsächlichen Stunden-Schluss in deutscher Zeit.

Die Popup-Breite bleibt im Bildschirm, der verfügbare Platz oben/unten begrenzt die Höhe; lange Erklärungen scrollen innerhalb des Fensters.

Test: i am iPhone/iPad öffnen, alle vier Messwerte lesen und innen scrollen. Werte vor/nach Chart-Zeitrahmenwechsel vergleichen. Die vier eigentlichen Signalregeln behalten ihre Werte und Erklärungen.

## 4. Protokoll und Phasen-Check

Dateien: `shared/market-phase-check.mjs`, `shared/market-phase-worker.mjs`, `shared/market-phase-feed.mjs`, `shared/market-phase-view.mjs`.

Die initiale Phase und spätere erkannte Wechsel werden lokal mit Coin, Markt, Stunden-Schluss, Stimmen und vollständigen Zahlenwerten protokolliert. Neustart erzeugt keine identische zusätzliche Meldung.

**Coin-Signalkarte → i neben dem Pfeil → Phasen-Check → Phasen-Check starten** prüft sechs Kalendermonate aller aktuellen Vorauswahl-Coins. Bestehender Historienclient samt Cache/Abrufbegrenzung; nur 1H-Kerzen plus Vorlauf, keine kontinuierlichen Backtest-Abfragen. Abbrechen, Offline oder App-Hintergrund beendet den Test; ein vorheriger vollständiger Bericht bleibt gespeichert. Datenfehler werden pro Coin angezeigt.

Je Prüfzeitpunkt werden erst Phase und ATR aus damals bekannten Daten bestimmt. Anschließend vergleicht der Test den Schlusskurs 24 Stunden später: über +3 damalige ATR = Aufwärts, unter −3 ATR = Abwärts, dazwischen einschließlich exakter Grenzwerte = Seitwärts. Für die letzten 24 Stunden fehlt dieser bekannte Ausgang; sie werden ausgelassen.

Ergebnis pro Coin/Phase: Anzahl, Trefferquote und Basisrate. Die Basisrate ist der Anteil der jeweiligen tatsächlichen Entwicklung über **alle** prüfbaren Stunden dieses Coins. Eine Phase ohne Fälle hat keine erfundene Trefferquote. Ergebnisse und Protokoll bleiben lokal nach Neustart erhalten. Überlappende Stundenfenster sind abhängig; das ist kein Gewinn-/Verlust-Backtest und optimiert keine Schwelle.

Test: Phasen-Check starten/abbrechen, erneut vollständig starten, Bericht mit allen Vorauswahl-Coins und jeweils drei Phasen prüfen. Neustarten: Bericht/Protokoll und aktueller Pfeil bleiben erhalten; die aktive Signalkarte und Telegram dürfen unverändert bleiben.
