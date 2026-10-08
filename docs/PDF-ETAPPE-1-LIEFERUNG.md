# PDF-Etappe 1 – veröffentlichte Version 3.53.0

App/SW **3.53.0**, Dienstquelle unverändert **2.9.0**. [PR #83](https://github.com/NicoAHB/wx-widget/pull/83) per Merge-Commit `f3b34ef6d67b0c10db822bb4fdbcae1522b7b78c` übernommen. [GitHub-Pages-Lauf](https://github.com/NicoAHB/wx-widget/actions/runs/37848829604) erfolgreich für genau diesen Commit.

[Öffentliche App](https://nicoahb.github.io/wx-widget/weather-widget-v2.html): kanonische HTTPS-Dateien geprüft. HTML und Service Worker bytegleich mit dem geprüften Produkt, Build-Identifier an die Lieferliste gebunden, alle **45 PWA-Dateien** einschließlich Worker und vollständigem Importgraph byte-/hashgleich. Maschinenlesbarer Nachweis neben dieser Datei.

Alle **123 Testziele** seriell auf eingefrorenem Produktstand; nach vollständigem unverändertem m6-Nachlauf **3909/3909 zählbare Prüfungen** grün, Rauch-/Sichtprüfungen ohne Fehler. Im abschließenden Gesamtlauf hatte m6 einmal eine 57-ms-Aufgabe über der unveränderten 50-ms-Grenze; vollständiger Nachlauf 58/58. Lint 0 Fehler (3/2 bestehende Warnungen). Erstbefunde/Nachläufe vollständig erhalten: [Testnachweis](PDF-ETAPPE-1-TESTNACHWEIS.md).

Vollständige HTML-Datei: `weather-widget-v2.html`. Komplettes öffentliches PWA-Paket im Arbeitsbereich: `scalpdesk-3.53.0-pwa.zip`, **87 Dateien**, SHA256 `f47f16ca6e8e9a7b65b6c30c3907179726be665deccd44000f0e6fb8beb1f7d4`. HTML und benötigte Module gemeinsam über HTTPS bereitstellen; die HTML-Datei allein ist kein lokales Offline-Paket.

Umgesetzt sind ausschließlich das Taker-Kerzenpanel (1m/1h), Kauf-/Verkaufsvolumen/Delta, gespeicherte Einheit USDT/Coins, Info, Datenqualität und responsive Anordnung. Einstellungen in dieser Etappe: **nur Anzeigeeinheit**. Bedienung und fünf kurze iPad-Prüfschritte: [Etappe-1-Anleitung](PDF-ETAPPE-1.md).

Die private Oracle-VM wurde nicht aktualisiert. Reale iPad-/Safari-/CORS-Abnahme ist offen. Gemäß PDF **iPad-Rückmeldung vor Etappe 2 abwarten**; Etappen 2–7 sind nicht umgesetzt. Die vorherigen KI-Verbesserungen wurden bereits getrennt mit 3.52.0 veröffentlicht.
