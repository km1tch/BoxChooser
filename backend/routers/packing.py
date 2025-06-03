from typing import Tuple

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from fastapi.responses import JSONResponse

from backend.lib.auth_middleware import get_current_auth
from backend.lib.auth_manager import get_db
from backend.lib.packing_rules_defaults import (
    get_default_rule, get_all_default_rules,
    get_default_engine_config, get_default_engine_config_value
)
from backend.models.packing import PackingRulesUpdateRequest, EngineConfigUpdateRequest

router = APIRouter(prefix="/api/store/{store_id}", tags=["packing"])


@router.get("/packing-rules", response_class=JSONResponse)
async def get_packing_rules(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth: Tuple[str, str] = get_current_auth()
):
    """Get all packing rules for a store (custom + defaults)"""
    # Verify user has access to this store
    if auth[0] != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    custom_rules = []
    with get_db() as db:
        cursor = db.execute('''
            SELECT * FROM store_packing_rules 
            WHERE store_id = ? 
            ORDER BY packing_type
        ''', (store_id,))
        
        for row in cursor:
            custom_rules.append({
                'id': row['id'],
                'packing_type': row['packing_type'],
                'padding_inches': row['padding_inches'],
                'wizard_description': row['wizard_description'],
                'label_instructions': row['label_instructions'],
                'is_custom': True
            })
    
    # Get all default rules
    default_rules = get_all_default_rules()
    
    # Build effective rules (custom overrides defaults)
    effective_rules = []
    used_types = set()
    
    # First add all custom rules
    for rule in custom_rules:
        used_types.add(rule['packing_type'])
        effective_rules.append(rule)
    
    # Then add defaults that aren't overridden
    for rule in default_rules:
        if rule['packing_type'] not in used_types:
            effective_rules.append(rule)
    
    # Sort by packing type order
    packing_order = {'Basic': 0, 'Standard': 1, 'Fragile': 2, 'Custom': 3}
    effective_rules.sort(key=lambda r: packing_order.get(r['packing_type'], 999))
    
    return {
        'custom_rules': custom_rules,
        'effective_rules': effective_rules
    }


@router.post("/packing-rules", response_class=JSONResponse)
async def update_packing_rules(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    request: PackingRulesUpdateRequest = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Update packing rules for a store"""
    auth_store_id, auth_level = auth_info
    
    # Check admin permission
    if auth_level != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Check store access
    if auth_store_id != store_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized for this store"
        )
    
    # Validate unique packing types
    packing_types = [rule['packing_type'] for rule in request.rules]
    if len(packing_types) != len(set(packing_types)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate packing types found. Each packing type can only have one rule."
        )
    
    # Clear existing rules and insert new ones
    with get_db() as db:
        # Delete existing rules
        db.execute('DELETE FROM store_packing_rules WHERE store_id = ?', (store_id,))
        
        # Insert new rules
        for rule in request.rules:
            db.execute('''
                INSERT INTO store_packing_rules 
                (store_id, packing_type, padding_inches, 
                 wizard_description, label_instructions)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                store_id,
                rule['packing_type'],
                rule['padding_inches'],
                rule['wizard_description'],
                rule['label_instructions']
            ))
        
        db.commit()
    
    return {'success': True, 'rules_updated': len(request.rules)}


@router.delete("/packing-rules", response_class=JSONResponse)
async def reset_packing_rules(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Reset all packing rules to defaults"""
    auth_store_id, auth_level = auth_info
    
    # Check admin permission
    if auth_level != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Check store access
    if auth_store_id != store_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized for this store"
        )
    
    with get_db() as db:
        db.execute('DELETE FROM store_packing_rules WHERE store_id = ?', (store_id,))
        db.commit()
    
    return {'success': True, 'message': 'Rules reset to defaults'}


@router.get("/packing-requirements", response_class=JSONResponse)
async def get_packing_requirements(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    type: str = Query(..., description="Packing type (Basic, Standard, Fragile, Custom)"),
    auth: Tuple[str, str] = get_current_auth()
):
    """Get specific packing requirements for given type"""
    # Verify user has access to this store
    if auth[0] != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # First check for custom rule
    with get_db() as db:
        cursor = db.execute('''
            SELECT * FROM store_packing_rules 
            WHERE store_id = ? 
            AND packing_type = ?
        ''', (store_id, type))
        
        row = cursor.fetchone()
        if row:
            return {
                'padding_inches': row['padding_inches'],
                'wizard_description': row['wizard_description'],
                'label_instructions': row['label_instructions'],
                'is_custom': True
            }
    
    # Fall back to default
    default_rule = get_default_rule(type)
    return {
        **default_rule,
        'is_custom': False
    }


