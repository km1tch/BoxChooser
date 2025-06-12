// Simple floorplan drawing tool for creating store layouts
export class FloorplanCreator {
  constructor(container, options = {}) {
    this.container =
      typeof container === "string"
        ? document.querySelector(container)
        : container;

    // Calculate responsive width based on container
    const containerWidth = this.container.offsetWidth || 1200;
    const maxWidth = Math.min(containerWidth - 40, 1000); // 40px for padding

    this.options = {
      width: maxWidth,
      height: 600,
      gridSize: 20,
      showGrid: true,
      onSave: null,
      ...options,
    };

    this.elements = [];
    this.selectedElement = null;
    this.isDragging = false;
    this.isDrawing = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.drawMode = "select";
    this.currentDrawing = null;
    this.history = [];
    this.historyIndex = -1;

    this.init();
  }

  init() {
    this.render();
    this.setupCanvas();
    this.attachEventListeners();
    this.drawGrid();
  }

  render() {
    this.container.innerHTML = `
            <div class="floorplan-creator">
                <div class="creator-toolbar" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="tool-group">
                        <button class="tool-btn active" data-tool="select" title="Select/Move">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                            </svg>
                        </button>
                        <button class="tool-btn" data-tool="wall" title="Draw Wall">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 12h18M3 6h18M3 18h18"/>
                            </svg>
                        </button>
                        <button class="tool-btn" data-tool="rack" title="Add Rack">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <line x1="3" y1="9" x2="21" y2="9"/>
                                <line x1="3" y1="15" x2="21" y2="15"/>
                            </svg>
                        </button>
                        <button class="tool-btn" data-tool="table" title="Add Packing Table">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="4" y="6" width="16" height="12"/>
                                <line x1="4" y1="10" x2="20" y2="10"/>
                            </svg>
                        </button>
                        <button class="tool-btn" data-tool="desk" title="Add Desk">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="8" width="18" height="10"/>
                                <line x1="8" y1="18" x2="8" y2="21"/>
                                <line x1="16" y1="18" x2="16" y2="21"/>
                            </svg>
                        </button>
                        <button class="tool-btn" data-tool="text" title="Add Text Label">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="4 7 4 4 20 4 20 7"/>
                                <line x1="9" y1="20" x2="15" y2="20"/>
                                <line x1="12" y1="4" x2="12" y2="20"/>
                            </svg>
                        </button>
                        <button class="action-btn" id="undo-btn" title="Undo">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 10h11a4 4 0 0 1 0 8h-3"/>
                                <polyline points="3 10 7 6 3 10 7 14"/>
                            </svg>
                        </button>
                        <button class="action-btn" id="redo-btn" title="Redo">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10h-11a4 4 0 0 0 0 8h3"/>
                                <polyline points="21 10 17 6 21 10 17 14"/>
                            </svg>
                        </button>
                        <button class="action-btn" id="clear-btn" title="Clear All">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="tool-group" style="width: auto; display: flex; align-items: center; gap: 10px;">
                        <label class="grid-toggle" style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="grid-toggle" checked>
                            <span>Grid</span>
                        </label>
                        <button class="btn btn-primary" id="save-btn">Save Floorplan</button>
                    </div>
                </div>
                
                <div class="canvas-container">
                    <canvas id="floorplan-canvas"></canvas>
                    <div class="element-properties" style="display: none;">
                        <h4>Properties</h4>
                        <label>
                            Text:
                            <input type="text" id="element-text" placeholder="Label">
                        </label>
                        <button class="btn btn-sm btn-danger" id="delete-element">Delete</button>
                    </div>
                </div>
            
            </div>
        `;
  }

  setupCanvas() {
    this.canvas = this.container.querySelector("#floorplan-canvas");
    this.ctx = this.canvas.getContext("2d");

    // Set canvas size
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;

    // Set canvas style
    this.canvas.style.border = "2px solid #ddd";
    this.canvas.style.cursor = "crosshair";
  }

