"""Statistics endpoints for box catalog usage"""
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Optional
from backend.lib.auth_middleware import get_current_superadmin
from backend.lib.box_analytics import analytics

router = APIRouter(prefix="/api/admin/stats", tags=["statistics"])

@router.get("/additions")
async def get_import_statistics(
    time_range: str = Query("7d", regex="^\\d+[dD]$"),
    current_admin: Dict = Depends(get_current_superadmin)
) -> Dict:
    """Get box import statistics
    
    Args:
        time_range: Time range in format "Nd" where N is number of days (e.g., "7d", "30d")
    
    Returns:
        Import statistics including source breakdown, top boxes, and custom patterns
    """
    # Parse time range
    try:
        days = int(time_range[:-1])
        if days < 1 or days > 365:
            raise ValueError("Days must be between 1 and 365")
    except (ValueError, IndexError):
        raise HTTPException(400, "Invalid time range format. Use format like '7d' or '30d'")
    
    return analytics.get_import_stats(days)


@router.get("/selections")
async def get_name_statistics(
    time_range: str = Query("7d", regex="^\\d+[dD]$"),
    current_admin: Dict = Depends(get_current_superadmin)
) -> Dict:
    """Get name selection patterns
    
    Args:
        time_range: Time range in format "Nd" where N is number of days
    
    Returns:
        Name statistics including popular names by dimension and custom name rate
    """
    # Parse time range
    try:
        days = int(time_range[:-1])
        if days < 1 or days > 365:
            raise ValueError("Days must be between 1 and 365")
    except (ValueError, IndexError):
        raise HTTPException(400, "Invalid time range format. Use format like '7d' or '30d'")
    
    return analytics.get_name_stats(days)

@router.get("/discovery")
async def get_discovery_statistics(
    time_range: str = Query("30d", regex="^\\d+[dD]$"),
    current_admin: Dict = Depends(get_current_superadmin)
) -> Dict:
    """Get box discovery from price import statistics
    
    Args:
        time_range: Time range in format "Nd" where N is number of days
    
    Returns:
        Discovery statistics including usage, match rates, and missing boxes
    """
    # Parse time range
    try:
        days = int(time_range[:-1])
        if days < 1 or days > 365:
            raise ValueError("Days must be between 1 and 365")
    except (ValueError, IndexError):
        raise HTTPException(400, "Invalid time range format. Use format like '7d' or '30d'")
    
    return analytics.get_discovery_stats(days)

@router.get("/summary")
async def get_analytics_summary(
    current_admin: Dict = Depends(get_current_superadmin)
) -> Dict:
    """Get overall analytics summary
    
    Returns:
        Combined summary of key metrics for dashboard display
    """
    # Get stats for different time periods
    week_imports = analytics.get_import_stats(7)
    week_names = analytics.get_name_stats(7)
    week_discovery = analytics.get_discovery_stats(7)
    
    month_imports = analytics.get_import_stats(30)
    month_discovery = analytics.get_discovery_stats(30)
    
    return {
        "week": {
            "imports": week_imports,
            "names": week_names,
            "discovery": week_discovery
        },
        "month": {
            "imports": month_imports,
            "discovery": month_discovery
        },
        "trends": {
            "library_adoption": _calculate_library_adoption_trend(week_imports, month_imports),
            "discovery_adoption": _calculate_discovery_adoption_trend(week_discovery, month_discovery)
        }
    }

def _calculate_library_adoption_trend(week_stats: Dict, month_stats: Dict) -> Dict:
    """Calculate library vs custom adoption trends"""
    week_total = sum(week_stats.get('sources', {}).values())
    week_library = week_stats.get('sources', {}).get('library', 0)
    week_rate = (week_library / week_total * 100) if week_total > 0 else 0
    
    month_total = sum(month_stats.get('sources', {}).values())
    month_library = month_stats.get('sources', {}).get('library', 0)
    month_rate = (month_library / month_total * 100) if month_total > 0 else 0
    
    return {
        "week_library_rate": round(week_rate, 1),
        "month_library_rate": round(month_rate, 1),
        "trend": "increasing" if week_rate > month_rate else "decreasing" if week_rate < month_rate else "stable"
    }

def _calculate_discovery_adoption_trend(week_stats: Dict, month_stats: Dict) -> Dict:
    """Calculate discovery feature adoption trends"""
    week_sessions = week_stats.get('discovery_usage', {}).get('total_sessions', 0)
    week_match_rate = week_stats.get('discovery_usage', {}).get('match_rate', 0)
    
    month_sessions = month_stats.get('discovery_usage', {}).get('total_sessions', 0) 
    month_match_rate = month_stats.get('discovery_usage', {}).get('match_rate', 0)
    
    # Calculate weekly average from monthly data
    month_weekly_avg = month_sessions / 4.3 if month_sessions > 0 else 0
    
    return {
        "week_sessions": week_sessions,
        "week_match_rate": round(week_match_rate, 1),
        "month_match_rate": round(month_match_rate, 1),
        "usage_trend": "increasing" if week_sessions > month_weekly_avg else "decreasing" if week_sessions < month_weekly_avg else "stable"
    }