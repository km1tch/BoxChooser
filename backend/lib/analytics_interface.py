"""Analytics interface for CE/SaaS abstraction"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional


class AnalyticsInterface(ABC):
    """Abstract base class for analytics implementations"""
    
    @abstractmethod
    def log_box_import(self, store_id: str, dimensions: List[float], 
                      alternate_depths: Optional[List[float]], chosen_name: str, source: str) -> None:
        """Log successful imports: library vs custom"""
        pass
    
    @abstractmethod
    def log_name_selection(self, store_id: str, dimensions: List[float],
                          offered_names: List[str], chosen_name: str) -> None:
        """Track which names are most popular"""
        pass
    
    @abstractmethod
    def log_box_modification(self, store_id: str, original_dimensions: List[float],
                            original_alternate_depths: Optional[List[float]],
                            modified_dimensions: List[float],
                            modified_alternate_depths: Optional[List[float]],
                            modification_type: str) -> None:
        """Log when a user modifies box specifications"""
        pass
    
    @abstractmethod
    def log_discovery_session(self, store_id: str, total_found: int, exact_matches: int,
                            unmatched: int, already_in_store: int) -> None:
        """Log box discovery session from price import"""
        pass
    
    @abstractmethod
    def get_import_stats(self, days: int = 7) -> Dict:
        """Get box import statistics for the past N days"""
        pass
    
    @abstractmethod
    def get_name_stats(self, days: int = 7) -> Dict:
        """Get name selection statistics"""
        pass
    
    @abstractmethod
    def get_discovery_stats(self, days: int = 30) -> Dict:
        """Get box discovery usage statistics"""
        pass