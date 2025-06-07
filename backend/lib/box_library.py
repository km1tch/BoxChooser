"""Box library management - vendor-agnostic box catalog"""
import logging
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional
import yaml

logger = logging.getLogger(__name__)


class BoxLibrary:
    """Manages the unified box library (vendor-agnostic)"""
    
    def __init__(self):
        self.boxes: List[dict] = []
        self._load_library()
    
    def _load_library(self):
        """Load the box library from boxes/library.yml"""
        # Get absolute path from app root
        app_root = Path(__file__).parent.parent.parent  # backend/lib/ -> backend/ -> root/
        library_path = app_root / "boxes" / "library.yml"
        
        if not library_path.exists():
            logger.warning(f"Box library not found at {library_path}")
            return
        
        try:
            with open(library_path, 'r') as f:
                library_data = yaml.safe_load(f)
            
            if library_data and 'boxes' in library_data:
                self.boxes = library_data['boxes']
                logger.info(f"Loaded {len(self.boxes)} boxes from library v{library_data.get('version', 'unknown')}")
            else:
                logger.error("Invalid library format: missing 'boxes' field")
                
        except yaml.YAMLError as e:
            logger.error(f"Error parsing library YAML: {e}")
        except Exception as e:
            logger.error(f"Error loading box library: {e}")
    
    
    
    def find_exact_match(self, dimensions: List[float], 
                        alternate_depths: Optional[List[float]] = None) -> Optional[dict]:
        """
        Find box with exact dimension and alternate depth match
        
        Args:
            dimensions: Box dimensions [L, W, D]
            alternate_depths: Optional prescored depths
            
        Returns:
            Matching box or None
        """
        # Normalize inputs
        dims_sorted = sorted(dimensions, reverse=True)
        depths_sorted = sorted(alternate_depths or [], reverse=True)
        
        for box in self.boxes:
            box_dims = sorted(box['dimensions'], reverse=True)
            box_depths = sorted(box.get('alternate_depths', []), reverse=True)
            
            # Check dimensions match
            if box_dims != dims_sorted:
                continue
            
            # Check alternate depths match
            if depths_sorted != box_depths:
                continue
            
            return box
        
        return None
    
    def find_all_by_dimensions(self, dimensions: List[float]) -> List[dict]:
        """
        Find ALL boxes with exact dimensions (may have different alternate depths)
        
        Args:
            dimensions: Box dimensions [L, W, D]
            
        Returns:
            List of all boxes with these exact dimensions
        """
        results = []
        dims_sorted = sorted(dimensions, reverse=True)
        
        for box in self.boxes:
            box_dims = sorted(box['dimensions'], reverse=True)
            
            # Check if dimensions match exactly
            if box_dims == dims_sorted:
                # Add formatted string for display
                box_copy = box.copy()
                if box.get('alternate_depths'):
                    depths_str = ", ".join(str(d) for d in box['alternate_depths'])
                    box_copy['display_name'] = f"{box_dims[0]}x{box_dims[1]}x{box_dims[2]} (prescored: {depths_str})"
                else:
                    box_copy['display_name'] = f"{box_dims[0]}x{box_dims[1]}x{box_dims[2]} (no prescoring)"
                box_copy['dimensions_str'] = "x".join(str(d) for d in box_dims)
                results.append(box_copy)
        
        return results
    
    def find_similar_boxes(self, dimensions: List[float], tolerance: float = 1.0) -> List[dict]:
        """
        Find boxes with similar dimensions (within tolerance)
        
        Args:
            dimensions: Target dimensions [L, W, D]
            tolerance: Maximum difference in any dimension (inches)
            
        Returns:
            List of similar boxes sorted by total dimension difference
        """
        results = []
        target_sorted = sorted(dimensions, reverse=True)
        
        for box in self.boxes:
            box_dims = sorted(box['dimensions'], reverse=True)
            
            # Calculate max difference
            max_diff = max(abs(box_dims[i] - target_sorted[i]) for i in range(3))
            
            if max_diff <= tolerance:
                # Calculate total difference for sorting
                total_diff = sum(abs(box_dims[i] - target_sorted[i]) for i in range(3))
                results.append({
                    'box': box,
                    'max_diff': max_diff,
                    'total_diff': total_diff
                })
        
        # Sort by total difference
        results.sort(key=lambda x: x['total_diff'])
        
        return [r['box'] for r in results]
    
    def get_boxes_by_category(self, category: str) -> List[dict]:
        """Get all boxes in a specific category"""
        return [box for box in self.boxes if box.get('category') == category]
    
    def get_categories(self) -> List[str]:
        """Get list of all unique categories"""
        categories = set()
        for box in self.boxes:
            if 'category' in box:
                categories.add(box['category'])
        return sorted(list(categories))
    
    def get_summary_stats(self) -> dict:
        """Get summary statistics about the library"""
        total_boxes = len(self.boxes)
        total_names = sum(len(box.get('names', [])) for box in self.boxes)
        
        # Count by category
        category_counts = {}
        for box in self.boxes:
            cat = box.get('category', 'uncategorized')
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        # Count boxes with alternate depths
        with_prescores = sum(1 for box in self.boxes if box.get('alternate_depths'))
        
        return {
            'total_boxes': total_boxes,
            'total_names': total_names,
            'categories': category_counts,
            'with_prescores': with_prescores,
            'without_prescores': total_boxes - with_prescores
        }


# Global instance and lock for thread safety
_library_instance = None
_library_lock = threading.Lock()

def get_box_library() -> BoxLibrary:
    """Get or create the global box library instance (thread-safe)"""
    global _library_instance
    if _library_instance is None:
        with _library_lock:
            # Double-check locking pattern
            if _library_instance is None:
                _library_instance = BoxLibrary()
    return _library_instance

def reload_box_library() -> BoxLibrary:
    """Force reload the box library from disk"""
    global _library_instance
    with _library_lock:
        _library_instance = BoxLibrary()
        logger.info("Box library reloaded")
    return _library_instance