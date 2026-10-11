# Chart-Erweiterung 3.64.0 – online und geprüft

**Online:** https://nicoahb.github.io/wx-widget/weather-widget-v2.html

App und Service Worker sind **3.64.0**, der Oracle-Dienst bleibt **2.12.0**. Für diese Chart-Erweiterung ist kein Oracle-Update nötig.

## Veröffentlichung und Nachweis

- [PR #103](https://github.com/NicoAHB/wx-widget/pull/103) am 11.10.2026 UTC (12.10.2026 in Berlin) per Merge-Commit `3a4dab9b242501aa093cd45b374361fcf234d72d` übernommen.
- [GitHub-Pages-Lauf 38185718306](https://github.com/NicoAHB/wx-widget/actions/runs/38185718306) erfolgreich. Öffentliche kanonische HTTPS-App, Service Worker, Lieferliste und alle **71 PWA-Dateien** einschließlich Worker byte-/hashgleich mit dem geprüften Stand.
- Alle **145 Produktdateien** nach dem Merge hashgleich mit dem finalen Prüfstand `f9ccffb`. Gesamtlauf und vollständige relevante Nachläufe: **5133/5133** über 161 Ziele; Status/Rauch/Sicht grün und Lint **0 Fehler**, drei bestehende Warnungen.
- Vollständiger öffentlicher [Liefernachweis](CHART-DETAIL-LIEFERUNG.json); [Testnachweis](CHART-DETAIL-TESTNACHWEIS.md) und [Prüfrückgaben/Hashes](CHART-DETAIL-TESTNACHWEIS.json) enthalten auch die Erstbefunde und Grenzen.

## Neu und kurz testen

1. App neu öffnen/aktualisieren und **3.64.0** prüfen. Bei einer vorhandenen PWA gegebenenfalls die angebotene Aktualisierung ausführen und danach wieder öffnen.
2. BTC mit **1h** öffnen; neben der Intervall-Leiste unter **Kerzen-Auflösung** etwa **5m** auswählen. Nach links/rechts wischen, Zoom bedienen und wieder **Aus · normale Kerzen** wählen.
3. Die **Muster-Leiste** steht neben **Alarm für diesen Kurs**, auf schmalen Displays darunter. Ein Muster antippen zeichnet es, erneutes Antippen entfernt es. Mehrere Muster sind möglich; die BTC-Pfeile bleiben erreichbar. Keine Muster: dezenter Leerhinweis.
4. Coin und Haupt-Zeitrahmen wechseln; Kurs, Kerzen und Muster müssen zum gewählten Kontext gehören. Den Chart hochkant/quer vergrößern: **Werkzeuge** öffnet auch die Leiste, geschlossen gehört die Fläche dem Chart. Alarme, Trend-Chips, KI-Infos und Support/Widerstand weiter prüfen.

[Bedienung und Datenvertrag](CHART-DETAIL-MUSTER.md) erklären die erlaubten Auflösungen, Paging/Cache und die weiterhin unveränderten Hauptanalysen. Optionales Antippen einer Hauptkerze zum Zeitraumzoom ist nicht implementiert; das bestehende Fadenkreuz bleibt erhalten.

**Noch offen:** reale iPhone-/iPad-/Safari-Abnahme. Automatische Touch-/Viewportprüfungen verwenden Chromium. Die private Oracle-VM wurde nicht geändert; keine echten Orders oder Telegram-Nachrichten durch diese Abnahme gesendet.

## Vollständiger Code

`ScalpDesk-3.64.0-PWA.zip` enthält die vollständige `weather-widget-v2.html`, Service Worker, alle erforderlichen ES-Module, Worker und Bilder sowie Bedienungs-/Testnachweise. Die bestehende Modularchitektur benötigt diese Abhängigkeiten; die HTML allein über `file://` zu öffnen ist keine vollständige PWA-Bereitstellung. Auf iPhone/iPad den Online-Link nutzen, eigene Bereitstellung über HTTPS oder einen lokalen HTTP-Server. Details stehen in `LIES-MICH.txt` im Paket.
