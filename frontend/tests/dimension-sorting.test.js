import { describe, it, expect } from 'vitest';
import { Box } from '../lib/packing.js';

describe('Box Dimension Sorting and open_dim Tracking', () => {
    describe('open_dim tracking after sorting', () => {
        it('should correctly track open_dim when depth is the largest dimension', () => {
            // Original: [10, 8, 15] where index 2 (15) is the open dimension (depth)
            // After sorting: [15, 10, 8] so open_dim should be 0
            const box = Box.NormalBox([10, 8, 15], [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([10, 8, 15]);
            expect(box.dimensions).toEqual([15, 10, 8]); // Sorted largest to smallest
            expect(box.open_dim).toBe(0); // Depth (15) is now at index 0
            expect(box.openLength).toBe(15); // Should be the depth value
        });

        it('should correctly track open_dim when depth is the middle dimension', () => {
            // Original: [10, 8, 9] where index 2 (9) is the open dimension (depth)
            // After sorting: [10, 9, 8] so open_dim should be 1
            const box = Box.NormalBox([10, 8, 9], [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([10, 8, 9]);
            expect(box.dimensions).toEqual([10, 9, 8]); // Sorted largest to smallest
            expect(box.open_dim).toBe(1); // Depth (9) is now at index 1
            expect(box.openLength).toBe(9); // Should be the depth value
        });

        it('should correctly track open_dim when depth is the smallest dimension', () => {
            // Original: [10, 8, 6] where index 2 (6) is the open dimension (depth)
            // After sorting: [10, 8, 6] so open_dim should be 2
            const box = Box.NormalBox([10, 8, 6], [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([10, 8, 6]);
            expect(box.dimensions).toEqual([10, 8, 6]); // Sorted largest to smallest
            expect(box.open_dim).toBe(2); // Depth (6) is now at index 2
            expect(box.openLength).toBe(6); // Should be the depth value
        });

        it('should handle duplicate dimensions correctly', () => {
            // Original: [10, 10, 10] where index 2 is the open dimension
            // All dimensions are equal, but we should still track the original index 2
            const box = Box.NormalBox([10, 10, 10], [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([10, 10, 10]);
            expect(box.dimensions).toEqual([10, 10, 10]); // All equal after sorting
            expect(box.open_dim).toBe(2); // Should track original index 2
            expect(box.openLength).toBe(10);
        });

        it('should handle two equal dimensions with depth being one of them', () => {
            // Original: [12, 8, 12] where index 2 (12) is the open dimension
            // After sorting: [12, 12, 8] - need to track which 12 was originally at index 2
            const box = Box.NormalBox([12, 8, 12], [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([12, 8, 12]);
            expect(box.dimensions).toEqual([12, 12, 8]); // Sorted
            expect(box.open_dim).toBe(1); // The second 12 was originally at index 2
            expect(box.openLength).toBe(12);
        });

        it('should handle two equal dimensions with depth being different', () => {
            // Original: [12, 12, 8] where index 2 (8) is the open dimension
            // After sorting: [12, 12, 8] - depth stays at the end
            const box = Box.NormalBox([12, 12, 8], [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([12, 12, 8]);
            expect(box.dimensions).toEqual([12, 12, 8]); // Sorted
            expect(box.open_dim).toBe(2); // Depth (8) remains at index 2
            expect(box.openLength).toBe(8);
        });
    });

    describe('CustomBox with explicit open_dim', () => {
        it('should handle CustomBox with open_dim 0', () => {
            // Original: [15, 10, 8] where index 0 (15) is the open dimension
            // After sorting: [15, 10, 8] so open_dim should remain 0
            const box = new Box([15, 10, 8], 0, [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([15, 10, 8]);
            expect(box.dimensions).toEqual([15, 10, 8]);
            expect(box.open_dim).toBe(0);
            expect(box.openLength).toBe(15);
        });

        it('should handle CustomBox with open_dim 1', () => {
            // Original: [10, 15, 8] where index 1 (15) is the open dimension
            // After sorting: [15, 10, 8] so open_dim should be 0 (where 15 ended up)
            const box = new Box([10, 15, 8], 1, [0, 0, 0, 0]);
            
            expect(box.originalDimensions).toEqual([10, 15, 8]);
            expect(box.dimensions).toEqual([15, 10, 8]);
            expect(box.open_dim).toBe(0); // 15 is now at index 0
            expect(box.openLength).toBe(15);
        });
    });

    describe('Constraint calculations after sorting', () => {
        it('should calculate correct constraints when depth is largest', () => {
            // Original: [10, 8, 15] where 15 is depth
            // After sorting: [15, 10, 8] with open_dim = 0
            const box = Box.NormalBox([10, 8, 15], [0, 0, 0, 0]);
            
            expect(box.open_dim).toBe(0);
            expect(box.largerConstraint).toBe(10); // Second largest
            expect(box.smallerConstraint).toBe(8); // Smallest
            expect(box.flapLength).toBe(4); // smallerConstraint / 2
        });

        it('should calculate correct constraints when depth is middle', () => {
            // Original: [10, 8, 9] where 9 is depth
            // After sorting: [10, 9, 8] with open_dim = 1
            const box = Box.NormalBox([10, 8, 9], [0, 0, 0, 0]);
            
            expect(box.open_dim).toBe(1);
            expect(box.largerConstraint).toBe(10); // Largest
            expect(box.smallerConstraint).toBe(8); // Smallest
            expect(box.flapLength).toBe(4); // smallerConstraint / 2
        });

        it('should calculate correct constraints when depth is smallest', () => {
            // Original: [10, 8, 6] where 6 is depth
            // After sorting: [10, 8, 6] with open_dim = 2
            const box = Box.NormalBox([10, 8, 6], [0, 0, 0, 0]);
            
            expect(box.open_dim).toBe(2);
            expect(box.largerConstraint).toBe(10); // Largest
            expect(box.smallerConstraint).toBe(8); // Second largest
            expect(box.flapLength).toBe(4); // smallerConstraint / 2
        });
    });
});