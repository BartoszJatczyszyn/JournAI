from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Any, Optional


class AnalysisResponse(BaseModel):
    """Generic analysis response wrapper.

    Flexible model allowing additional analytics-specific fields via extra=allow.
    This lets us standardize core envelope fields without over-constraining
    rapidly evolving analytics payloads.
    """

    status: str
    analysis_type: str
    period_days: Optional[int] = None
    timestamp: datetime
    model_config = ConfigDict(extra="allow")

__all__ = ["AnalysisResponse"]
