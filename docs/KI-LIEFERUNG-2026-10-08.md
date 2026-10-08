# KI-Korrekturen 3.52.0 – veröffentlichter Stand

App/SW **3.52.0**, Dienst-Quellstand **2.9.0**. [PR #81](https://github.com/NicoAHB/wx-widget/pull/81) per Merge-Commit `51662d6d44ebfe816f0ae8951300a3e332f38f06` übernommen. [GitHub-Pages-Lauf](https://github.com/NicoAHB/wx-widget/actions/runs/37809520403) erfolgreich. Audit-PR #80 durch dieselbe Veröffentlichung enthalten.

[Öffentliche App](https://nicoahb.github.io/wx-widget/): kanonische HTTPS-Dateien geprüft. HTML und Service Worker bytegleich, Build-Identifier an die Lieferliste gebunden, alle **43 PWA-Dateien** einschließlich Worker und vollständigem Importgraph byte-/hashgleich. Maschinenlesbarer Nachweis neben dieser Datei.

Alle 120 Testziele seriell, nach dokumentierter Nachprüfung **3778/3778** zählbare Prüfungen sowie Status/Rauch/Sicht grün. Lint 0 Fehler (3/2 bekannte Warnungen). Umfang und eng begrenzter CSS-Nachfix in [KI-Testnachweis](KI-TESTNACHWEIS-2026-10-08.md), Bedienung in [KI-Korrekturen](KI-KORREKTUREN-2026-10-08.md).

Vollständiges PWA-Paket im Arbeitsbereich: `scalpdesk-3.52.0-pwa.zip`, SHA256 `39f63887feab7633398630b3188013ae6ef883b36cae5136f08553df11e56f5f`. HTML und benötigte Dateien gemeinsam über HTTPS bereitstellen.

Die private Oracle-VM wurde nicht aktualisiert. Reale Safari/iPhone/iPad/CORS-/VM-Abnahmen bleiben offen. Für neue cf-2-Dienstkonfiguration ist Dienstquelle 2.9.0 erforderlich; alte cf-1-Originale bleiben dokumentiert.

Nächster getrennter Auftrag: PDF Etappe 1, Orderflow-Kerzenpanel mit Binance-Futures-Daten; vollständige HTML/PWA liefern, iPad-Rückmeldung vor Etappe 2 abwarten.
