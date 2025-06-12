import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Box Library API', () => {
  let originalFetch;
  let api;

  beforeEach(() => {
    // Store original fetch
    originalFetch = global.fetch;
    
    // Mock fetch
    global.fetch = vi.fn();
    
    // Mock window.api structure
    api = {
      getLibraryBoxes: async (storeId) => {
        const response = await fetch(`/api/boxes/library`, {
          headers: {
            'X-Store-ID': storeId,
            'Authorization': 'Bearer mock-token'
          }
        });
        if (!response.ok) throw new Error('Failed to fetch library');
        return await response.json();
      },
      
      checkLibraryBox: async (storeId, dimensions, alternateDepths = null) => {
        const response = await fetch(`/api/boxes/library/check`, {
          method: 'POST',
          headers: {
            'X-Store-ID': storeId,
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ dimensions, alternate_depths: alternateDepths })
        });
        if (!response.ok) throw new Error('Failed to check library');
        return await response.json();
      },
      
      createBox: async (storeId, boxData) => {
        const response = await fetch(`/api/store/${storeId}/boxes`, {
          method: 'POST',
          headers: {
            'X-Store-ID': storeId,
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(boxData)
        });
        if (!response.ok) throw new Error('Failed to create box');
        return await response.json();
      },
      
      createBoxesBatch: async (storeId, boxes) => {
        const response = await fetch(`/api/store/${storeId}/boxes/batch`, {
          method: 'POST',
          headers: {
            'X-Store-ID': storeId,
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(boxes)
        });
        if (!response.ok) throw new Error('Failed to create boxes');
        return await response.json();
      },
      
      trackBoxModification: async (storeId, modificationData) => {
        const response = await fetch(`/api/store/${storeId}/analytics/box-modification`, {
          method: 'POST',
          headers: {
            'X-Store-ID': storeId,
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(modificationData)
        });
        if (!response.ok) throw new Error('Failed to track modification');
        return await response.json();
      }
    };
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('getLibraryBoxes', () => {
    it('should fetch all library boxes', async () => {
      const mockBoxes = [
        { dimensions: [10, 10, 10], names: ['10C-UPS'] },
        { dimensions: [12, 10, 8], names: ['12X10X8'] }
      ];
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockBoxes
      });
      
      const result = await api.getLibraryBoxes('123');
      
      expect(global.fetch).toHaveBeenCalledWith('/api/boxes/library', {
        headers: {
          'X-Store-ID': '123',
          'Authorization': 'Bearer mock-token'
        }
      });
      
      expect(result).toEqual(mockBoxes);
      expect(result).toHaveLength(2);
    });

    it('should handle empty library', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => []
      });
      
      const result = await api.getLibraryBoxes('123');
      expect(result).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });
      
      await expect(api.getLibraryBoxes('123')).rejects.toThrow('Failed to fetch library');
    });
  });

  describe('checkLibraryBox', () => {
    it('should check if exact box exists', async () => {
      const mockResponse = {
        exact_match: true,
        box: {
          dimensions: [10, 10, 10],
          alternate_depths: [7.5, 5],
          names: ['10C-UPS', '10CUBE']
        },
        similar_boxes: []
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await api.checkLibraryBox('123', [10, 10, 10], [7.5, 5]);
      
      expect(global.fetch).toHaveBeenCalledWith('/api/boxes/library/check', {
        method: 'POST',
        headers: {
          'X-Store-ID': '123',
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dimensions: [10, 10, 10],
          alternate_depths: [7.5, 5]
        })
      });
      
      expect(result.exact_match).toBe(true);
      expect(result.box.names).toContain('10C-UPS');
    });

    it('should find similar boxes when no exact match', async () => {
      const mockResponse = {
        exact_match: false,
        box: null,
        similar_boxes: [
          { dimensions: [10, 10, 9], names: ['CLOSE-1'] },
          { dimensions: [11, 10, 10], names: ['CLOSE-2'] }
        ]
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await api.checkLibraryBox('123', [10, 10, 10]);
      
      expect(result.exact_match).toBe(false);
      expect(result.similar_boxes).toHaveLength(2);
    });

    it('should handle dimensions without alternate depths', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ exact_match: false, box: null, similar_boxes: [] })
      });
      
      await api.checkLibraryBox('123', [8, 6, 4]);
      
      expect(global.fetch).toHaveBeenCalledWith('/api/boxes/library/check', 
        expect.objectContaining({
          body: JSON.stringify({
            dimensions: [8, 6, 4],
            alternate_depths: null
          })
        })
      );
    });
  });

  describe('createBox with library tracking', () => {
    it('should create box from library with analytics', async () => {
      const boxData = {
        model: '10C-UPS',
        dimensions: [10, 10, 10],
        alternate_depths: [7.5, 5],
        from_library: true,
        offered_names: ['10C-UPS', '10CUBE', 'TENCUBE'],
        location: { position: 'A1', coords: [0.5, 0.5] }
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, box_id: 'new-123' })
      });
      
      const result = await api.createBox('123', boxData);
      
      expect(global.fetch).toHaveBeenCalledWith('/api/store/123/boxes', {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify(boxData)
      });
      
      const sentData = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(sentData.from_library).toBe(true);
      expect(sentData.offered_names).toHaveLength(3);
    });

    it('should create custom box without library tracking', async () => {
      const boxData = {
        model: 'CUSTOM-15X12',
        dimensions: [15, 12, 9],
        alternate_depths: null,
        from_library: false,
        offered_names: null
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      
      await api.createBox('123', boxData);
      
      const sentData = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(sentData.from_library).toBe(false);
      expect(sentData.offered_names).toBeNull();
    });
  });

  describe('createBoxesBatch', () => {
    it('should create multiple boxes in one request', async () => {
      const boxes = [
        {
          model: '10C-UPS',
          dimensions: [10, 10, 10],
          from_library: true,
          offered_names: ['10C-UPS', '10CUBE']
        },
        {
          model: 'CUSTOM-12',
          dimensions: [12, 8, 6],
          from_library: false,
          offered_names: null
        }
      ];
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          success: true, 
          created: 2,
          failed: []
        })
      });
      
      const result = await api.createBoxesBatch('123', boxes);
      
      expect(global.fetch).toHaveBeenCalledWith('/api/store/123/boxes/batch', {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify(boxes)
      });
      
      expect(result.created).toBe(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle partial batch failures', async () => {
      const boxes = [
        { model: 'VALID', dimensions: [10, 10, 10] },
        { model: 'INVALID', dimensions: [-1, 10, 10] }
      ];
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          created: 1,
          failed: [{ 
            index: 1, 
            error: 'Invalid dimensions'
          }]
        })
      });
      
      const result = await api.createBoxesBatch('123', boxes);
      
      expect(result.created).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Invalid dimensions');
    });
  });

  describe('trackBoxModification', () => {
    it('should track when user modifies library box specs', async () => {
      const modificationData = {
        original_dimensions: [10, 10, 10],
        original_alternate_depths: [7.5, 5],
        modified_dimensions: [10, 10, 10],
        modified_alternate_depths: [8, 6, 4],
        modification_type: 'alternate_depths'
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      
      await api.trackBoxModification('123', modificationData);
      
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/store/123/analytics/box-modification',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(modificationData)
        })
      );
    });

    it('should track dimension modifications', async () => {
      const modificationData = {
        original_dimensions: [10, 10, 10],
        modified_dimensions: [11, 10, 9],
        modification_type: 'dimensions'
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      
      await api.trackBoxModification('123', modificationData);
      
      const sentData = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(sentData.modification_type).toBe('dimensions');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      await expect(api.getLibraryBoxes('123')).rejects.toThrow('Network error');
    });

    it('should handle 401 unauthorized', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });
      
      await expect(api.checkLibraryBox('123', [10, 10, 10]))
        .rejects.toThrow('Failed to check library');
    });

    it('should handle 403 forbidden', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });
      
      await expect(api.createBox('999', {}))
        .rejects.toThrow('Failed to create box');
    });

    it('should handle malformed JSON response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });
      
      await expect(api.getLibraryBoxes('123')).rejects.toThrow('Invalid JSON');
    });
  });
});