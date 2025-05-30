import { describe, it, expect } from 'vitest';
import { LabelGenerator } from '../components/label-generator.js';

describe('LabelGenerator', () => {
  describe('countInstructionLines', () => {
    it('should count single line correctly', () => {
      const result = LabelGenerator.countInstructionLines('Single line instruction');
      expect(result).toBe(1);
    });

    it('should count empty lines', () => {
      const result = LabelGenerator.countInstructionLines('Line 1\n\nLine 3');
      expect(result).toBe(3);
    });

    it('should wrap long lines at 40 characters', () => {
      const longLine = 'This is a very long instruction line that should wrap because it exceeds forty characters';
      const result = LabelGenerator.countInstructionLines(longLine);
      expect(result).toBe(3); // 90 chars / 40 = 2.25, rounds up to 3
    });

    it('should account for bullet points taking extra space', () => {
      const bulletLine = '- This is a bullet point that spans exactly forty chars!';
      const result = LabelGenerator.countInstructionLines(bulletLine);
      expect(result).toBe(2); // 57 chars + 3 extra = 60 effective chars / 40 = 1.5, rounds up to 2
    });

    it('should add buffer for 5+ lines', () => {
      const multiLine = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const result = LabelGenerator.countInstructionLines(multiLine);
      expect(result).toBe(6); // 5 lines + 1 buffer
    });

    it('should handle complex multi-line instructions', () => {
      const instructions = `- Place product in center of box
- Add 2" bubble wrap on all sides
- Fill remaining voids with packing peanuts or air pillows
- Ensure product cannot move when shaken
- Seal with reinforced tape`;
      
      const result = LabelGenerator.countInstructionLines(instructions);
      // Line 1: 33 chars + 3 = 36 (1 line)
      // Line 2: 34 chars + 3 = 37 (1 line)
      // Line 3: 57 chars + 3 = 60 (2 lines)
      // Line 4: 40 chars + 3 = 43 (2 lines)
      // Line 5: 30 chars + 3 = 33 (1 line)
      // Total: 7 lines + 1 buffer = 8
      expect(result).toBe(8);
    });
  });

  describe('calculateBoxInfoHeight', () => {
    it('should return correct height for box info section', () => {
      const height = LabelGenerator.calculateBoxInfoHeight();
      // 3 lines × 17px + 15px margin
      expect(height).toBe(66);
    });
  });

  describe('calculateInstructionsHeight', () => {
    it('should calculate correct height for 1 instruction line', () => {
      const height = LabelGenerator.calculateInstructionsHeight(1);
      // Header: 17px + 5px margin = 22px
      // Box: 1×16px + 16px padding + 2px border = 34px
      // Bottom margin: 15px
      // Total: 22 + 34 + 15 = 71px
      expect(height).toBe(71);
    });

    it('should calculate correct height for multiple instruction lines', () => {
      const height = LabelGenerator.calculateInstructionsHeight(5);
      // Header: 22px
      // Box: 5×16px + 16px + 2px = 98px
      // Bottom margin: 15px
      // Total: 22 + 98 + 15 = 135px
      expect(height).toBe(135);
    });
  });

  describe('calculateLayout', () => {
    it('should fit content without floorplan', () => {
      const instructions = 'Simple instruction';
      const result = LabelGenerator.calculateLayout(instructions, null);
      
      expect(result.fits).toBe(true);
      expect(result.calculations.floorplanHeightNeeded).toBe(0);
    });

    it('should fit small floorplan on single page', () => {
      const instructions = 'Simple instruction';
      const floorplanDims = { width: 800, height: 400 }; // 2:1 aspect ratio
      
      const result = LabelGenerator.calculateLayout(instructions, floorplanDims);
      
      expect(result.fits).toBe(true);
      expect(result.calculations.floorplanHeightNeeded).toBe(398); // 792 × 0.5 + 2px border
    });

    it('should require two pages for large floorplan', () => {
      const instructions = `- Long instruction line that will wrap multiple times
- Another long instruction that continues on and on
- Yet another instruction with lots of detail
- More packing instructions here
- Final instruction line`;
      
      const floorplanDims = { width: 800, height: 1200 }; // 2:3 aspect ratio (tall)
      
      const result = LabelGenerator.calculateLayout(instructions, floorplanDims);
      
      expect(result.fits).toBe(false);
      expect(result.calculations.floorplanHeightNeeded).toBe(1190); // 792 × 1.5 + 2px border
    });

    it('should calculate correct remaining space', () => {
      const instructions = 'Short';
      const result = LabelGenerator.calculateLayout(instructions, null);
      
      const C = LabelGenerator.CONSTANTS;
      const usableHeight = C.PAGE_HEIGHT_PX - C.TOP_MARGIN - C.BOTTOM_PADDING;
      const boxInfoHeight = 66;
      const instructionsHeight = 71;
      const locationHeaderHeight = 27;
      const expectedRemaining = usableHeight - boxInfoHeight - instructionsHeight - locationHeaderHeight;
      
      expect(result.calculations.remainingForFloorplan).toBe(expectedRemaining);
    });
  });

  describe('generateBoxInfo', () => {
    it('should generate correct box info HTML', () => {
      const data = {
        box: {
          model: 'A1',
          dimensions: [12, 10, 8]
        },
        result: {
          strategy: 'Standard packing',
          price: 45.99
        },
        boxPrice: 5.99
      };
      
      const html = LabelGenerator.generateBoxInfo(data);
      
      expect(html).toContain('Box: A1 (12"×10"×8")');
      expect(html).toContain('Strategy: Standard packing');
      expect(html).toContain('Total: $45.99 Box: $5.99');
    });

    it('should handle null box price', () => {
      const data = {
        box: {
          model: 'B2',
          dimensions: [10, 8, 6]
        },
        result: {
          strategy: 'Basic packing',
          price: 25.00
        },
        boxPrice: null
      };
      
      const html = LabelGenerator.generateBoxInfo(data);
      
      expect(html).toContain('Total: $25.00');
      expect(html).not.toContain('Box: $');
    });
  });

  describe('generateInstructionsSection', () => {
    it('should generate instructions HTML', () => {
      const instructions = '- Test instruction\n- Another instruction';
      const html = LabelGenerator.generateInstructionsSection(instructions);
      
      expect(html).toContain('<h3>Packing Instructions</h3>');
      expect(html).toContain('<pre>- Test instruction\n- Another instruction</pre>');
    });
  });

  describe('generateFloorplanSection', () => {
    it('should generate floorplan HTML with location marker', () => {
      const floorplan = {
        imageUrl: 'blob:http://example.com/123',
        location: {
          coords: [0.25, 0.75]
        }
      };
      
      const html = LabelGenerator.generateFloorplanSection(floorplan, false);
      
      expect(html).toContain('Box Location');
      expect(html).toContain('src="blob:http://example.com/123"');
      expect(html).toContain('left: 25%');
      expect(html).toContain('top: 75%');
      expect(html).not.toContain('force-page-break');
    });

    it('should add page break class when needed', () => {
      const floorplan = {
        imageUrl: 'blob:http://example.com/456',
        location: {
          coords: [0.5, 0.5]
        }
      };
      
      const html = LabelGenerator.generateFloorplanSection(floorplan, true);
      
      expect(html).toContain('force-page-break');
    });
  });

  describe('generateLabelContent', () => {
    const mockData = {
      box: {
        model: 'C3',
        dimensions: [14, 12, 10]
      },
      result: {
        strategy: 'Fragile packing',
        price: 65.99
      },
      boxPrice: 7.99
    };

    it('should generate single page content when everything fits', () => {
      const instructions = 'Simple instructions';
      const floorplan = {
        imageUrl: 'blob:http://example.com/789',
        location: { coords: [0.3, 0.7] }
      };
      
      const html = LabelGenerator.generateLabelContent(
        mockData,
        instructions,
        floorplan,
        false // shouldPageBreak
      );
      
      expect(html).toContain('<div class="page1">');
      expect(html).not.toContain('<div class="page2">');
      expect(html).toContain('Box: C3');
      expect(html).toContain('Simple instructions');
      expect(html).toContain('Box Location');
    });

    it('should generate two-page content when needed', () => {
      const instructions = 'Long instructions that take up space';
      const floorplan = {
        imageUrl: 'blob:http://example.com/abc',
        location: { coords: [0.5, 0.5] }
      };
      
      const html = LabelGenerator.generateLabelContent(
        mockData,
        instructions,
        floorplan,
        true // shouldPageBreak
      );
      
      expect(html).toContain('<div class="page1">');
      expect(html).toContain('<div class="page2">');
      
      // First page should have box info and instructions
      const page1Match = html.match(/<div class="page1">([\s\S]*?)<\/div>/);
      expect(page1Match[1]).toContain('Box: C3');
      expect(page1Match[1]).toContain('Long instructions');
      expect(page1Match[1]).not.toContain('Box Location');
      
      // Second page should have only floorplan
      const page2Match = html.match(/<div class="page2">([\s\S]*?)<\/div>/);
      expect(page2Match[1]).toContain('Box Location');
    });

    it('should handle no floorplan', () => {
      const instructions = 'Instructions only';
      
      const html = LabelGenerator.generateLabelContent(
        mockData,
        instructions,
        null,
        false
      );
      
      expect(html).toContain('Box: C3');
      expect(html).toContain('Instructions only');
      expect(html).not.toContain('Box Location');
      expect(html).not.toContain('<div class="page2">');
    });
  });

  describe('generateDocument', () => {
    it('should generate complete HTML document', () => {
      const content = '<div class="page1">Test content</div>';
      const title = 'Test Label';
      
      const html = LabelGenerator.generateDocument(content, title);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test Label</title>');
      expect(html).toContain('size: 4in 6in');
      expect(html).toContain('margin: 0');
      expect(html).toContain('<body><div class="page1">Test content</div></body>');
      expect(html).toContain('font-family: \'Roboto Mono\', \'Consolas\', \'Monaco\', monospace;');
    });
  });

  describe('Constants', () => {
    it('should have correct page dimensions', () => {
      const C = LabelGenerator.CONSTANTS;
      
      expect(C.PAGE_WIDTH_INCHES).toBe(4);
      expect(C.PAGE_HEIGHT_INCHES).toBe(6);
      expect(C.DPI).toBe(203);
      expect(C.PAGE_WIDTH_PX).toBe(812);
      expect(C.PAGE_HEIGHT_PX).toBe(1218);
    });

    it('should have correct content dimensions', () => {
      const C = LabelGenerator.CONSTANTS;
      
      expect(C.CONTENT_WIDTH).toBe(792); // 812 - 2×10 padding
      expect(C.CHARS_PER_LINE).toBe(40);
    });
  });
});