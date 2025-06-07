"""Box catalog analytics tracking"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class BoxAnalytics:
    def __init__(self, db_path: str = "/db/packing.db"):
        self.db_path = db_path
    
    @contextmanager
    def _get_db(self):
        """Get database connection with proper cleanup"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            yield conn
        finally:
            if conn:
                conn.close()
    
    def log_box_import(self, store_id: str, dimensions: List[float], 
                      alternate_depths: Optional[List[float]], chosen_name: str, source: str):
        """Log successful imports: library vs custom"""
        try:
            with self._get_db() as conn:
                conn.execute(
                    """INSERT INTO box_imports 
                       (store_id, dimensions, alternate_depths, chosen_name, source) 
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        store_id, 
                        json.dumps(dimensions),
                        json.dumps(alternate_depths) if alternate_depths else None,
                        chosen_name,
                        source
                    )
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to log box import: {e}")
    
    def log_name_selection(self, store_id: str, dimensions: List[float],
                          offered_names: List[str], chosen_name: str):
        """Track which names are most popular"""
        try:
            is_custom = chosen_name not in offered_names
            with self._get_db() as conn:
                conn.execute(
                    """INSERT INTO name_selections 
                       (store_id, dimensions, offered_names, chosen_name, is_custom) 
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        store_id,
                        json.dumps(dimensions),
                        json.dumps(offered_names),
                        chosen_name,
                        is_custom
                    )
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to log name selection: {e}")
    
    
    def get_import_stats(self, days: int = 7) -> Dict:
        """Get box import statistics for the past N days"""
        try:
            since = datetime.now() - timedelta(days=days)
            with self._get_db() as conn:
                conn.row_factory = sqlite3.Row
                
                # Import sources breakdown
                cursor = conn.execute("""
                    SELECT source, COUNT(*) as count
                    FROM box_imports
                    WHERE timestamp >= ?
                    GROUP BY source
                """, (since,))
                sources = {row['source']: row['count'] for row in cursor}
                
                # Top imported boxes
                cursor = conn.execute("""
                    SELECT dimensions, chosen_name, COUNT(*) as count
                    FROM box_imports
                    WHERE timestamp >= ?
                    GROUP BY dimensions
                    ORDER BY count DESC
                    LIMIT 10
                """, (since,))
                top_boxes = []
                for row in cursor:
                    top_boxes.append({
                        'dimensions': json.loads(row['dimensions']),
                        'popular_names': self._get_popular_names_for_dims(row['dimensions'], days),
                        'count': row['count']
                    })
                
                # Custom box patterns
                cursor = conn.execute("""
                    SELECT dimensions, COUNT(DISTINCT store_id) as store_count
                    FROM box_imports
                    WHERE source = 'custom' AND timestamp >= ?
                    GROUP BY dimensions
                    HAVING store_count > 1
                    ORDER BY store_count DESC
                """, (since,))
                custom_patterns = []
                for row in cursor:
                    custom_patterns.append({
                        'dimensions': json.loads(row['dimensions']),
                        'store_count': row['store_count']
                    })
                
                return {
                    'time_range_days': days,
                    'sources': sources,
                    'top_boxes': top_boxes,
                    'custom_patterns': custom_patterns
                }
        except Exception as e:
            logger.error(f"Failed to get import stats: {e}")
            return {}
    
    def get_name_stats(self, days: int = 7) -> Dict:
        """Get name selection statistics"""
        try:
            since = datetime.now() - timedelta(days=days)
            with self._get_db() as conn:
                conn.row_factory = sqlite3.Row
                
                # Most popular names by dimension
                cursor = conn.execute("""
                    SELECT dimensions, chosen_name, COUNT(*) as count
                    FROM name_selections
                    WHERE timestamp >= ? AND is_custom = 0
                    GROUP BY dimensions, chosen_name
                    ORDER BY dimensions, count DESC
                """, (since,))
                
                names_by_dim = {}
                for row in cursor:
                    dims = row['dimensions']
                    if dims not in names_by_dim:
                        names_by_dim[dims] = []
                    names_by_dim[dims].append({
                        'name': row['chosen_name'],
                        'count': row['count']
                    })
                
                # Custom name patterns
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN is_custom THEN 1 ELSE 0 END) as custom_count
                    FROM name_selections
                    WHERE timestamp >= ?
                """, (since,))
                row = cursor.fetchone()
                custom_rate = (row['custom_count'] / row['total'] * 100) if row['total'] > 0 else 0
                
                return {
                    'time_range_days': days,
                    'popular_names_by_dimension': names_by_dim,
                    'custom_name_rate': round(custom_rate, 1)
                }
        except Exception as e:
            logger.error(f"Failed to get name stats: {e}")
            return {}
    
    def _get_popular_names_for_dims(self, dimensions_json: str, days: int) -> List[str]:
        """Get popular names for specific dimensions"""
        try:
            since = datetime.now() - timedelta(days=days)
            with self._get_db() as conn:
                cursor = conn.execute("""
                    SELECT chosen_name, COUNT(*) as count
                    FROM box_imports
                    WHERE dimensions = ? AND timestamp >= ?
                    GROUP BY chosen_name
                    ORDER BY count DESC
                    LIMIT 3
                """, (dimensions_json, since))
                return [row[0] for row in cursor]
        except:
            return []
    
    def log_box_modification(self, store_id: str, original_dimensions: List[float],
                            original_alternate_depths: Optional[List[float]],
                            modified_dimensions: List[float],
                            modified_alternate_depths: Optional[List[float]],
                            modification_type: str):
        """Log when a user modifies box specifications"""
        try:
            with self._get_db() as conn:
                conn.execute("""
                    INSERT INTO box_modifications 
                    (store_id, original_dimensions, original_alternate_depths,
                     modified_dimensions, modified_alternate_depths, modification_type)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    store_id,
                    json.dumps(original_dimensions),
                    json.dumps(original_alternate_depths) if original_alternate_depths else None,
                    json.dumps(modified_dimensions),
                    json.dumps(modified_alternate_depths) if modified_alternate_depths else None,
                    modification_type
                ))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to log box modification: {e}")
    
    def log_discovery_session(self, store_id: str, total_found: int, exact_matches: int,
                            unmatched: int, already_in_store: int):
        """Log box discovery session from price import"""
        try:
            with self._get_db() as conn:
                # Create discovery sessions table if it doesn't exist
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS box_discovery_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        store_id TEXT NOT NULL,
                        total_found INTEGER,
                        exact_matches INTEGER,
                        unmatched INTEGER,
                        already_in_store INTEGER,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                conn.execute("""
                    INSERT INTO box_discovery_sessions 
                    (store_id, total_found, exact_matches, unmatched, already_in_store)
                    VALUES (?, ?, ?, ?, ?)
                """, (store_id, total_found, exact_matches, unmatched, already_in_store))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to log discovery session: {e}")
    
    def get_discovery_stats(self, days: int = 30) -> Dict:
        """Get box discovery usage statistics"""
        try:
            since = datetime.now() - timedelta(days=days)
            with self._get_db() as conn:
                conn.row_factory = sqlite3.Row
                
                # Discovery session stats
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_sessions,
                        AVG(total_found) as avg_boxes_found,
                        AVG(exact_matches) as avg_exact_matches,
                        AVG(CAST(exact_matches AS FLOAT) / NULLIF(total_found, 0) * 100) as match_rate,
                        SUM(exact_matches) as total_matches_made
                    FROM box_discovery_sessions
                    WHERE timestamp >= ?
                """, (since,))
                
                discovery_stats = dict(cursor.fetchone()) if cursor else {}
                
                # Store adoption stats
                cursor = conn.execute("""
                    SELECT 
                        COUNT(DISTINCT store_id) as stores_using_discovery,
                        COUNT(*) as total_discovery_sessions
                    FROM box_discovery_sessions
                    WHERE timestamp >= ?
                """, (since,))
                
                adoption_stats = dict(cursor.fetchone()) if cursor else {}
                
                # Common unmatched dimensions
                cursor = conn.execute("""
                    SELECT dimensions, COUNT(DISTINCT store_id) as stores_needing
                    FROM box_imports
                    WHERE source = 'custom' 
                    AND timestamp >= ?
                    AND dimensions NOT IN (
                        SELECT dimensions FROM box_imports 
                        WHERE source = 'library'
                    )
                    GROUP BY dimensions
                    HAVING stores_needing > 1
                    ORDER BY stores_needing DESC
                    LIMIT 10
                """, (since,))
                
                missing_from_library = []
                for row in cursor:
                    missing_from_library.append({
                        'dimensions': json.loads(row['dimensions']),
                        'stores_needing': row['stores_needing']
                    })
                
                return {
                    'time_range_days': days,
                    'discovery_usage': discovery_stats,
                    'adoption': adoption_stats,
                    'missing_from_library': missing_from_library
                }
        except Exception as e:
            logger.error(f"Failed to get discovery stats: {e}")
            return {}

# Global instance
analytics = BoxAnalytics()