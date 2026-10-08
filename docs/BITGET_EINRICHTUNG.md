# Bitget-Einrichtung – Voraussetzungen für einen späteren privaten Bot

**Stand:** öffentliche USDT-Futures-Daten für Konfluenz/PO3 und G12-Laufsimulation lokal/Oracle. Demo/Echtgeld gesperrt, privater Orderexecutor fehlt. Diese Anleitung schaltet keinen Handel frei.

Vor Implementierung klären:

- Kontotyp **Classic oder UTA**, API-fähiges eigenes Unterkonto;
- USDT-Futures, Cross/isoliert, **Einweg oder Hedge**, Mengen-/Leg-Konvention;
- selbst gewählter Einsatz/Risiko, Exposition/Positionen, Hebel, Strategie/Coins/Schließwirkung;
- Echtgeld nur mit Verlustlimit und vorherigem tatsächlichem Börsendemo-Nachweis; separater Demo-Zugang und aktuell belegter Demo-Modus.

Aktuelle Kontotyp-/Demo-/API-Version beim Hersteller prüfen: [Bitget API](https://www.bitget.com/api-doc/common/intro). Öffentliche V2-Marktdaten beweisen keine passende private UTA-/Demo-API. Herstellerseiten waren hier nicht zuverlässig abrufbar; private Endpunkte werden nicht geraten.

Key/Secret/Passphrase ausschließlich auf dem eigenen Oracle-Dienst außerhalb Programm/Git/Lieferpaket und nur für den Dienst lesbar speichern. IP-Bindung auf die VM-Adresse, nur erforderliche Lese-/Handelsrechte, **keine Auszahlung und kein Transfer**. Kein Loginpasswort in Scalp Desk und keine Schlüssel im Chat. App/iPad steuern später bestätigte Servercommands; Oracle wäre einziger Executor.

Der zukünftige Adapter braucht persistierte Orderabsicht, Client-ID, Status-/Fillabgleich vor Retry, exakte Tick-/Mengenraster, Reduce-only/Positionsmodus, Teilfills und Schutzorders. Bestandsveto vor Versand unter derselben Sperre: erwartete eigene Menge gegen gesamten Bestand, keine Ausgleichsorders bei Konflikt. Neustart, verlorene Antwort, Fremdfill trotz gleicher Menge, Schutzorderfehler und dauerhafter Grenzstopp zuerst in tatsächlicher Börsendemo prüfen. Simulation ersetzt diese Abnahme nicht.
