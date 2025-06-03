/**
 * Label Generator Component
 * Handles all logic for generating Zebra printer labels (4"×6" at 203 DPI)
 */

export class LabelGenerator {
  static CONSTANTS = {
    // Physical dimensions
    PAGE_WIDTH_INCHES: 4,
    PAGE_HEIGHT_INCHES: 6,
    DPI: 203,
    
    // Label orientation
    ROTATE_LABELS: true,  // Set to false to print labels right-side up
    
    // Calculated pixel dimensions
    PAGE_WIDTH_PX: 812,  // 4" × 203 DPI
    PAGE_HEIGHT_PX: 1218, // 6" × 203 DPI
    
    // Page layout
    TOP_MARGIN: 14,
    BOTTOM_PADDING: 10,
    SIDE_PADDING: 10,
    
    // Content dimensions
    CONTENT_WIDTH: 792,  // PAGE_WIDTH_PX - (2 × SIDE_PADDING)
    
    // Text heights
    LINE_HEIGHT_HEADER: 17,
    LINE_HEIGHT_INSTRUCTION: 16,
    
    // Instruction wrapping
    CHARS_PER_LINE: 40,
    INSTRUCTION_PADDING: 16,
    INSTRUCTION_BORDER: 2,
    
    // Spacing
    BOX_INFO_MARGIN_BOTTOM: 15,
    INSTRUCTIONS_MARGIN_BOTTOM: 15,
    H3_MARGIN: 5,
    LOCATION_H3_MARGIN: 10,
    
    // Safety
    FLOORPLAN_SAFETY_BUFFER: 100,
    FLOORPLAN_BORDER: 2
  };

  /**
   * Calculate if content fits on a single label
   * @param {string} instructions - Multi-line packing instructions
   * @param {Object} floorplanDimensions - {width, height} of floorplan image
   * @returns {Object} {fits: boolean, calculations: {...}}
   */
  static calculateLayout(instructions, floorplanDimensions) {
    const C = this.CONSTANTS;
    
    // Calculate usable page height
    const usablePageHeight = C.PAGE_HEIGHT_PX - C.TOP_MARGIN - C.BOTTOM_PADDING;
    
    // Count instruction lines with wrapping
    const instructionLineCount = this.countInstructionLines(instructions);
    
    // Calculate heights of all elements
    const boxInfoHeight = this.calculateBoxInfoHeight();
    const instructionsHeight = this.calculateInstructionsHeight(instructionLineCount);
    const locationHeaderHeight = C.LINE_HEIGHT_HEADER + C.LOCATION_H3_MARGIN;
    
    // Total "top half" height
    const totalTopHalfHeight = boxInfoHeight + instructionsHeight + locationHeaderHeight;
    
    // Calculate remaining space for floorplan
    const remainingForFloorplan = usablePageHeight - totalTopHalfHeight;
    
    // Calculate floorplan height at full width if provided
    let floorplanHeightNeeded = 0;
    if (floorplanDimensions) {
      const aspectRatio = floorplanDimensions.height / floorplanDimensions.width;
      const printHeight = Math.round(C.CONTENT_WIDTH * aspectRatio);
      floorplanHeightNeeded = printHeight + C.FLOORPLAN_BORDER;
    }
    
    // Apply safety buffer
    const remainingWithBuffer = remainingForFloorplan - C.FLOORPLAN_SAFETY_BUFFER;
    
    // Decision
    const fits = !floorplanDimensions || (floorplanHeightNeeded <= remainingWithBuffer);
    
    return {
      fits,
      calculations: {
        usablePageHeight,
        instructionLineCount,
        boxInfoHeight,
        instructionsHeight,
        locationHeaderHeight,
        totalTopHalfHeight,
        remainingForFloorplan,
        floorplanHeightNeeded,
        remainingWithBuffer
      }
    };
  }

  /**
   * Count total lines including wrapping for monospace font
   * @param {string} instructions - Multi-line instructions
   * @returns {number} Total line count
   */
  static countInstructionLines(instructions) {
    const C = this.CONSTANTS;
    const rawLines = instructions.split('\n');
    let totalLines = 0;
    
    rawLines.forEach((line) => {
      if (line.length === 0) {
        totalLines += 1; // Empty line
      } else {
        // Account for bullet points
        let effectiveLength = line.length;
        if (line.trim().startsWith('- ')) {
          effectiveLength += 3; // Bullet takes extra space
        }
        
        // Calculate wrapped lines
        const wrappedLines = Math.ceil(effectiveLength / C.CHARS_PER_LINE);
        totalLines += wrappedLines;
      }
    });
    
    // Add buffer for rendering differences
    if (totalLines >= 5) {
      totalLines += 1;
    }
    
    return totalLines;
  }

  /**
   * Calculate box info section height
   * @returns {number} Total height in pixels
   */
  static calculateBoxInfoHeight() {
    const C = this.CONSTANTS;
    return (3 * C.LINE_HEIGHT_HEADER) + C.BOX_INFO_MARGIN_BOTTOM;
  }