@router.get("/engine-config", response_class=JSONResponse)
async def get_engine_config(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth: Tuple[str, str] = get_current_auth()
):
    """Get recommendation engine configuration for a store"""
    # Verify user has access to this store
    if auth[0] != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check for custom config
    with get_db() as db:
        cursor = db.execute('''
            SELECT * FROM store_engine_config 
            WHERE store_id = ?
        ''', (store_id,))
        
        row = cursor.fetchone()
        if row:
            return {
                'is_custom': True,
                'weights': {
                    'price': row['weight_price'],
                    'efficiency': row['weight_efficiency'],
                    'ease': row['weight_ease']
                },
                'strategy_preferences': {
                    'normal': row['strategy_normal'],
                    'prescored': row['strategy_prescored'],
                    'flattened': row['strategy_flattened'],
                    'manual_cut': row['strategy_manual_cut'],
                    'telescoping': row['strategy_telescoping'],
                    'cheating': row['strategy_cheating']
                },
                'practically_tight_threshold': row['practically_tight_threshold'],
                'max_recommendations': row['max_recommendations'],
                'extreme_cut_threshold': row['extreme_cut_threshold']
            }
    
    # Return defaults
    default_config = get_default_engine_config()
    return {
        'is_custom': False,
        **default_config
    }


@router.post("/engine-config", response_class=JSONResponse)
async def update_engine_config(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    request: EngineConfigUpdateRequest = Body(...),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Update recommendation engine configuration for a store"""
    auth_store_id, auth_level = auth_info
    
    # Check admin permission
    if auth_level != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Check store access
    if auth_store_id != store_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized for this store"
        )
    
    # Validate weights sum to 1.0
    weight_sum = sum(request.weights.values())
    if abs(weight_sum - 1.0) > 0.001:
        raise HTTPException(
            status_code=400,
            detail=f"Weights must sum to 1.0 (current sum: {weight_sum})"
        )
    
    # Validate strategy preferences are in range
    for strategy, value in request.strategy_preferences.items():
        if value < 0 or value > 10:
            raise HTTPException(
                status_code=400,
                detail=f"Strategy preference '{strategy}' must be between 0 and 10"
            )
    
    # Validate thresholds
    if request.extreme_cut_threshold <= 0 or request.extreme_cut_threshold > 1:
        raise HTTPException(
            status_code=400,
            detail="Extreme cut threshold must be between 0 and 1"
        )
    
    with get_db() as db:
        # Insert or update
        db.execute('''
            INSERT OR REPLACE INTO store_engine_config (
                store_id, weight_price, weight_efficiency, weight_ease,
                strategy_normal, strategy_prescored, strategy_flattened,
                strategy_manual_cut, strategy_telescoping, strategy_cheating,
                practically_tight_threshold, max_recommendations, extreme_cut_threshold,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (
            store_id,
            request.weights['price'],
            request.weights['efficiency'],
            request.weights['ease'],
            request.strategy_preferences['normal'],
            request.strategy_preferences['prescored'],
            request.strategy_preferences['flattened'],
            request.strategy_preferences['manual_cut'],
            request.strategy_preferences['telescoping'],
            request.strategy_preferences['cheating'],
            request.practically_tight_threshold,
            request.max_recommendations,
            request.extreme_cut_threshold
        ))
        db.commit()
    
    return {'success': True, 'message': 'Engine configuration updated'}


@router.delete("/engine-config", response_class=JSONResponse)
async def reset_engine_config(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth_info: Tuple[str, str] = get_current_auth()
):
    """Reset engine configuration to defaults"""
    auth_store_id, auth_level = auth_info
    
    # Check admin permission
    if auth_level != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Check store access
    if auth_store_id != store_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized for this store"
        )
    
    with get_db() as db:
        db.execute('DELETE FROM store_engine_config WHERE store_id = ?', (store_id,))
        db.commit()
    
    return {'success': True, 'message': 'Engine configuration reset to defaults'}


@router.get("/packing-config", response_class=JSONResponse)
async def get_packing_config(
    store_id: str = Path(..., regex=r"^\d{1,6}$"),
    auth: Tuple[str, str] = get_current_auth()
):
    """Get combined packing rules and engine config for a store"""
    # Verify user has access to this store
    if auth[0] != store_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get packing rules
    rules_response = await get_packing_rules(store_id, auth)
    
    # Get engine config
    engine_config = await get_engine_config(store_id, auth)
    
    return {
        'rules': rules_response['effective_rules'],
        'engine_config': engine_config
    }