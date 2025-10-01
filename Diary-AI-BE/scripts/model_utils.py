"""Compatibility shim exposing analytics.model_utils at top-level.
Required because predictive_analytics uses `import model_utils` expecting a top-level module.
"""
from analytics.model_utils import *  # type: ignore  # noqa: F401,F403
