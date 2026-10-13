"""Module 2 und 3 (View) – Dash-Oberfläche: Knopf „FVG ein/aus“, Info-Knopf „?“ mit Erklärfenster, Neulernen."""
from __future__ import annotations

from dash import dcc, html

INFO_TITLE = "Was ist ein Fair Value Gap (FVG)?"
INFO_TEXT = """
Ein **Fair Value Gap** ist eine Preislücke aus **drei Kerzen**: Die mittlere Kerze bewegt den Kurs so schnell, dass sich
die Schatten von **Kerze 1 und Kerze 3 nicht überlappen**. In diesem Bereich wurde nur in eine Richtung gehandelt – ein
**Marktungleichgewicht** (mehr Käufer als Verkäufer oder umgekehrt).

* **Bullisch (grün):** Tief von Kerze 3 liegt über dem Hoch von Kerze 1, die mittlere Kerze ist grün.
* **Bärisch (rot):** Hoch von Kerze 3 liegt unter dem Tief von Kerze 1, die mittlere Kerze ist rot.

Läuft der Kurs später in die Lücke zurück, reagiert er dort oft – er „füllt“ das Ungleichgewicht und prallt ab.
Schließt eine spätere Kerze die Lücke mit ihrem Schatten **komplett**, gilt das FVG als **mitigiert** und die Box endet dort.

**KI-Qualität:** Ein lokales Modell (scikit-learn, kostenlos, ohne Cloud) schätzt aus Größe (÷ ATR), Volumen der
Ausbruchskerze und Trend (EMA 50/200), wie oft solche Lücken in deinen Daten zum Abprall geführt haben. Es lernt mit
jedem entschiedenen FVG dazu. Eine Schätzung, keine Garantie.
"""


def build_layout(figure, status: str = "") -> html.Div:
    """Gesamte Seite. Der Info-Knopf steht direkt neben „FVG ein/aus“; Hover zeigt eine Kurzfassung (title)."""
    return html.Div(className="fvg-app", children=[
        html.Header(className="fvg-head", children=[html.H1("FVG-Chart · lokale KI"), html.Span(id="fvg-status", className="fvg-status", children=status)]),
        html.Div(className="fvg-controls", role="toolbar", **{"aria-label": "FVG-Steuerung"}, children=[
            html.Button("FVG: an", id="fvg-toggle", n_clicks=0, className="fvg-btn on", title="FVG-Boxen ein- oder ausblenden",
                        **{"aria-pressed": "true"}),
            html.Button("?", id="fvg-info-btn", n_clicks=0, className="fvg-btn fvg-info",
                        title="Was ist ein FVG? Lücke zwischen Kerze 1 und Kerze 3 – Marktungleichgewicht (Klick für mehr)",
                        **{"aria-label": INFO_TITLE, "aria-haspopup": "dialog", "aria-controls": "fvg-info-modal"}),
            html.Button("KI neu lernen", id="fvg-retrain", n_clicks=0, className="fvg-btn", title="Modell lokal mit allen gespeicherten FVGs neu trainieren"),
        ]),
        dcc.Loading(dcc.Graph(id="fvg-chart", figure=figure, config={"displaylogo": False, "scrollZoom": True, "responsive": True}), type="dot"),
        dcc.Store(id="fvg-visible", data=True),
        html.Div(id="fvg-info-modal", className="fvg-modal", role="dialog", hidden=True, **{"aria-modal": "true", "aria-labelledby": "fvg-info-title"}, children=[
            html.Div(className="fvg-modal-box", children=[
                html.H2(INFO_TITLE, id="fvg-info-title"),
                dcc.Markdown(INFO_TEXT, className="fvg-modal-text"),
                html.Button("Schließen", id="fvg-info-close", n_clicks=0, className="fvg-btn"),
            ]),
        ]),
    ])
