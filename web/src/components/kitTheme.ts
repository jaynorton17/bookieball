// kitTheme.ts
// Map bingo ball colours to goalkeeper kit colours. When a specific ballColour
// is provided (e.g. from the team definition), the kit primary and trim
// colours are derived by darkening and lightening the ball colour. If no
// colour is provided, default kit colours are returned.

export interface KeeperKit {
  primary: string;
  trim: string;
}

/**
 * Convert a hex colour string (e.g. '#aabbcc') to its RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const parsed = hex.replace('#', '');
  const bigint = parseInt(parsed, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

/**
 * Convert RGB components back into a hex colour string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => {
    const h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return h.length === 1 ? '0' + h : h;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Shade a colour by blending it with white (positive percent) or black
 * (negative percent). Percent should be between -1 and 1. A value of 0
 * returns the original colour. Positive values lighten the colour.
 */
function shadeColour(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  if (percent >= 0) {
    // lighten towards white
    const nr = r + (255 - r) * percent;
    const ng = g + (255 - g) * percent;
    const nb = b + (255 - b) * percent;
    return rgbToHex(nr, ng, nb);
  } else {
    // darken towards black
    const nr = r * (1 + percent);
    const ng = g * (1 + percent);
    const nb = b * (1 + percent);
    return rgbToHex(nr, ng, nb);
  }
}

/**
 * Derive a keeper kit from a ball colour. Uses a simple palette swap with
 * darkening/lightening. When no colour is provided, returns a default kit.
 */
export function getKeeperKit(ballColour?: string | null): KeeperKit {
  if (!ballColour) {
    return {
      primary: '#0053a1',
      trim: '#0084d1',
    };
  }
  // Ensure hex format with leading '#'
  const normalized = ballColour.startsWith('#') ? ballColour : `#${ballColour}`;
  return {
    primary: shadeColour(normalized, -0.2),
    trim: shadeColour(normalized, 0.3),
  };
}