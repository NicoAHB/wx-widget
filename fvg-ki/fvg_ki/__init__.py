"""FVG-Chart mit lokaler, kostenloser KI (Pandas, Plotly/Dash, scikit-learn, SQLite) – aufgebaut nach Model-View-Controller."""
from .model.detection import detect_fvgs, normalize_ohlcv
from .model.features import FEATURES, extract_features, label_outcomes
from .model.learner import FVGQualityModel, retrain_model
from .model.store import FVGStore

__all__ = ["detect_fvgs", "normalize_ohlcv", "FEATURES", "extract_features", "label_outcomes", "FVGQualityModel", "retrain_model", "FVGStore"]
__version__ = "1.0.0"
