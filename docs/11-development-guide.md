# Development Guide

**Last Updated:** June 2025  
**Status:** Working document reflecting recent architectural changes

## Development Environment Setup

### Prerequisites

- Docker and Docker Compose
- Git
- A code editor (VS Code recommended)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/km1tch/BoxChooser.git
cd BoxChooser

# Start development environment
docker compose up

# In another terminal, run tests
docker compose run --rm site npm test
```

### Development URLs

- Application: http://localhost:5893
- MailHog (email testing): http://localhost:8026
- API: http://localhost:5893/api

## Code Organization

### Frontend Structure

```
frontend/
├── js/
│   ├── index.js          # Main entry point
│   ├── components/       # UI components
│   │   ├── wizard-ui.js  # Packing wizard
│   │   ├── price-table-edit.js
│   │   └── ...
│   └── lib/              # Core libraries
│       ├── api.js        # API client
│       ├── auth.js       # Authentication
│       └── packing.js    # Packing algorithms
├── assets/
│   └── css/              # Stylesheets
└── tests/                # JavaScript tests
```

### Backend Structure

```
backend/
├── main.py               # FastAPI app
├── routers/              # API endpoints
│   ├── auth.py          # Authentication
│   ├── boxes.py         # Box management
│   └── ...
├── lib/                  # Utilities
│   ├── auth_manager.py  # Auth logic
│   ├── yaml_helpers.py  # YAML handling
│   └── ...
└── models/              # Database models
```

## Testing

### JavaScript Tests

```bash
# Run all tests
docker compose run --rm site npm test

# Watch mode for development
docker compose run --rm site npm run test:watch

# Run specific test file
docker compose run --rm site npm test packing.test.js
```

### Writing Tests

Tests use Vitest and follow this pattern:

```javascript
import { describe, it, expect } from 'vitest';
import { calculatePacking } from '../js/lib/packing.js';

describe('Packing Calculations', () => {
  it('should find optimal box for item', () => {
    const result = calculatePacking({
      itemDimensions: [8, 6, 4],
      protectionLevel: 'Standard',
      boxes: testBoxes
    });
    
    expect(result.recommendations).toHaveLength(10);
    expect(result.recommendations[0].model).toBe('10C-UPS');
  });
});
```

### Backend Testing

Currently manual testing via API. Future: pytest integration.

## Development Workflow

### Making Changes

1. **Frontend Changes**
   - Edit files in `frontend/`
   - Changes reflect immediately (volume mounted)
   - Check browser console for errors
   - Run tests to verify

2. **Backend Changes**
   - Edit files in `backend/`
   - Backend auto-reloads (uvicorn --reload)
   - Check docker logs for errors
   - Test via API or UI

3. **Database Changes**
   - Modify schema in `backend/lib/auth_manager.py`
   - Delete `db/packing.db` to recreate
   - Update any affected code

### Adding a New Feature

1. **Plan the Feature**
   - Where does it fit in the UI?
   - What API endpoints are needed?
   - What data storage is required?

2. **Implement Backend**
   - Add router in `backend/routers/`
   - Follow auth patterns (see docs/09-authentication-api-patterns.md)
   - Test with curl or Postman

3. **Implement Frontend**
   - Add UI components
   - Call API using `apiUtils.authenticatedFetch()`
   - Handle loading and error states

4. **Add Tests**
   - Write tests for critical logic
   - Test edge cases
   - Verify auth requirements

5. **Update Documentation**
   - Add to API reference if new endpoints
   - Update relevant guides
   - Add comments for complex code

## Code Style

### JavaScript

- Use ES6 modules
- Async/await over promises
- Descriptive variable names
- JSDoc comments for functions

```javascript
/**
 * Calculate optimal packing for an item
 * @param {Object} params - Calculation parameters
 * @param {number[]} params.dimensions - [length, width, height]
 * @param {string} params.protectionLevel - Protection level
 * @returns {Object} Packing recommendations
 */
export async function calculatePacking(params) {
  // Implementation
}
```

### Python

- Follow PEP 8
- Type hints for function parameters
- Docstrings for classes and functions
- Use logging instead of print()

```python
def calculate_packing(
    dimensions: List[float],
    protection_level: str,
    boxes: List[dict]
) -> dict:
    """
    Calculate optimal packing for given dimensions.
    
    Args:
        dimensions: Item dimensions [length, width, height]
        protection_level: One of Basic, Standard, Fragile, Custom
        boxes: Available box inventory
        
    Returns:
        Dictionary with recommendations
    """
    # Implementation
```

### CSS

- Mobile-first design
- CSS custom properties for theming
- BEM naming for components
- Avoid !important

```css
/* Component container */
.price-editor {
  --editor-spacing: 1rem;
  padding: var(--editor-spacing);
}

