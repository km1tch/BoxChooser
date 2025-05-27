from typing import Dict
from pydantic import BaseModel


class PriceUpdateRequest(BaseModel):
    changes: Dict[str, Dict[str, float]]
    csrf_token: str


class ItemizedPriceUpdateRequest(BaseModel):
    changes: Dict[str, Dict[str, float]]
    csrf_token: str


class Comment(BaseModel):
    text: str