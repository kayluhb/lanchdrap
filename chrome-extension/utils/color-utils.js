// Color utilities for LanchDrap extension
// Handles color parsing and gradient generation
// Extracted from stats-display.js for better modularity

window.LanchDrapColorUtils = (() => {
  /**
   * Parse color string to RGB values
   * @param {string} color - Color string in various formats (#RRGGBB, #RGB, rgb(), rgba())
   * @returns {Object|null} Object with r, g, b properties or null if invalid
   */
  function parseColorToRgb(color) {
    if (!color || typeof color !== 'string') return null;
    const c = color.trim();
    
    // rgb() or rgba()
    let m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
      return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
    }
    
    // #RRGGBB
    m = c.match(/^#([0-9a-fA-F]{6})$/);
    if (m) {
      const intVal = parseInt(m[1], 16);
      return { r: (intVal >> 16) & 255, g: (intVal >> 8) & 255, b: intVal & 255 };
    }
    
    // #RGB
    m = c.match(/^#([0-9a-fA-F]{3})$/);
    if (m) {
      const rHex = m[1][0];
      const gHex = m[1][1];
      const bHex = m[1][2];
      return {
        r: parseInt(rHex + rHex, 16),
        g: parseInt(gHex + gHex, 16),
        b: parseInt(bHex + bHex, 16),
      };
    }
    
    return null;
  }

  /**
   * Convert color string to HSL
   * @param {string} color - Color string
   * @returns {Object} Object with h, s, l properties
   */
  function colorToHsl(color) {
    const rgbVals = parseColorToRgb(color);
    if (!rgbVals) return { h: 0, s: 0, l: 50 };

    const r = rgbVals.r / 255;
    const g = rgbVals.g / 255;
    const b = rgbVals.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  /**
   * Create gradient colors from a base color
   * @param {string} color - Base color string
   * @returns {Object} Object with gradientStart and gradientEnd properties
   */
  function createGradientFromColor(color) {
    const hsl = colorToHsl(color);
    const gradientStart = `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 80)}%, ${Math.min(hsl.l + 25, 90)}%)`;
    const gradientEnd = `hsl(${hsl.h}, ${Math.max(hsl.s - 5, 20)}%, ${Math.max(hsl.l + 10, 85)}%)`;
    
    return {
      gradientStart,
      gradientEnd,
      hsl,
    };
  }

  return {
    parseColorToRgb,
    colorToHsl,
    createGradientFromColor,
  };
})();