/* Component elements */
.price-editor__header {
  margin-bottom: var(--editor-spacing);
}

/* Component modifiers */
.price-editor--readonly {
  opacity: 0.7;
}
```

## Debugging

### Frontend Debugging

1. **Browser DevTools**
   - Console for errors
   - Network tab for API calls
   - Sources for breakpoints

2. **Common Issues**
   - CORS errors: Check API endpoint URL
   - 401 errors: Token expired or missing
   - 403 errors: Insufficient permissions

### Backend Debugging

1. **Docker Logs**
   ```bash
   docker compose logs -f backend
   ```

2. **Common Issues**
   - YAML errors: Check file syntax
   - Database locked: Restart backend
   - Import errors: Check Python imports

### Email Testing

All emails in development go to MailHog:
- View at http://localhost:8026
- No actual emails sent
- Great for testing auth flow

## Performance Considerations

1. **Minimize API Calls**
   - Cache data where appropriate
   - Batch operations when possible
   - Use loading states

2. **Optimize Calculations**
   - Packing calculations can be intensive
   - Limit number of boxes processed
   - Use Web Workers for heavy computation (future)

3. **Image Optimization**
   - Compress floorplan images
   - Use appropriate formats (PNG for diagrams)
   - Lazy load where possible

## Security Best Practices

1. **Never Trust User Input**
   - Validate on backend
   - Sanitize for display
   - Use parameterized queries

2. **Authentication Required**
   - All store data requires auth
   - Check permissions for admin operations
   - Follow patterns in docs

3. **Sensitive Data**
   - No passwords in code
   - Use environment variables
   - Don't log sensitive info

## Deployment Considerations

When preparing for production:

1. **Remove Debug Code**
   - No console.log statements
   - No commented code
   - No test data

2. **Optimize Assets**
   - Minify CSS/JS (future)
   - Compress images
   - Enable caching

3. **Error Handling**
   - User-friendly error messages
   - Log errors properly
   - Have fallbacks

## Recent Architecture Changes

### Box Library System (Implemented ✅)
- Replaced vendor-specific catalogs with universal box library
- All boxes are now vendor-agnostic, identified by dimensions + alternate depths
- Library stored in `boxes/library.yml`
- Search and filter capabilities across all boxes

### Statistics System (Implemented ✅)
- Database tables implemented for tracking imports, name selections, and modifications
- Search tracking removed (client-side filtering only)
- Frontend tracking implemented
- Backend endpoints fully implemented
- Renamed from "analytics" to "stats" to avoid ad blocker issues
- Real-time updates moved to long-term roadmap

### UI Improvements (Implemented ✅)
- Pivot feature: Modify library box specs during import
- Hide existing boxes filter in library search
- Real-time validation for alternate depths
- Improved error handling and user feedback

## Contributing

We welcome contributions! Key areas for improvement:

- Category support for box library
- Real-time analytics dashboard
- WebSocket support for live updates
- Box modification tracking endpoint
- Integration with shipping systems
- Mobile app development
- Additional test coverage

### Contribution Guidelines

1. **Follow Existing Patterns**
   - Maintain code style consistency
   - Use established authentication patterns
   - Follow project structure

2. **Test Your Changes**
   - Add tests for new features
   - Run existing tests
   - Test in demo mode

3. **Update Documentation**
   - Document new features
   - Update API reference
   - Add code comments

4. **Consider Multi-Store**
   - Changes must work for all stores
   - Maintain store isolation
   - Test with multiple stores

5. **Submit Clean PRs**
   - One feature per PR
   - Clear commit messages
   - Reference any issues

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Update documentation
6. Submit PR with description

## TODO List (Implementation Roadmap)

### High Priority
1. **Category Support** ❌
   - Add category field to library boxes
   - Implement `/api/boxes/library/categories` endpoint
   - Implement `/api/boxes/library/category/{category}` endpoint
   - Add category filter to UI

### Medium Priority
2. **Per-Store Analytics Views** ❌
   - Store-specific dashboards
   - Comparative analytics
   - Usage patterns

### Low Priority
3. **Library Contribution System** ❌
   - Allow stores to suggest new boxes
   - Voting/verification system
   - Automatic library updates

4. **Advanced Search Features** ❌
   - Volume-based search
   - Dimension tolerance matching
   - "Boxes that fit X" search

### Long-term / Nice-to-Have
5. **Real-time Updates (WebSocket)** ❌
   - WebSocket endpoint for live updates
   - Dashboard auto-refresh
   - **Note:** Not essential - manual refresh works fine

## Getting Help

- Check existing code for patterns
- Read the documentation in `/docs`
- Test in demo mode first
- Ask questions via GitHub issues