  attachEventListeners() {
    // Tool selection
    this.container.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.container
          .querySelectorAll(".tool-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.drawMode = btn.dataset.tool;
        this.updateCursor();
      });
    });

    // Canvas events
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));

    // Touch events for mobile
    this.canvas.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this)
    );
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));

    // Action buttons
    this.container
      .querySelector("#undo-btn")
      .addEventListener("click", () => this.undo());
    this.container
      .querySelector("#redo-btn")
      .addEventListener("click", () => this.redo());
    this.container
      .querySelector("#clear-btn")
      .addEventListener("click", () => this.clear());
    this.container
      .querySelector("#save-btn")
      .addEventListener("click", () => this.save());

    // Grid toggle
    this.container
      .querySelector("#grid-toggle")
      .addEventListener("change", (e) => {
        this.options.showGrid = e.target.checked;
        this.redraw();
      });

    // Delete button
    const deleteBtn = this.container.querySelector("#delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        if (this.selectedElement) {
          this.deleteElement(this.selectedElement);
        }
      });
    }

    // Keyboard events
    document.addEventListener("keydown", (e) => {
      if (e.key === "Delete" && this.selectedElement) {
        this.deleteElement(this.selectedElement);
      }
    });
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.drawMode === "select") {
      // Check if clicking on a resize handle
      if (this.selectedElement) {
        const handle = this.getResizeHandle(x, y);
        if (handle) {
          this.isResizing = true;
          this.resizeHandle = handle;
          return;
        }
      }

      // Check if clicking on an element
      const element = this.getElementAt(x, y);
      if (element) {
        this.selectedElement = element;
        this.isDragging = true;
        this.dragOffset = {
          x: x - element.x,
          y: y - element.y,
        };
        if (element.type === "wall") {
          this.dragOffset = {
            x: x - element.x1,
            y: y - element.y1,
          };
        }
      } else {
        this.selectedElement = null;
      }
    } else {
      // Start drawing new element
      this.isDrawing = true;
      const snapped = this.snapToGrid(x, y);

      if (this.drawMode === "wall") {
        this.currentDrawing = {
          type: "wall",
          x1: snapped.x,
          y1: snapped.y,
          x2: snapped.x,
          y2: snapped.y,
        };
      } else if (this.drawMode === "text") {
        // For text tool, immediately create text element and show input
        this.createTextAtPosition(snapped.x, snapped.y);
        this.isDrawing = false; // Don't continue with drag behavior
        return;
      } else {
        this.currentDrawing = {
          type: this.drawMode,
          x: snapped.x,
          y: snapped.y,
          width: 0,
          height: 0,
        };
      }
    }

    this.redraw();
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isResizing && this.selectedElement) {
      const snapped = this.snapToGrid(x, y);

      if (this.selectedElement.type === "wall") {
        if (this.resizeHandle === "start") {
          this.selectedElement.x1 = snapped.x;
          this.selectedElement.y1 = snapped.y;
        } else {
          this.selectedElement.x2 = snapped.x;
          this.selectedElement.y2 = snapped.y;
        }
      } else if (this.selectedElement.type !== "text") {
        const minSize = 40;

        switch (this.resizeHandle) {
          case "se":
            this.selectedElement.width = Math.max(
              minSize,
              snapped.x - this.selectedElement.x
            );
            this.selectedElement.height = Math.max(
              minSize,
              snapped.y - this.selectedElement.y
            );
            break;
          case "sw":
            const newWidth =
              this.selectedElement.x + this.selectedElement.width - snapped.x;
            if (newWidth >= minSize) {
              this.selectedElement.x = snapped.x;
              this.selectedElement.width = newWidth;
            }
            this.selectedElement.height = Math.max(
              minSize,
              snapped.y - this.selectedElement.y
            );
            break;
          case "ne":
            this.selectedElement.width = Math.max(
              minSize,
              snapped.x - this.selectedElement.x
            );
            const newHeight =
              this.selectedElement.y + this.selectedElement.height - snapped.y;
            if (newHeight >= minSize) {
              this.selectedElement.y = snapped.y;
              this.selectedElement.height = newHeight;
            }
            break;
          case "nw":
            const newW =
              this.selectedElement.x + this.selectedElement.width - snapped.x;
            const newH =
              this.selectedElement.y + this.selectedElement.height - snapped.y;
            if (newW >= minSize) {
              this.selectedElement.x = snapped.x;
              this.selectedElement.width = newW;
            }
            if (newH >= minSize) {
              this.selectedElement.y = snapped.y;
              this.selectedElement.height = newH;
            }
            break;
        }
      }

      this.redraw();
    } else if (this.isDragging && this.selectedElement) {
      const snapped = this.snapToGrid(
        x - this.dragOffset.x,
        y - this.dragOffset.y
      );

      if (this.selectedElement.type === "wall") {
        const dx = snapped.x - this.selectedElement.x1;
        const dy = snapped.y - this.selectedElement.y1;
        this.selectedElement.x1 = snapped.x;
        this.selectedElement.y1 = snapped.y;
        this.selectedElement.x2 += dx;
        this.selectedElement.y2 += dy;
      } else {
        this.selectedElement.x = snapped.x;
        this.selectedElement.y = snapped.y;
      }

      this.redraw();
    } else if (this.isDrawing && this.currentDrawing) {
      const snapped = this.snapToGrid(x, y);

      if (this.currentDrawing.type === "wall") {
        this.currentDrawing.x2 = snapped.x;
        this.currentDrawing.y2 = snapped.y;
      } else {
        this.currentDrawing.width = snapped.x - this.currentDrawing.x;
        this.currentDrawing.height = snapped.y - this.currentDrawing.y;
      }
      this.redraw();
    }
  }

  handleMouseUp(e) {
    if (this.isDrawing && this.currentDrawing) {
      if (this.currentDrawing.type === "wall") {
        if (
          Math.abs(this.currentDrawing.x2 - this.currentDrawing.x1) > 5 ||
          Math.abs(this.currentDrawing.y2 - this.currentDrawing.y1) > 5
        ) {
          this.addElement(this.currentDrawing);
        }
      } else {
        // Different minimum sizes for different elements
        const minSize = this.currentDrawing.type === "text" ? 10 : 20;

        if (
          Math.abs(this.currentDrawing.width) > minSize &&
          Math.abs(this.currentDrawing.height) > minSize
        ) {
          // Normalize negative dimensions
          if (this.currentDrawing.width < 0) {
            this.currentDrawing.x += this.currentDrawing.width;
            this.currentDrawing.width = -this.currentDrawing.width;
          }
          if (this.currentDrawing.height < 0) {
            this.currentDrawing.y += this.currentDrawing.height;
            this.currentDrawing.height = -this.currentDrawing.height;
          }

          // Text is now handled by createTextAtPosition, so skip text type here
          if (this.currentDrawing.type !== "text") {
            this.addElement(this.currentDrawing);
          }
        }
      }
    }

    if (this.isDragging || this.isResizing) {
      this.saveState();
    }

    this.isDragging = false;
    this.isDrawing = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.currentDrawing = null;
    this.redraw();
  }

  handleDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const element = this.getElementAt(x, y);
    if (element && element.type === "text") {
      // Create inline editor for text
      const input = document.createElement("input");
      input.type = "text";
      input.value = element.text;
      input.style.position = "fixed";

      // Get canvas position relative to the viewport
      const canvasRect = this.canvas.getBoundingClientRect();
      input.style.left = `${canvasRect.left + element.x}px`;
      input.style.top = `${canvasRect.top + element.y - 5}px`;
      input.style.fontSize = "14px";
      input.style.fontFamily = "Arial";
      input.style.fontWeight = "bold";
      input.style.border = "2px solid #2196F3";
      input.style.padding = "2px 4px";
      input.style.background = "white";
      input.style.zIndex = "10000";
      input.style.minWidth = "20px";

      // Measure initial text width
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.font = "bold 14px Arial";
      const textWidth = tempCtx.measureText(element.text + "M").width;
      input.style.width = `${textWidth + 8}px`;

      document.body.appendChild(input);
      input.focus();
      input.select();

      // Add dynamic resizing for edit too
      input.addEventListener("input", () => {
        const newTextWidth = tempCtx.measureText(input.value + "M").width;
        input.style.width = `${Math.max(20, newTextWidth + 8)}px`;
      });

      const updateText = () => {
        const newText = input.value.trim();
        if (newText && newText !== element.text) {
          element.text = newText;
          this.redraw();
          this.saveState();
        }
        input.remove();
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          updateText();
        } else if (e.key === "Escape") {
          e.preventDefault();
          input.remove();
        }
      });

      input.addEventListener("blur", updateText);
    }
  }

  // Touch event handlers
  handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.canvas.dispatchEvent(mouseEvent);
  }

  handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.canvas.dispatchEvent(mouseEvent);
  }

  handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent("mouseup", {});
    this.canvas.dispatchEvent(mouseEvent);
  }

  snapToGrid(x, y) {
    if (!this.options.showGrid) return { x, y };

    return {
      x: Math.round(x / this.options.gridSize) * this.options.gridSize,
      y: Math.round(y / this.options.gridSize) * this.options.gridSize,
    };
  }

  addElement(element) {
    this.elements.push(element);
    this.saveState();
    this.redraw();
  }

  deleteElement(element) {
    const index = this.elements.indexOf(element);
    if (index > -1) {
      this.elements.splice(index, 1);
      this.selectedElement = null;
      this.saveState();
      this.redraw();
    }
  }

  getElementAt(x, y) {
    // Check in reverse order so top elements are selected first
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const element = this.elements[i];

      if (element.type === "wall") {
        // Check if point is near the line
        const dist = this.pointToLineDistance(
          x,
          y,
          element.x1,
          element.y1,
          element.x2,
          element.y2
        );
        if (dist < 5) return element;
      } else if (element.type === "text") {
        if (element.width && element.height) {
          // Text box with dimensions
          if (
            x >= element.x &&
            x <= element.x + element.width &&
            y >= element.y &&
            y <= element.y + element.height
          ) {
            return element;
          }
        } else {
          // Legacy single-line text
          const textWidth = this.ctx.measureText(element.text).width;
          if (
            x >= element.x - 5 &&
            x <= element.x + textWidth + 5 &&
            y >= element.y - 20 &&
            y <= element.y + 5
          ) {
            return element;
          }
        }
      } else {
        // Rectangle-based elements
        if (
          x >= element.x &&
          x <= element.x + element.width &&
          y >= element.y &&
          y <= element.y + element.height
        ) {
          return element;
        }
      }
    }
    return null;
  }

  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  drawGrid() {
    if (!this.options.showGrid) return;

    this.ctx.strokeStyle = "#ddd";
    this.ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x <= this.canvas.width; x += this.options.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.canvas.height; y += this.options.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  drawElement(element) {
    this.ctx.save();

    const isSelected = element === this.selectedElement;

    switch (element.type) {
      case "wall":
        this.ctx.strokeStyle = isSelected ? "#666" : "#000";
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(element.x1, element.y1);
        this.ctx.lineTo(element.x2, element.y2);
        this.ctx.stroke();
        break;

      case "rack":
        // No fill - just outlines for monochrome
        this.ctx.fillStyle = "#fff";
        this.ctx.strokeStyle = isSelected ? "#666" : "#000";
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(element.x, element.y, element.width, element.height);
        this.ctx.strokeRect(
          element.x,
          element.y,
          element.width,
          element.height
        );

        // Draw vertical slots for corrugated cardboard
        const slotWidth = 30;
        const slotCount = Math.max(2, Math.floor(element.width / slotWidth));
        const actualSlotWidth = element.width / slotCount;

        this.ctx.strokeStyle = isSelected ? "#666" : "#000";
        this.ctx.lineWidth = 1;

        for (let i = 1; i < slotCount; i++) {
          const x = element.x + actualSlotWidth * i;
          this.ctx.beginPath();
          this.ctx.moveTo(x, element.y);
          this.ctx.lineTo(x, element.y + element.height);
          this.ctx.stroke();
        }

        // Label
        this.ctx.fillStyle = "#000";
        this.ctx.font = "bold 14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
          "RACK",
          element.x + element.width / 2,
          element.y + element.height / 2
        );
        break;

      case "table":
        // Simple rectangle for packing table
        this.ctx.fillStyle = "#fff";
        this.ctx.strokeStyle = isSelected ? "#666" : "#000";
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(element.x, element.y, element.width, element.height);
        this.ctx.strokeRect(
          element.x,
          element.y,
          element.width,
          element.height
        );

        // Label
        this.ctx.fillStyle = "#000";
        this.ctx.font = "bold 14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
          "PACKING TABLE",
          element.x + element.width / 2,
          element.y + element.height / 2
        );
        break;

      case "desk":
        // Simple rectangle for desks
        this.ctx.fillStyle = "#fff";
        this.ctx.strokeStyle = isSelected ? "#666" : "#000";
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(element.x, element.y, element.width, element.height);
        this.ctx.strokeRect(
          element.x,
          element.y,
          element.width,
          element.height
        );

        // Label
        this.ctx.fillStyle = "#000";
        this.ctx.font = "bold 14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(
          "MGRS DESK",
          element.x + element.width / 2,
          element.y + element.height / 2
        );
        break;

      case "text":
        // Draw text box
        if (element.width && element.height) {
          // Draw box outline when selected
          if (isSelected) {
            this.ctx.strokeStyle = "#666";
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            this.ctx.strokeRect(
              element.x,
              element.y,
              element.width,
              element.height
            );
            this.ctx.setLineDash([]);
          }

          // Draw wrapped text
          this.ctx.fillStyle = "#000";
          this.ctx.font = "bold 14px Arial";
          this.ctx.textAlign = "left";
          this.ctx.textBaseline = "top";

          this.wrapText(
            element.text,
            element.x + 5,
            element.y + 5,
            element.width - 10,
            18
          );
        } else {
          // Legacy single-line text
          this.ctx.fillStyle = isSelected ? "#666" : "#000";
          this.ctx.font = "bold 16px Arial";
          this.ctx.textAlign = "left";
          this.ctx.fillText(element.text, element.x, element.y);
        }
        break;
    }

    // Draw selection handles in gray
    if (
      isSelected &&
      (element.type !== "text" || (element.width && element.height))
    ) {
      this.ctx.fillStyle = "#666";
      const handleSize = 8;

      if (element.type === "wall") {
        this.ctx.fillRect(
          element.x1 - handleSize / 2,
          element.y1 - handleSize / 2,
          handleSize,
          handleSize
        );
        this.ctx.fillRect(
          element.x2 - handleSize / 2,
          element.y2 - handleSize / 2,
          handleSize,
          handleSize
        );
      } else {
        // Corner handles
        this.ctx.fillRect(
          element.x - handleSize / 2,
          element.y - handleSize / 2,
          handleSize,
          handleSize
        );
        this.ctx.fillRect(
          element.x + element.width - handleSize / 2,
          element.y - handleSize / 2,
          handleSize,
          handleSize
        );
        this.ctx.fillRect(
          element.x - handleSize / 2,
          element.y + element.height - handleSize / 2,
          handleSize,
          handleSize
        );
        this.ctx.fillRect(
          element.x + element.width - handleSize / 2,
          element.y + element.height - handleSize / 2,
          handleSize,
          handleSize
        );
      }
    }

    this.ctx.restore();
  }

  wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const metrics = this.ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && i > 0) {
        this.ctx.fillText(line, x, currentY);
        line = words[i] + " ";
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.ctx.fillText(line, x, currentY);
  }

  redraw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Fill with white background
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.drawGrid();

    // Draw all elements
    this.elements.forEach((element) => this.drawElement(element));

    // Draw current drawing
    if (this.currentDrawing) {
      this.drawElement(this.currentDrawing);
    }
  }

  updateCursor() {
    switch (this.drawMode) {
      case "select":
        this.canvas.style.cursor = "default";
        break;
      case "wall":
      case "rack":
      case "table":
      case "desk":
        this.canvas.style.cursor = "crosshair";
        break;
      case "text":
        this.canvas.style.cursor = "text";
        break;
    }
  }

  getResizeHandle(x, y) {
    if (!this.selectedElement) return null;

    // Allow resize for text boxes with dimensions
    if (
      this.selectedElement.type === "text" &&
      (!this.selectedElement.width || !this.selectedElement.height)
    ) {
      return null;
    }

    const handleSize = 12;
    const half = handleSize / 2;

    if (this.selectedElement.type === "wall") {
      // Check endpoints for walls
      if (
        Math.abs(x - this.selectedElement.x1) < half &&
        Math.abs(y - this.selectedElement.y1) < half
      ) {
        return "start";
      }
      if (
        Math.abs(x - this.selectedElement.x2) < half &&
        Math.abs(y - this.selectedElement.y2) < half
      ) {
        return "end";
      }
    } else {
      const el = this.selectedElement;
      // Check corners for rectangles
      if (Math.abs(x - el.x) < half && Math.abs(y - el.y) < half) return "nw";
      if (Math.abs(x - (el.x + el.width)) < half && Math.abs(y - el.y) < half)
        return "ne";
      if (Math.abs(x - el.x) < half && Math.abs(y - (el.y + el.height)) < half)
        return "sw";
      if (
        Math.abs(x - (el.x + el.width)) < half &&
        Math.abs(y - (el.y + el.height)) < half
      )
        return "se";
    }

    return null;
  }

  saveState() {
    // Remove any states after current index
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Add new state
    this.history.push(JSON.stringify(this.elements));
    this.historyIndex++;

    // Limit history size
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.elements = JSON.parse(this.history[this.historyIndex]);
      this.selectedElement = null;
      this.redraw();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.elements = JSON.parse(this.history[this.historyIndex]);
      this.selectedElement = null;
      this.redraw();
    }
  }

  clear() {
    if (confirm("Clear all elements? This cannot be undone.")) {
      this.elements = [];
      this.selectedElement = null;
      this.saveState();
      this.redraw();
    }
  }

  createTextAtPosition(x, y) {
    // Create a temporary input element
    const input = document.createElement("input");
    input.type = "text";
    input.style.position = "fixed";

    // Get canvas position relative to the viewport
    const canvasRect = this.canvas.getBoundingClientRect();
    let inputLeft = canvasRect.left + x;
    const inputTop = canvasRect.top + y;

    // Initial edge detection - if too close to right edge, shift left
    const initialWidth = 50; // Smaller initial width estimate
    if (inputLeft + initialWidth > canvasRect.right - 10) {
      inputLeft = canvasRect.right - initialWidth - 10;
    }

    input.style.left = `${inputLeft}px`;
    input.style.top = `${inputTop}px`;
    input.style.fontSize = "14px";
    input.style.fontFamily = "Arial";
    input.style.fontWeight = "bold";
    input.style.border = "2px solid #2196F3";
    input.style.padding = "2px 4px";
    input.style.background = "white";
    input.style.zIndex = "10000";
    input.style.minWidth = "20px";
    input.style.width = "20px"; // Start small
    input.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
    input.style.outline = "none";

    // Add to document body for fixed positioning
    document.body.appendChild(input);

    // Temporarily disable canvas events to prevent interference
    this.canvas.style.pointerEvents = "none";

    // Use setTimeout to ensure focus happens after the current event loop
    setTimeout(() => {
      input.focus();
    }, 0);

    // Track if we should ignore the first blur
    let ignoreFirstBlur = true;
    setTimeout(() => {
      ignoreFirstBlur = false;
    }, 200);

    // Handle input completion
    const completeText = () => {
      const text = input.value.trim();
      if (text) {
        // Get the current position of the input (may have been adjusted by edge detection)
        const currentLeft = parseFloat(input.style.left);
        const finalX = currentLeft - canvasRect.left;

        // Create text element at the actual position
        const textElement = {
          type: "text",
          x: finalX,
          y: y,
          text: text,
          // No width/height - single line text
        };
        this.addElement(textElement);
      }

      // Remove input
      input.remove();

      // Re-enable canvas events
      this.canvas.style.pointerEvents = "auto";

      // Reset to select mode
      this.drawMode = "select";
      this.container
        .querySelector(".tool-btn.active")
        .classList.remove("active");
      this.container
        .querySelector('[data-tool="select"]')
        .classList.add("active");
      this.updateCursor();
    };

    // Helper function to measure text width
    const measureTextWidth = (text) => {
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.font = "bold 14px Arial";
      return tempCtx.measureText(text).width;
    };

    // Helper function to update input width and position
    const updateInputSize = () => {
      const text = input.value || "";
      const textWidth = measureTextWidth(text + "M"); // Add one char width (M is average width)
      const newWidth = Math.max(20, textWidth + 8); // 8px for padding (4px each side)
      input.style.width = `${newWidth}px`;

      // Get current input position
      const currentLeft = parseFloat(input.style.left);

      // Check if input would go off the right edge of canvas
      const inputRight = currentLeft + newWidth;
      const canvasRight = canvasRect.right;

      if (inputRight > canvasRight - 10) {
        // 10px margin
        // Reposition to stay within canvas
        const newLeft = canvasRight - newWidth - 10;
        input.style.left = `${newLeft}px`;
      }
    };

    // Update size on input
    input.addEventListener("input", updateInputSize);

    // Handle Enter key
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        completeText();
      } else if (e.key === "Escape") {
        e.preventDefault();
        input.remove();
        // Re-enable canvas events
        this.canvas.style.pointerEvents = "auto";
        // Reset to select mode
        this.drawMode = "select";
        this.container
          .querySelector(".tool-btn.active")
          .classList.remove("active");
        this.container
          .querySelector('[data-tool="select"]')
          .classList.add("active");
        this.updateCursor();
      }
    });

    // Handle blur (clicking away)
    input.addEventListener("blur", () => {
      if (ignoreFirstBlur) {
        // Re-focus the input
        setTimeout(() => {
          input.focus();
        }, 10);
        return;
      }
      // Add a small delay to prevent immediate blur
      setTimeout(() => {
        completeText();
      }, 100);
    });
  }

  async save() {
    // Create a clean canvas for saving (no grid or selection)
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext("2d");

    // Store original state
    const originalShowGrid = this.showGrid;
    const originalSelected = this.selectedElement;
    const originalCtx = this.ctx;

    // Draw clean version
    this.showGrid = false;
    this.selectedElement = null;
    this.ctx = tempCtx;
    this.redraw();

    // Restore original state
    this.ctx = originalCtx;
    this.showGrid = originalShowGrid;
    this.selectedElement = originalSelected;
    this.redraw();

    // Convert to blob
    const blob = await new Promise((resolve) => {
      tempCanvas.toBlob(resolve, "image/png");
    });

    if (this.options.onSave) {
      this.options.onSave(blob, this.elements);
    }
  }

  // Load existing floorplan data
  loadElements(elements) {
    this.elements = elements || [];
    this.saveState();
    this.redraw();
  }
}

