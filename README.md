# PackingSite

Put in the measured dimensions of something to be packed, and it spits out optimal ways to pack it. Supports multiple stores with different box inventories.

## How to Use it

### Packing Levels:

- No Pack: Don't require any extra space for packing.
- Standard Pack: Try to find box that adds 2 inches to each dimension (1 inch on every side).
- Fragile Pack: Same but 4 inches.
- Custom Pack: Same but 6 inches.

### Packing Strategies

- Normal: Pack like normal; Wrap item in bubble wrap, put in box, close box.
- Cut Down: Same as before, but the open dimension of the box gets cut down until it exactly matches the packing level.
- Telescoping: Stack and tape multiple of the same box on top of each other to create an extra long box. Flaps are included in the box count calculation.
- Cheating: Tries rotating the item along each dimension to see if it fits inside a smaller box by taking advantage of the Pythagorean theorem. [Visual](https://stackoverflow.com/questions/69963451/how-to-get-height-and-width-of-element-when-it-is-rotated)
- Flattened: Instead of using a box to make a box, instead keep it flat and tape up the ends and gaps to create an oversized envelope. The assumption is that something like a poster goes in here. Max allowed height is 1 inch

### Result Filter

- Sort by Score: By default sorts by packing price where tightness score is a tiebreaker. Toggling checkbox swaps price and tightness importance
- Impossible Boxes: The item is physically to big to put into the box. Mainly for debugging, but may show why certain boxes have been excluded.
- No space: Options that have a dimension with 0 inches of extra space. This means it's technically possible to put an item in without any form of packing material. Disabled by default because poor practice + any mismeasurement may result with a box that is impossible to fit.
- Possible Boxes: These boxes can hold the item, but some packing will be sacrificied in at least one dimension. This adds some leniency to the boxes available.
- Fits: The item can be properly wraped and put into the box. There may be extra space for additional void fill. (Not actually an option. Always enabled)

### Table Columns

- Tightness: How much space the box has to fill with void fill. 0 = the box is the same size as the item. Calculated via summing dimensionOffset^2.
- Box Dims: The box this entry is based on.
- Pack Level: Pack Level.
- Price: Price of box at packing level using packing strategy.
- Recomendation: How much the site recomends the row combination. Options include Impossible, No Space, Possible, Fits.
- Pack Strategy: Pack strategy.
- Comments: Some strategies add some additional information that may be useful. For example, Cut Down and Telescoping list the new heights so that CMS has a more accurate numbers and the packer knows what's going on.
- Print: Formats the row in a thermal label printer friendly format. It has all the needed info for the packer to do their job.

### Debug Button

Shows some extra things for debugging/settings

- Dump State: Logs the current state object into the console.
- Print Scale: Changes the size of the text in the print menu. Font size is currently based on screen size.
- Comment: Sends a message to the backend on any isuses or comments. Intended to let the maintainer know whether there are any mistakes (prices or boxes info) and correct them when possible.

## Customize it

The application supports multiple stores, each with its own box inventory. Box definitions are stored in separate YAML files named `stores/store{id}.yml`, where `{id}` is the store number (e.g., `stores/store1.yml`, `stores/store2.yml`).

Each store file has the following format:

```yaml
pricing-mode: standard # Choose between 'standard' or 'itemized' pricing mode

boxes:
  # For normal boxes (where the third dimension (z) is assumed to be the opening):
  - type: NormalBox
    supplier: ABC # Optional supplier information
    model: "06C-UPS" # Model identifier (also optional, but at some point we'll probably REALLY want to use this!)
    dimensions: [x, y, z] # Dimensions - the code assumes z is the opening side for "normal" boxes
    prices: [nopack_price, standard_price, fragile_price, custom_price] # Standard pricing format
    location: "A1" # Optional location information.  Any arbitrary string to help the user find the box.

  # For normal boxes with itemized pricing:
  - type: NormalBox
    supplier: ABC
    model: "08C-UPS"
    dimensions: [x, y, z]
    itemized-prices: # Itemized pricing format
      box-price: 4.24 # Base price of the box
      standard-materials: 1.0 # Material cost for standard packing
      standard-services: 2.0 # Service cost for standard packing
      fragile-materials: 3.0 # Material cost for fragile packing
      fragile-services: 2.0 # Service cost for fragile packing
      custom-materials: 4.0 # Material cost for custom packing
      custom-services: 3.0 # Service cost for custom packing
    location: "A2"

  # For custom boxes (where you need to specify the opening dimension):
  - type: CustomBox
    supplier: ABC
    model: "CustomBox-1"
    dimensions: [x, y, z] # Dimensions in descending order
    open_dim: 0 # Index of the opening dimension (0, 1, or 2)
    prices: [nopack_price, standard_price, fragile_price, custom_price] # Can also use itemized-prices format
    location: "B2"
```

To add, remove, or modify boxes, edit the appropriate store YAML file. To add a new store, create a new `stores/store{id}.yml` file following the format above.

## Run it

Simply run `docker compose up` in the same directory, and it should start the server. By default it binds host port `5893` because I run multiple lightweight servers behind NGINX and the port doesn't collide with anything else I run.

Docker configuration notes:

- The store YAML files (`stores/store*.yml`) are included in the Docker volume mount, so you can edit box configurations without rebuilding
- The SQLite database is persisted in `./db/packingwebsite.db` for authentication and settings
- MailHog is included for email testing in development (web UI at `http://localhost:8026`)

## Pricing Modes

The application supports two pricing modes:

1. **Standard Pricing Mode**: Uses a simple array of 4 values for box prices at different packing levels:

   - `[nopack_price, standard_price, fragile_price, custom_price]`

2. **Itemized Pricing Mode**: Breaks down each price into box cost, materials, and services for more detailed pricing:
   - `box-price`: Base cost of the box
   - `standard-materials`, `standard-services`: Materials and service costs for standard packing
   - `fragile-materials`, `fragile-services`: Materials and service costs for fragile packing
   - `custom-materials`, `custom-services`: Materials and service costs for custom packing

To specify the pricing mode for a store, add the `pricing-mode` field at the top of the store YAML file:

```yaml
pricing-mode: standard # or 'itemized'
```

## Authentication & Access Control

The application uses a two-tier authentication system:

- **User Access (PIN)**: 6-digit PIN for read-only access to wizard, packing calculator, and price viewer
- **Admin Access (Email)**: Email verification for full access including price editing and settings

To set up authentication for a store:

```bash
./tools/auth create 1 admin@example.com
```

## Price Editor

The price editor is accessed via `/prices` after logging in. The price editor interface will adapt based on the pricing mode:

- **Standard Mode**: Shows a simple table with box price, standard, fragile, and custom prices
- **Itemized Mode**: Shows a more detailed table breaking down each price into box price, materials, and services

Price editing requires admin authentication.

## URL Routes and Endpoints

### Public Routes (require authentication)

- `/` - Home page (redirects to login)
- `/login` - Login page
- `/wizard` - Box selection wizard (user/admin access)
- `/prices` - Price viewer/editor (user: read-only, admin: edit)
- `/import` - Import prices from Excel (admin only)
- `/floorplan` - Floorplan editor (admin only)
- `/settings` - Store settings (admin only)

### API Endpoints

- `/api/store/{store_id}/boxes` - Get all boxes for a store
- `/api/store/{store_id}/boxes_with_sections` - Get boxes organized by sections
- `/api/store/{store_id}/pricing_mode` - Get the current pricing mode for a store
- `/api/store/{store_id}/update_prices` - Update prices in standard pricing mode (admin only)
- `/api/store/{store_id}/update_itemized_prices` - Update prices in itemized pricing mode (admin only)
- `/api/store/{store_id}/import/analyze` - Analyze Excel file for import matching (admin only)
- `/api/store/{store_id}/import/apply` - Apply import updates from Excel (admin only)
- `/api/store/{store_id}/packing-rules` - Get/update packing rules (admin only for updates)
- `/api/store/{store_id}/engine-config` - Get/update recommendation engine config (admin only for updates)

## Excel Import

The application supports importing prices from Excel files. The import system has a three-tier matching strategy:

1. **Perfect Match**: Uses saved item ID mappings (MPOS_mapping) for exact matching
2. **Probable Match**: Matches based on dimensions and having all required product categories
3. **Manual Mapping**: For boxes with no dimension match in the Excel file

### Excel Format Requirements

The Excel file should contain products with dimensions in the format `WxHxD` (e.g., "10x10x48", "17.5x15.125x3.25"). The system will:

- Handle mixed case X (e.g., "16x08X65")
- Support decimal dimensions
- Extract and display suffixes (e.g., "275# Box", "Golf club", "DW Box")
- Ignore alternate depth notations like "(x38)" or "(30,26)" when matching dimensions
- Categorize products as "box" if they start with dimensions
- Support both abbreviated and full packing type names (e.g., "Cust"/"Custom", "Frg"/"Fragile", "Std"/"Standard")

### TODO Items

- Add HTTPS to Caddy
- More test coverage
- Handle special insert items (e.g., "Electronics Insert", "Med Electronics Insert") - need to discuss with store managers about proper categorization and matching strategy
- Excel import from RAW Dynamics output? (vs the cleaned up/ready for Dynamics import format we use now)
- Excel output for pricing for Dynamics import

### On the Fence

- Consider removing support for non-itemized pricing
- Consider moving stuff from YAML into the DB. On the fence...

## Architecture Notes

- FastAPI backend with modular router structure
- SQLite for auth and configuration storage
- ES6 modules for frontend code organization
- test suite using Vitest

# License

Standard MIT, but send an email over to `qrqi47rmikk@airmail.cc` (from any email you want) if you end up using this program. Something like "I'm using it." is fine. I'm just curious to see if anyone ends up using it.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
