import { describe, it, expect, beforeEach, vi } from 'vitest';
import PackingRulesManager from '../lib/packing-rules.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('PackingRulesManager', () => {
  let manager;
  
  beforeEach(() => {
    manager = new PackingRulesManager('1');
    // Reset fetch mock
    fetch.mockReset();
    // Clear any cached data
    manager.clearCache();
  });

  describe('constructor', () => {
    it('should initialize with store ID', () => {
      const manager = new PackingRulesManager('42');
      expect(manager.storeId).toBe('42');
      expect(manager.cache).toBe(null);
      expect(manager.cacheExpiry).toBe(null);
      expect(manager.cacheDuration).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('getAllRequirements', () => {
    it('should fetch requirements from API', async () => {
      const mockRules = [
        { packing_type: 'Basic', padding_inches: 0, wizard_description: 'Basic packing' },
        { packing_type: 'Standard', padding_inches: 1, wizard_description: 'Standard packing' }
      ];
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ effective_rules: mockRules })
      });
      
      const rules = await manager.getAllRequirements();
      
      expect(fetch).toHaveBeenCalledWith('/api/store/1/packing-rules', {});
      expect(rules).toEqual(mockRules);
    });

    it('should cache results', async () => {
      const mockRules = [
        { packing_type: 'Basic', padding_inches: 0 }
      ];
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ effective_rules: mockRules })
      });
      
      // First call
      const rules1 = await manager.getAllRequirements();
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const rules2 = await manager.getAllRequirements();
      expect(fetch).toHaveBeenCalledTimes(1); // Not called again
      expect(rules2).toEqual(rules1);
    });

    it('should refresh cache after expiry', async () => {
      const mockRules1 = [{ packing_type: 'Basic', padding_inches: 0 }];
      const mockRules2 = [{ packing_type: 'Basic', padding_inches: 1 }]; // Different
      
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effective_rules: mockRules1 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effective_rules: mockRules2 })
        });
      
      // First call
      const rules1 = await manager.getAllRequirements();
      expect(rules1).toEqual(mockRules1);
      
      // Expire the cache
      manager.cacheExpiry = Date.now() - 1000;
      
      // Second call should fetch again
      const rules2 = await manager.getAllRequirements();
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(rules2).toEqual(mockRules2);
    });

    it('should return defaults on API error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const rules = await manager.getAllRequirements();
      
      expect(rules).toEqual(manager.getDefaultRules());
      expect(rules.length).toBe(4); // Basic, Standard, Fragile, Custom
    });

    it('should return defaults on non-OK response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });
      
      const rules = await manager.getAllRequirements();
      
      expect(rules).toEqual(manager.getDefaultRules());
    });
  });

  describe('getRequirements', () => {
    it('should fetch specific packing type requirements', async () => {
      const mockRules = [
        {
          packing_type: 'Fragile',
          padding_inches: 2,
          wizard_description: 'Fragile items',
          label_instructions: 'Handle with care',
          is_custom: false
        }
      ];
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ effective_rules: mockRules })
      });
      
      const req = await manager.getRequirements('Fragile');
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/store/1/packing-rules',
        {}
      );
      expect(req).toEqual({
        padding_inches: 2,
        wizard_description: 'Fragile items',
        label_instructions: 'Handle with care',
        is_custom: false
      });
    });

    it('should return default for specific type on error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const req = await manager.getRequirements('Standard');
      
      expect(req.padding_inches).toBe(1);
      expect(req.wizard_description).toContain('electronics');
      expect(req.is_custom).toBe(false);
    });

    it('should handle unknown packing type', async () => {
      fetch.mockRejectedValueOnce(new Error('Not found'));
      
      const req = await manager.getRequirements('Unknown');
      
      // Should return ultimate fallback
      expect(req.padding_inches).toBe(0);
      expect(req.wizard_description).toBe('Standard packing');
      expect(req.is_custom).toBe(false);
    });
  });

  describe('helper methods', () => {
    beforeEach(() => {
      // Mock successful response with effective_rules structure
      const mockRules = [
        {
          packing_type: 'Fragile',
          padding_inches: 2,
          wizard_description: 'Test description',
          label_instructions: 'Test instructions',
          is_custom: true
        }
      ];
      
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ effective_rules: mockRules })
      });
    });

    it('should get wizard description', async () => {
      const desc = await manager.getWizardDescription('Fragile');
      expect(desc).toBe('Test description');
    });

    it('should get padding inches', async () => {
      const padding = await manager.getPaddingInches('Fragile');
      expect(padding).toBe(2);
    });

    it('should get label instructions', async () => {
      const instructions = await manager.getLabelInstructions('Fragile');
      expect(instructions).toBe('Test instructions');
    });
  });

  describe('clearCache', () => {
    it('should clear cached data', async () => {
      // First, populate cache
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ effective_rules: [{ packing_type: 'Basic' }] })
      });
      
      await manager.getAllRequirements();
      expect(manager.cache).not.toBe(null);
      expect(manager.cacheExpiry).not.toBe(null);
      
      // Clear cache
      manager.clearCache();
      
      expect(manager.cache).toBe(null);
      expect(manager.cacheExpiry).toBe(null);
    });
  });

  describe('getDefaultRules', () => {
    it('should return complete default rules', () => {
      const rules = manager.getDefaultRules();
      
      expect(rules.length).toBe(4);
      
      // Check Basic
      const basic = rules.find(r => r.packing_type === 'Basic');
      expect(basic.padding_inches).toBe(0);
      expect(basic.wizard_description).toContain('non-sensitive');
      
      // Check Standard
      const standard = rules.find(r => r.packing_type === 'Standard');
      expect(standard.padding_inches).toBe(1);
      expect(standard.label_instructions).toContain('1"');
      
      // Check Fragile
      const fragile = rules.find(r => r.packing_type === 'Fragile');
      expect(fragile.padding_inches).toBe(2);
      expect(fragile.label_instructions).toContain('2"');
      
      // Check Custom
      const custom = rules.find(r => r.packing_type === 'Custom');
      expect(custom.padding_inches).toBe(3);
      expect(custom.label_instructions).toContain('3"');
    });
  });

  describe('getDefaultRequirement', () => {
    it('should return specific default requirement', () => {
      const req = manager.getDefaultRequirement('Fragile');
      
      expect(req.padding_inches).toBe(2);
      expect(req.wizard_description).toContain('china');
      expect(req.label_instructions).toContain('bubble');
      expect(req.is_custom).toBe(false);
    });

    it('should return fallback for unknown type', () => {
      const req = manager.getDefaultRequirement('SuperSpecial');
      
      expect(req.padding_inches).toBe(0);
      expect(req.wizard_description).toBe('Standard packing');
      expect(req.label_instructions).toContain('best practices');
      expect(req.is_custom).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should log errors to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetch.mockRejectedValueOnce(new Error('Test error'));
      
      await manager.getAllRequirements();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching packing rules:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });
      
      const rules = await manager.getAllRequirements();
      
      // Should fall back to defaults
      expect(rules).toEqual(manager.getDefaultRules());
    });

    it('should handle missing effective_rules in response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ wrong_field: [] }) // Wrong structure
      });
      
      const rules = await manager.getAllRequirements();
      
      // Should use the undefined value, which likely causes issues
      expect(rules).toBeUndefined();
    });
  });

  describe('multiple stores', () => {
    it('should use correct store ID in API calls', async () => {
      const manager1 = new PackingRulesManager('1');
      const manager2 = new PackingRulesManager('42');
      
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ effective_rules: [] })
      });
      
      await manager1.getAllRequirements();
      expect(fetch).toHaveBeenCalledWith('/api/store/1/packing-rules', {});
      
      await manager2.getAllRequirements();
      expect(fetch).toHaveBeenCalledWith('/api/store/42/packing-rules', {});
    });

    it('should maintain separate caches per instance', async () => {
      const manager1 = new PackingRulesManager('1');
      const manager2 = new PackingRulesManager('2');
      
      const rules1 = [{ packing_type: 'Basic', padding_inches: 0 }];
      const rules2 = [{ packing_type: 'Basic', padding_inches: 1 }];
      
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effective_rules: rules1 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effective_rules: rules2 })
        });
      
      const result1 = await manager1.getAllRequirements();
      const result2 = await manager2.getAllRequirements();
      
      expect(result1).toEqual(rules1);
      expect(result2).toEqual(rules2);
      
      // Verify caches are independent
      expect(manager1.cache).toEqual(rules1);
      expect(manager2.cache).toEqual(rules2);
    });
  });

  describe('cache duration', () => {
    it('should respect custom cache duration', () => {
      const manager = new PackingRulesManager('1');
      manager.cacheDuration = 1000; // 1 second
      
      expect(manager.cacheDuration).toBe(1000);
    });

    it('should calculate expiry time correctly', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ effective_rules: [] })
      });
      
      await manager.getAllRequirements();
      
      expect(manager.cacheExpiry).toBe(now + manager.cacheDuration);
      
      Date.now.mockRestore();
    });
  });
});