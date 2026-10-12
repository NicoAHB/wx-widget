# Direkte Mustererklärung 3.64.1 – online und geprüft

**App öffnen:** https://nicoahb.github.io/wx-widget/weather-widget-v2.html

1. App aktualisieren/neu öffnen und **3.64.1** prüfen.
2. Eine Chartmuster-Kachel **kurz antippen**: Zeichnung an/aus, wie bisher.
3. Dieselbe Kachel **etwa eine halbe Sekunde gedrückt halten**: Erklärung öffnet sich; Loslassen schaltet keine Zeichnung. Alternativ **ⓘ** sofort antippen. Mit **×** schließen.
4. Seitlich wischen scrollt weiterhin die Liste. Im vergrößerten Chart zuerst **Werkzeuge** öffnen. Ungültige Kacheln sind gesperrt, ihr aktiver Infoknopf bleibt lesbar und öffnet weiterhin die Erklärung.

## Veröffentlichung

- [PR #105](https://github.com/NicoAHB/wx-widget/pull/105), Merge-Commit `1c881cf28ce12047a11b2eb1df624837926a60da`, am **12.10.2026** veröffentlicht.
- [Pages-Lauf 38194306409](https://github.com/NicoAHB/wx-widget/actions/runs/38194306409) erfolgreich. Öffentliche kanonische HTTPS-App, Service Worker, Lieferliste und alle **71 PWA-Dateien** einschließlich Worker byte-/hashgleich geprüft.
- Alle **145 Produktdateien** nach Merge identisch mit dem finalen Prüfstand `0ef956d`. Vollständiger 162-Ziele-Lauf und relevante Nachläufe: **5171/5171**, Status/Rauch/Sicht grün, Lint **0 Fehler**, drei bekannte Warnungen.
- [Öffentliche Dateihashes](CHARTMUSTER-DIREKTINFO-LIEFERUNG.json), [Testnachweis](CHARTMUSTER-DIREKTINFO-TESTNACHWEIS.md) und [vollständige Erst-/Vorher-/Nachher-Ergebnisse](CHARTMUSTER-DIREKTINFO-TESTNACHWEIS.json).

App und Service Worker sind gemeinsam **3.64.1**, Oracle-Dienst unverändert **2.12.0**. Für diese UI-Erweiterung ist kein Oracle-Update nötig. Keine Erkennungs-, Alarm- oder Handelsregel geändert.

## Code und Grenzen

Das vollständige Paket `ScalpDesk-3.64.1-PWA.zip` enthält HTML, Service Worker, alle benötigten Module, Worker, Bilder und Anleitungen. Für eine eigene Bereitstellung den gesamten Inhalt über HTTPS oder einen lokalen HTTP-Server ausliefern; auf iPhone/iPad den Online-Link verwenden. Hinweise in `LIES-MICH.txt` im Paket.

[Bedienungsanleitung](CHARTMUSTER-DIREKTINFO.md). **Offen bleibt der praktische Test auf echten iPhone-/iPad-/Safari-Geräten**; automatische Touchprüfungen verwenden Chromium. Private Oracle-VM und reale Zugangsdaten wurden nicht geändert; keine echten Orders oder Telegram-Nachrichten durch die Abnahme gesendet.
