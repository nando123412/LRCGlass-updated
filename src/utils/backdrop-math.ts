/**
 * LRCGlass — Artist Backdrop Math & Dynamic Color System
 * Implements smooth scroll transitions, progressive blur, darkening, and opacity fading
 * for animated artist headers and album artwork backdrops.
 */

/**
 * Calculates scroll progress between 0 and 1 based on scroll position and threshold
 */
export function scrollProgress(scrollTop: number, threshold = 400): number {
  if (scrollTop <= 0) return 0;
  return Math.min(1, Math.max(0, scrollTop / threshold));
}

/**
 * Computes backdrop blur in pixels based on scroll progress (0 to 1)
 * Starts at 0px and progressively blurs up to 28px
 */
export function blurFor(progress: number, maxBlur = 28): number {
  const p = Math.min(1, Math.max(0, progress));
  // Smooth cubic ease-out curve
  const ease = 1 - Math.pow(1 - p, 3);
  return Math.round(ease * maxBlur * 10) / 10;
}

/**
 * Computes overlay shade (darkening factor) based on scroll progress (0 to 1)
 * Starts at a subtle transparent shade (0.15) and transitions to deep ambient shade (0.85)
 */
export function shadeFor(progress: number, minShade = 0.2, maxShade = 0.88): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round((minShade + p * (maxShade - minShade)) * 100) / 100;
}

/**
 * Computes video opacity based on scroll progress (0 to 1)
 * Starts at 1.0 (fully vibrant) and gracefully fades to 0.15 when scrolled deep
 */
export function videoOpacityFor(progress: number, minOpacity = 0.15, maxOpacity = 1.0): number {
  const p = Math.min(1, Math.max(0, progress));
  const ease = Math.pow(p, 1.8);
  return Math.round((maxOpacity - ease * (maxOpacity - minOpacity)) * 100) / 100;
}

/**
 * Parses hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  } else if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return null;
}

/**
 * Generates an ambient gradient background string using lower-region color
 */
export function generateAmbientGradient(accentColor: string, dark = true): string {
  const rgb = hexToRgb(accentColor) || { r: 228, g: 156, b: 152 };
  if (dark) {
    return `radial-gradient(ellipse at 50% 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28) 0%, rgba(24, 11, 15, 0.95) 70%, #180b0f 100%)`;
  } else {
    return `radial-gradient(ellipse at 50% 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20) 0%, rgba(250, 244, 241, 0.95) 70%, #faf4f1 100%)`;
  }
}
