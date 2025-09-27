"""Top-level API loader that re-exports the Flask `app` from the scripts
package so tools that import `backend_api_enhanced` (no package prefix) will
load the edited implementation in `scripts/backend_api_enhanced.py`.
"""
from scripts.backend_api_enhanced import app  # re-export for top-level import

__all__ = ["app"]