// CSS styles
const styles = `
.floorplan-creator {
    max-width: 1200px;
    margin: 0 auto;
}

.creator-toolbar {
    display: flex;
    gap: 20px;
    padding: 15px;
    background: #f5f5f5;
    border-radius: 8px 8px 0 0;
    border: 1px solid #ddd;
    border-bottom: none;
    flex-wrap: wrap;
    justify-content: space-between;
}

.tool-group {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: nowrap;
    padding-bottom: 0.5em;
}

.tool-btn, .action-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.tool-btn:hover, .action-btn:hover {
    background: #f0f0f0;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.tool-btn.active {
    background: #2196F3;
    color: white;
}

.tool-btn.active svg {
    stroke: white;
}

.grid-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
}

.grid-toggle input {
    margin: 0;
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.grid-toggle span {
    user-select: none;
    line-height: 1;
}

.canvas-container {
    position: relative;
    background: white;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 0 0 8px 8px;
}

#floorplan-canvas {
    display: block;
    margin: 0 auto;
}

.element-properties {
    position: absolute;
    top: 20px;
    right: 20px;
    background: white;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    min-width: 200px;
}

.element-properties h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
}

.element-properties label {
    display: block;
    margin-bottom: 10px;
    font-size: 14px;
}

.element-properties input {
    width: 100%;
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 3px;
}

.btn-sm {
    padding: 5px 10px;
    font-size: 12px;
}

.btn-danger {
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.btn-danger:hover {
    background: #d32f2f;
}

@media (max-width: 768px) {
    .creator-toolbar {
        justify-content: center;
    }
    
    .tool-group {
        flex-wrap: wrap;
    }
    
    #floorplan-canvas {
        max-width: 100%;
        height: auto;
    }
}
`;
