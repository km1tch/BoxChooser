"""No-op analytics implementation for Community Edition"""
from typing import Dict, List, Optional
from .analytics_interface import AnalyticsInterface


class NoOpAnalytics(AnalyticsInterface):
    """Analytics implementation that does nothing - for CE"""
    
    def log_box_import(self, store_id: str, dimensions: List[float], 
                      alternate_depths: Optional[List[float]], chosen_name: str, source: str) -> None:
        """No-op: CE doesn't track analytics"""
        pass
    
    def log_name_selection(self, store_id: str, dimensions: List[float],
                          offered_names: List[str], chosen_name: str) -> None:
        """No-op: CE doesn't track analytics"""
        pass
    
    def log_box_modification(self, store_id: str, original_dimensions: List[float],
                            original_alternate_depths: Optional[List[float]],
                            modified_dimensions: List[float],
                            modified_alternate_depths: Optional[List[float]],
                            modification_type: str) -> None:
        """No-op: CE doesn't track analytics"""
        pass
    
    def log_discovery_session(self, store_id: str, total_found: int, exact_matches: int,
                            unmatched: int, already_in_store: int) -> None:
        """No-op: CE doesn't track analytics"""
        pass
    
    def get_import_stats(self, days: int = 7) -> Dict:
        """Return empty stats for CE"""
        return {
            'time_range_days': days,
            'sources': {},
            'top_boxes': [],
            'custom_patterns': []
        }
    
    def get_name_stats(self, days: int = 7) -> Dict:
        """Return empty stats for CE"""
        return {
            'time_range_days': days,
            'popular_names_by_dimension': {},
            'custom_name_rate': 0.0
        }
    
    def get_discovery_stats(self, days: int = 30) -> Dict:
        """Return empty stats for CE"""
        return {
            'time_range_days': days,
            'discovery_usage': {},
            'adoption': {},
            'missing_from_library': []
        }