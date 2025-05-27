/**
 * Location management functionality
 * 
 * This module handles location data and coordinates for box storage
 */

/**
 * Represents a box location with coordinates and label
 */
class Location {
  /**
   * Create a new Location
   * @param {Array} coords - Normalized x,y coordinates [0-1, 0-1]
   * @param {string} label - Human-readable location label
   */
  constructor(coords = [0, 0], label = "") {
    this.coords = coords;
    this.label = label;
  }

  /**
   * Create a Location from a location object in the box data
   * @param {Object} locationData - The location data from box YAML
   * @returns {Location} - A new Location instance
   */
  static fromData(locationData) {
    if (!locationData) {
      return new Location();
    }
    
    if (typeof locationData === 'string') {
      // Legacy format - just a label
      return new Location([0, 0], locationData);
    }
    
    // New format with coords and label
    return new Location(
      locationData.coords || [0, 0],
      locationData.label || ""
    );
  }

  /**
   * Convert to a storable object
   * @returns {Object} - The location data
   */
  toData() {
    return {
      coords: this.coords,
      label: this.label
    };
  }

  /**
   * Check if the location has valid coordinates
   * @returns {boolean} - Whether the location has valid coordinates
   */
  hasCoordinates() {
    return Array.isArray(this.coords) && 
           this.coords.length === 2 &&
           typeof this.coords[0] === 'number' &&
           typeof this.coords[1] === 'number' &&
           !isNaN(this.coords[0]) &&
           !isNaN(this.coords[1]);
  }
  
  /**
   * Get a display string for the location
   * @returns {string} - A string representation of the location
   */
  toString() {
    if (this.label) {
      return this.label;
    }
    
    if (this.hasCoordinates()) {
      return `(${this.coords[0].toFixed(2)}, ${this.coords[1].toFixed(2)})`;
    }
    
    return "Unknown";
  }
}

/**
 * Convert box location string to a Location object
 * @param {string|Object} boxLocation - The box location from store data
 * @returns {Location} - A Location object
 */
function parseBoxLocation(boxLocation) {
  return Location.fromData(boxLocation);
}

/**
 * Calculate distance between two coordinates
 * @param {Array} coords1 - First coordinate pair [x, y]
 * @param {Array} coords2 - Second coordinate pair [x, y]
 * @returns {number} - Euclidean distance between the coordinates
 */
function calculateDistance(coords1, coords2) {
  if (!coords1 || !coords2 || coords1.length !== 2 || coords2.length !== 2) {
    return Infinity;
  }
  
  const dx = coords1[0] - coords2[0];
  const dy = coords1[1] - coords2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest box to a given coordinate
 * @param {Array} coords - The coordinate to find boxes near
 * @param {Array} boxes - Array of boxes with location data
 * @param {number} maxDistance - Maximum allowed distance
 * @returns {Object|null} - The nearest box or null if none found
 */
function findNearestBox(coords, boxes, maxDistance = 0.1) {
  if (!coords || coords.length !== 2) {
    return null;
  }
  
  let nearestBox = null;
  let minDistance = Infinity;
  
  for (const box of boxes) {
    if (!box.location) continue;
    
    const location = parseBoxLocation(box.location);
    if (!location.hasCoordinates()) continue;
    
    const distance = calculateDistance(coords, location.coords);
    if (distance < minDistance && distance <= maxDistance) {
      minDistance = distance;
      nearestBox = box;
    }
  }
  
  return nearestBox;
}

/**
 * Group boxes by approximate location
 * @param {Array} boxes - Array of boxes with location data
 * @param {number} clusterThreshold - Threshold for clustering
 * @returns {Array} - Array of box clusters
 */
function groupBoxesByLocation(boxes, clusterThreshold = 0.05) {
  const clusters = [];
  
  for (const box of boxes) {
    if (!box.location) continue;
    
    const location = parseBoxLocation(box.location);
    if (!location.hasCoordinates()) continue;
    
    const coords = location.coords;
    
    // Find a cluster to join
    let foundCluster = false;
    for (const cluster of clusters) {
      if (calculateDistance(coords, cluster.center) <= clusterThreshold) {
        cluster.boxes.push(box);
        // Recalculate cluster center
        const n = cluster.boxes.length;
        cluster.center = [
          (cluster.center[0] * (n - 1) + coords[0]) / n,
          (cluster.center[1] * (n - 1) + coords[1]) / n
        ];
        foundCluster = true;
        break;
      }
    }
    
    // Create a new cluster if none found
    if (!foundCluster) {
      clusters.push({
        center: [...coords],
        boxes: [box]
      });
    }
  }
  
  return clusters;
}

// Browser compatibility - export to window object
if (typeof window !== 'undefined') {
  window.Location = Location;
  window.parseBoxLocation = parseBoxLocation;
  window.calculateDistance = calculateDistance;
  window.findNearestBox = findNearestBox;
  window.groupBoxesByLocation = groupBoxesByLocation;
}

// ES6 exports removed - all functions are available on window object