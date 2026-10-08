# G12 – optionale Bot-Laufsimulation (3.49.0 / Dienstquelle 2.7.0)

Der Reiter **Trading-Bot** prüft selbst eingegebene Modellwerte und Laufgrenzen. Er erzeugt weder automatische Strategie-Fills noch Börsenorders. Bot und automatische Trades starten AUS; Aktivierung und bewusster Laufstart sind getrennt. Demo und Echtgeld bleiben gesperrt. Eine reine Grenzfreigabe ist keine Orderfreigabe.

## Bedienung

1. Lokale oder Oracle-Simulation wählen. Oracle benötigt den eingerichteten HTTPS-Dienst und dessen Zugangsschlüssel, keine Bitget-Zugangsdaten im Browser.
2. Eigene Laufbasis, Exposition und Risikoprozent angeben. Strategie, Coin, Richtung, Score, Hebel, Positionsanzahl, Cooldown und Stop-/TP-Profil sind Vorbereitung, kein angeschlossener Strategieexecutor. Geldbeträge bleiben ohne Vorgaben leer.
3. Gewinn-/Verlustgrenze ausdrücklich einschalten und Betrag/Einheit/Wirkung wählen. USDT direkt, Prozent mit fester Laufbasis, EUR mit beim Start festgehaltenem Referenzkurs.
4. Aktivieren und separat einen neuen **Simulationslauf** starten. Der leere Modelllauf beginnt mit sechs als Simulation bezeichneten Nullwerten; die Laufbasis behauptet keinen echten Kontostand.
5. Unter „Modellwerte eingeben“ alle sechs Werte setzen: Netto = realisiert + offen − Gebühren + Rabatte − vorzeichenbehaftetes Funding − geschätzte Schließgebühren, abzüglich Startwert. Funding bezahlt positiv, empfangen negativ. PO3-Ergebnisse vor Funding sind kein vollständiges Netto.

Gleichheit zählt als Grenzberührung. Gewinn-/Verlustwirkung sind unabhängig: neue Einstiege sperren oder die Schließwirkung ausdrücklich simulieren. Die Modellschließung bucht offenes Ergebnis und Schließgebühr genau einmal. Kursrücklauf, Reload oder Neustart lösen Stopps nicht. Einzahlungen und neue FX-Werte verschieben keine Laufbasis. Ein Limit garantiert keine exakte spätere Endsumme.

## Bestandsveto und Speicherung

Der gemeinsame Kern rechnet Geld/Mengen als Dezimalstrings mit BigInt-Brüchen, ohne Float-Toleranz. Er vergleicht bestätigte eigene Fills mit **gesamtem** Bestand, nicht verfügbarem Volumen; Markt/Konto/Produkt/Modus/Leg/Einheit gehören dazu. Unvollständige/widersprüchliche Daten sperren sofort neue Orders und neu veranlasste Schließungen. Zehn Sekunden ohne belegten Abgleich verriegeln `PAUSED_RECONCILIATION_REQUIRED`, auch ohne UI-Snapshot. Schutzwirkung bleibt erhalten; eine bereits liegende Börsenorder könnte weiterhin auslösen.

Globaler Hinweis und Bot-Reiter zeigen den Konflikt. Ein belegter eigener Teilfill darf die vorläufige Prüfung beenden, aber keine berührte Grenze lösen. Nach verriegelter Störung braucht ein neuer **Modelllauf** bewusste Prüfung von Modellbestand, Historie und Schutzwirkung. Das schaltet keinen privaten Bot frei.

Lokal: native IndexedDB `scalpdesk-bot-simulation`, atomare Revision vor Bestätigung. Oracle: `bot-simulation.json`, maximal 5 MiB, atomar/0600; beschädigte Datei bleibt erhalten und stoppt nur die Simulation. Commands besitzen ID/Inhalt/erwartete Revision. Verlorene Antworten zuerst per ID abgleichen; kein zweiter Start durch blindes Retry. Grenzen: 500 Aufträge/Protokolle, 100 alte Läufe, kein stilles Abschneiden. Vollständiger JSON-Export sichert die Simulation separat. Telegram-Schalter verändern kein Bot-Trading.

## Fehlender produktiver Teil

**Kein privater Bitget-Orderexecutor, keine realen Orders, keine produktive Fill-Ledger-Anbindung, keine belegte Cross-Liquidationsprüfung.** Classic/UTA, Einweg/Hedge, eigenes Unterkonto, Einsatz und Schließwirkung vor privater Einrichtung klären. Passende aktuelle API-Version und eigener Demo-Zugang müssen beim Hersteller verifiziert werden. Anleitung: [BITGET_EINRICHTUNG.md](BITGET_EINRICHTUNG.md). Echte iOS-/Safari-/VM-Abnahme bleibt offen.

## Nachweis

`unit-bot-limits.js` 37/37, `unit-bot-simulation.js` 16/16, `m68.js` 23/23: tatsächliche App/IDB und HTTP-Dienst, verlorene Startantwort, Reload, globaler Zehn-Sekunden-Status, 320/390/768/1440 Pixel. Keine echten Nachrichten oder Börsenzugriffe. Gesamtprüfung/Updateprüfung in G13.