  /**
   * Calculate instructions section height
   * @param {number} lineCount - Number of instruction lines
   * @returns {number} Total height in pixels
   */
  static calculateInstructionsHeight(lineCount) {
    const C = this.CONSTANTS;
    const headerHeight = C.LINE_HEIGHT_HEADER + C.H3_MARGIN;
    const boxHeight = (lineCount * C.LINE_HEIGHT_INSTRUCTION) + 
                      C.INSTRUCTION_PADDING + 
                      C.INSTRUCTION_BORDER;
    return headerHeight + boxHeight + C.INSTRUCTIONS_MARGIN_BOTTOM;
  }

  /**
   * Generate label HTML content
   * @param {Object} data - Recommendation data
   * @param {string} instructions - Packing instructions
   * @param {Object} floorplan - {imageUrl, location: {coords: [x, y]}}
   * @param {boolean} shouldPageBreak - Whether to split across two pages
   * @returns {string} HTML content for label
   */
  static generateLabelContent(data, instructions, floorplan, shouldPageBreak) {
    const boxInfo = this.generateBoxInfo(data);
    const instructionsHtml = this.generateInstructionsSection(instructions);
    const floorplanHtml = floorplan ? this.generateFloorplanSection(floorplan, shouldPageBreak) : '';
    
    if (shouldPageBreak && floorplan) {
      // Split across two pages
      return `
        <div class="page1">
          ${boxInfo}
          ${instructionsHtml}
        </div>
        
        <div class="page2">
          ${floorplanHtml}
        </div>
      `;
    } else {
      // Single page
      return `
        <div class="page1">
          ${boxInfo}
          ${instructionsHtml}
          ${floorplanHtml}
        </div>
      `;
    }
  }

  /**
   * Generate box information HTML
   * @param {Object} data - Recommendation data
   * @returns {string} HTML
   */
  static generateBoxInfo(data) {
    const boxPrice = data.boxPrice !== null ? ` Box: $${data.boxPrice.toFixed(2)}` : '';
    return `
      <strong>Box: ${data.box.model} (${data.box.dimensions[0]}"×${data.box.dimensions[1]}"×${data.box.dimensions[2]}")</strong><br>
      Strategy: ${data.result.strategy}<br>
      <strong>Total: $${data.result.price.toFixed(2)}${boxPrice}</strong>
      <br><br>
    `.trim();
  }

  /**
   * Generate instructions section HTML
   * @param {string} instructions - Packing instructions
   * @returns {string} HTML
   */
  static generateInstructionsSection(instructions) {
    return `
      <h3>Packing Instructions</h3>
      <pre>${instructions}</pre>
    `.trim();
  }

  /**
   * Generate floorplan section HTML
   * @param {Object} floorplan - {imageUrl, location: {coords: [x, y]}}
   * @param {boolean} forcePageBreak - Add page break class
   * @returns {string} HTML
   */
  static generateFloorplanSection(floorplan, forcePageBreak) {
    const pageBreakClass = forcePageBreak ? ' force-page-break' : '';
    const xPercent = floorplan.location.coords[0] * 100;
    const yPercent = floorplan.location.coords[1] * 100;
    
    return `
      <div class="print-floorplan-section${pageBreakClass}">
        <h3>Box Location</h3>
        <div class="floorplan-wrapper">
          <img src="${floorplan.imageUrl}" class="floorplan-image">
          <div class="location-marker-print" style="left: ${xPercent}%; top: ${yPercent}%;">
            <span class="marker-x">X</span>
          </div>
        </div>
      </div>
    `.trim();
  }

  /**
   * Generate complete label document HTML
   * @param {string} content - Label content HTML
   * @param {string} title - Document title
   * @returns {string} Complete HTML document
   */
  static generateDocument(content, title) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            /* Force 4x6 page size */
            @page {
              size: 4in 6in;
              margin: 0;
            }
            
            @media print {
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                margin: 0;
                padding: 0;
              }
              
              /* Each page is exactly one label */
              .page1, .page2 {
                width: 4in;
                height: 6in;
                padding: 14px 10px 10px 10px;
                page-break-after: always;
                overflow: hidden;
                ${this.CONSTANTS.ROTATE_LABELS ? `
                /* Rotate entire label 180 degrees */
                transform: rotate(180deg);
                transform-origin: center center;` : ''}
              }
              
              /* Basic text styles */
              body {
                font-family: 'Roboto', 'Open Sans', Arial, sans-serif;
                font-size: 10pt;
              }
              
              /* Keep monospace for instructions */
              pre {
                font-family: 'Roboto Mono', 'Consolas', 'Monaco', monospace;
                white-space: pre-wrap;
              }
              
              /* Simple margins */
              h3 { margin-bottom: 10px; }
              img { max-width: 100%; }
              
              /* Floorplan positioning */
              .floorplan-wrapper {
                position: relative;
                width: 100%;
              }
              
              .floorplan-image {
                width: 100%;
                height: auto;
                border: 1px solid #000;
              }
              
              /* Location marker for printing */
              .location-marker-print {
                position: absolute;
                transform: translate(-50%, -50%);
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              
              .location-marker-print .marker-x {
                font-size: 36pt;
                font-weight: bold;
                color: #000;
                /* White outline for visibility */
                text-shadow: 
                  -2px -2px 0 #fff,
                  2px -2px 0 #fff,
                  -2px 2px 0 #fff,
                  2px 2px 0 #fff,
                  -3px 0 0 #fff,
                  3px 0 0 #fff,
                  0 -3px 0 #fff,
                  0 3px 0 #fff;
              }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `.trim();
  }
}