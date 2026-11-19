/**
 * Check whether the user prefers reduced motion.
 * Evaluated dynamically so OS/browser changes take effect immediately.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
