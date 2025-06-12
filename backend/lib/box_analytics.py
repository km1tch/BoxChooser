"""Box catalog analytics tracking - abstraction layer"""
import os
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# Determine which implementation to use based on environment
# Default to no-op (CE) unless explicitly set to saas
def _get_analytics_implementation():
    """Factory function to get the appropriate analytics implementation"""
    # Check for VERSION file first
    version_file_path = os.path.join(os.path.dirname(__file__), '..', '..', 'VERSION')
    if os.path.exists(version_file_path):
        try:
            with open(version_file_path, 'r') as f:
                content = f.read()
                # Only use database implementation if explicitly set to saas
                if 'EDITION: saas' in content:
                    from .analytics_db import DatabaseAnalytics
                    return DatabaseAnalytics()
        except Exception as e:
            logger.error(f"Failed to read VERSION file: {e}")
    
    # Default to no-op implementation (CE behavior)
    from .analytics_noop import NoOpAnalytics
    return NoOpAnalytics()


class BoxAnalytics:
    """Analytics wrapper that delegates to the appropriate implementation"""
    
    def __init__(self, db_path: str = "/db/packing.db"):
        self._impl = _get_analytics_implementation()
    
    def log_box_import(self, store_id: str, dimensions: List[float], 
                      alternate_depths: Optional[List[float]], chosen_name: str, source: str):
        """Log successful imports: library vs custom"""
        return self._impl.log_box_import(store_id, dimensions, alternate_depths, chosen_name, source)
    
    def log_name_selection(self, store_id: str, dimensions: List[float],
                          offered_names: List[str], chosen_name: str):
        """Track which names are most popular"""
        return self._impl.log_name_selection(store_id, dimensions, offered_names, chosen_name)
    
    def log_box_modification(self, store_id: str, original_dimensions: List[float],
                            original_alternate_depths: Optional[List[float]],
                            modified_dimensions: List[float],
                            modified_alternate_depths: Optional[List[float]],
                            modification_type: str):
        """Log when a user modifies box specifications"""
        return self._impl.log_box_modification(
            store_id, original_dimensions, original_alternate_depths,
            modified_dimensions, modified_alternate_depths, modification_type
        )
    
    def log_discovery_session(self, store_id: str, total_found: int, exact_matches: int,
                            unmatched: int, already_in_store: int):
        """Log box discovery session from price import"""
        return self._impl.log_discovery_session(store_id, total_found, exact_matches, unmatched, already_in_store)
    
    def get_import_stats(self, days: int = 7) -> Dict:
        """Get box import statistics for the past N days"""
        return self._impl.get_import_stats(days)
    
    def get_name_stats(self, days: int = 7) -> Dict:
        """Get name selection statistics"""
        return self._impl.get_name_stats(days)
    
    def get_discovery_stats(self, days: int = 30) -> Dict:
        """Get box discovery usage statistics"""
        return self._impl.get_discovery_stats(days)


# Global instance
analytics = BoxAnalytics()