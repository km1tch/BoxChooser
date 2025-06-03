from typing import Any, Dict, List
from pydantic import BaseModel


class PackingRulesUpdateRequest(BaseModel):
    rules: List[Dict[str, Any]]


class EngineConfigUpdateRequest(BaseModel):
    weights: Dict[str, float]
    strategy_preferences: Dict[str, int]
    practically_tight_threshold: float
    max_recommendations: int
    extreme_cut_threshold: float