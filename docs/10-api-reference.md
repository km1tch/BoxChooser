# API Reference

**Last Updated:** June 2025  
**Status:** Working document tracking implementation and TODOs

## Overview

All API endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are obtained through the login endpoints and are valid for 24 hours.

## Implementation Status Legend

- ✅ **Implemented** - Fully working in production
- 🚧 **Partial** - Core functionality exists but missing features  
- ❌ **Not Started** - Planned but not implemented
- 🗑️ **Deprecated** - Removed or being phased out

## Authentication Endpoints

### Login with PIN

```
POST /api/auth/store/{store_id}/login
Content-Type: application/json

{
  "pin": "123456"
}
```

Returns: `{ "token": "...", "auth_level": "user" }`

### Request Email Code

```
POST /api/auth/send-code
Content-Type: application/json

{
  "store_id": "100",
  "email": "admin@store.com"
}
```

### Verify Email Code

```
POST /api/auth/verify-code
Content-Type: application/json

{
  "store_id": "100",
  "email": "admin@store.com",
  "code": "ABC123"
}
```

Returns: `{ "token": "...", "auth_level": "admin" }`

### Check Auth Status

```
GET /api/status
```

Returns current authentication status without requiring store_id.

## Store Endpoints

All store endpoints follow the pattern `/api/store/{store_id}/...`

### Box Management

#### Get All Boxes
```
GET /api/store/{store_id}/boxes
```

Returns complete store configuration including all boxes.

#### Get Boxes with Sections
```
GET /api/store/{store_id}/boxes_with_sections
```

Returns boxes organized by supplier/type sections for the editor UI.

#### Get Store Info
```
GET /api/store/{store_id}/info
```

Returns store configuration information:
```json
{
  "store_id": "100",
  "name": "Downtown Store"
}
```

#### Update Itemized Prices (Admin Only)
```
POST /api/store/{store_id}/update_itemized_prices
Content-Type: application/json

[
  {
    "model": "10C-UPS",
    "prices": {
      "box_price": 1.50,
      "basic_materials": 0.25,
      "basic_services": 0.75,
      // ... all fields required
    }
  }
]
```

### Packing Calculations

```
POST /api/store/{store_id}/calculate
Content-Type: application/json

{
  "length": 10,
  "width": 8,
  "height": 6,
  "protectionLevel": "Standard"
}
```

Returns recommendations sorted by score with details on each packing strategy.

### Packing Rules

#### Get Rules
```
GET /api/store/{store_id}/packing-rules
```

Returns protection level definitions and recommendation engine config.

#### Update Rules (Admin Only)
```
POST /api/store/{store_id}/packing-rules
Content-Type: application/json

{
  "rules": [...],
  "engine_config": {...}
}
```

### Floorplan

#### Get Floorplan Image
```
GET /api/store/{store_id}/floorplan
```

Returns floorplan image if available.

#### Upload Floorplan (Admin Only)
```
POST /api/store/{store_id}/floorplan
Content-Type: multipart/form-data

file: <image file>
```

#### Update Box Locations (Admin Only)
```
POST /api/store/{store_id}/boxes/location
Content-Type: application/json

{
  "model": "10C-UPS",
  "coords": [0.425, 0.634]
}
```

### Import/Export

#### Analyze Excel Import
```
POST /api/store/{store_id}/import/analyze
Content-Type: multipart/form-data

file: <excel file>
pricing_mode: "standard" or "itemized"
```

Returns preview of matched/unmatched items.

#### Apply Import (Admin Only)
```
POST /api/store/{store_id}/import/apply
Content-Type: application/json

{
  "mappings": [...],
  "pricing_mode": "standard"
}
```

### Box Library ✅

The vendor system has been replaced with a universal box library. All boxes are now vendor-agnostic.

#### Get All Library Boxes ✅
```
GET /api/boxes/library
```

Returns all boxes in the library with dimensions, alternate depths, and name aliases.

**Note:** Library search is performed client-side for better performance. The frontend loads all boxes once and filters them locally.

#### Check Box Exists ✅
```
POST /api/boxes/library/check
Content-Type: application/json

{
  "dimensions": [10, 10, 10],
  "alternate_depths": [7.5, 5]
}
```

Returns whether an exact match exists in the library.

### Box Management

#### Create Box (Admin Only) ✅
```
POST /api/store/{store_id}/box
Content-Type: application/json

{
  "model": "10C-CUSTOM",
  "dimensions": [10, 10, 10],
  "alternate_depths": [7.5, 5],
  "from_library": true,   // Indicates box came from library
  "offered_names": ["10x10x10", "10C-UPS"]  // Names offered during selection
}
```

**Note:** The `supplier` field has been removed from the system. Box type is now determined by the `from_library` flag.

#### Batch Create Boxes (Admin Only) ✅
```
POST /api/store/{store_id}/boxes/batch
Content-Type: application/json

[
  {
    "model": "10C-UPS",
    "dimensions": [10, 10, 10],
    "alternate_depths": [7.5, 5],
    "from_library": true,
    "offered_names": ["10x10x10", "10C-UPS"]
  },
  {
    "model": "12C-UPS",
    "dimensions": [12, 12, 12],
    "alternate_depths": [9.5, 7],
    "from_library": true,
    "offered_names": ["12x12x12", "12C-UPS"]
  }
]
```

Adds multiple boxes in a single request. Used by box discovery feature.

#### Discover Boxes from Excel (Admin Only) ✅
```
POST /api/store/{store_id}/discover_boxes
Content-Type: multipart/form-data

file: [Excel file]
```

Analyzes an Excel price sheet to discover box dimensions and suggests matches from the library.

### UI Features and Workflows

#### Pivot During Import ✅
When selecting a box from the library, users can click "I need different specs..." to:
1. Pre-fill custom form with library box dimensions
2. Modify any specifications
3. Create a custom variant

This feature tracks modifications for statistics via the box modification endpoint.

#### Hide Existing Boxes Filter ✅ NEW
Library search now includes a checkbox to "Hide boxes already in this store" which:
- Filters out exact matches (dimensions + alternate depths)
- Helps users find only new boxes to add
- Enabled by default

## Response Formats

### Success Response
```json
{
  "data": "...",
  "message": "Success"
}
```

### Error Response
```json
{
  "detail": "Error message"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limits

- Email endpoints: 10 requests per hour per store
- General API: No hard limits, but be reasonable

## Demo Mode

Demo endpoints work the same but with store ID `999999`. Some operations are restricted:
- No floorplan uploads
- No email sending
- Data resets hourly