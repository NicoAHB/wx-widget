# G10(d) – Originaleingaben und historische Auflösung

Arbeitsstand 3.46.0. Der Nutzer hat das Originalmodell ausdrücklich beibehalten.

Bitgets öffentliche `history-fund-rate` liefert nur abgerechnete Rate und Termin. Die damals angekündigte Rate samt damaligem Intervall fehlt. Sie wird weder durch die nächste Abrechnung noch durch den heutigen Takt ersetzt. Frühere vollständige Konfluenzentscheidungen sind deshalb nicht rekonstruierbar; die App zeigt „nicht bewertbar“.

Ab jetzt speichert der bestehende Analyseworker vollständige bewertbare Originaleingaben je Basiskerze, Quelle, Startanker und Parameterrevision. Der erste tatsächliche Entscheidungsstand bleibt erhalten, auch bei Wiederholung/mehreren Tabs. Das separate IndexedDB-Archiv umfasst maximal 5000 Beobachtungen / 12 MiB. Bei voller Grenze pausiert neues Protokollieren mit Hinweis; vorhandene Beobachtungen werden nicht entfernt.

„Historie und Backtest“ startet ausdrücklich einen Job im selben Worker und öffentlichen Bitget-Client. Liveabrufe pausieren währenddessen. Preis- und Markkerzen werden in höchstens zwei Seiten je Phase, Abrechnungen in höchstens zwei Seiten je Phase geladen. Zwischenstände bleiben getrennt gespeichert (4 Jobs / 20 MiB). Nach spätestens drei Minuten ist eine ausdrückliche Fortsetzung nötig. Pause/Unsichtbarkeit beendet den Worker. Ein wiederaufgenommener Lauf behält seinen Auswertungszeitpunkt; ein fertiger Lauf erhält beim nächsten Start einen neuen.

Der gemeinsame Kern bewertet ausschließlich damalige Originalindikatoren/Pivots/Higher-Timeframe-Daten und damaliges aktuelles Funding. Schwellen 60/70/80 werden getrennt simuliert; 60 verändert keine Live-Mindestgrenze. Historischer Entry: erster verfügbarer 1h-Kerzenbeginn nach tatsächlicher Entscheidung, ungünstige konfigurierte Slippage und konservative Tickrundung. Preislevels und Kostenfilter stammen aus dem Originalmodell. Kein rückwirkender Einstieg vor Kenntnis des Signals.

Ergebnisse werden erst nach vollständiger maximaler Haltedauer gezählt. Beide Barrieren in derselben Stunde ergeben konservativ SL; Stop-Gaps füllen zum schlechteren Open. Ausstiegsslippage ist ungünstig. Intrabar-Trefferzeit wird als Schluss der Trefferkerze modelliert; feinere reale Ausführung ist damit nicht belegt. Fehlende Preisabdeckung ist eine Datenlücke. Timeouts zählen mit tatsächlichem Ergebnis im Nenner.

Historische Abrechnungen dienen nur zur Kostenauflösung, niemals zur Scoreauswahl. Die Fundingperiode ist Einstieg inklusive, Ausstieg exklusiv. Markpreis ist das Open der genau am Abrechnungstermin beginnenden 1h-Markkerze. Fehlt dieser Zeitpunkt/Preis oder eine belegte Abrechnungsabdeckung, bleibt Netto unbekannt. Preisfälle werden deshalb nicht aus dem Quotennenner entfernt. Gebühren werden einmal je Seite verrechnet.

Beide Kartenfenster (90 und 730 Tage) beziehen sich auf dieselbe Strategie/Richtung und feste Parameter einschließlich Anker-/Fundingmodell. Die tatsächlich protokollierte Originalperiode steht daneben; eine lückenlose Zweijahreshistorie wird nicht behauptet. Prozent und Euro-Erwartung erst ab 30 auswertbaren Fällen; Euro benötigt zusätzlich selbst gewählten Einsatz und gültiges FX. Unter 40 % bei 2R erscheint „Historisch schwach“ als Nutzerregel.

Backtests zeigen Anzahl, Quote, durchschnittliches Brutto-R:R, Netto und Drawdown in R. Die R-Folge ist nach Einstieg und stabiler ID sortiert und kann überlappende hypothetische Signale enthalten. Sie ist kein finanziertes Portfolio. Ohne festgelegte Kapitalbindung gibt es keinen Euro-/Prozent-Drawdown und keine behauptete reale Rendite. Parameterauswahl und spätere Prüfung bleiben getrennt.

Ergebnisse werden klein und separat gespeichert (200 / 2 MiB), ohne die Originalkarte umzuschreiben. „Nur öffentliche Backtest-Zwischenstände löschen“ erhält Originalarchiv und Ergebnisse. Keine Kontoabfrage, Order oder privaten Schlüssel im Browser. Reale iOS-/Bitget-CORS-/Oracle-Abnahme bleibt separat.
