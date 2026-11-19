import { animate, inView } from 'motion';
import { prefersReducedMotion } from './reducedMotion.js';

/**
 * Spring toggle animation on a level mark button (< 350ms).
 * @param {HTMLElement} el
 */
export function animateMarkSpring(el) {
  if (!el || prefersReducedMotion()) return;
  animate(
    el,
    { scale: [0.84, 1.14, 1] },
    { type: 'spring', stiffness: 520, damping: 24, duration: 0.32 }
  );
}

/**
 * Smooth entrance when adding a topic row (< 300ms).
 * @param {HTMLElement} el
 */
export function animateTopicAdd(el) {
  if (!el || prefersReducedMotion()) return;
  animate(
    el,
    { opacity: [0, 1], y: [-8, 0] },
    { duration: 0.24, easing: 'ease-out' }
  );
}

/**
 * Smooth exit before removing a topic row from DOM (< 250ms).
 * @param {HTMLElement} el
 * @returns {Promise<void>}
 */
export async function animateTopicRemove(el) {
  if (!el || prefersReducedMotion()) return;
  const ctrl = animate(
    el,
    { opacity: [1, 0], x: [0, 16] },
    { duration: 0.2, easing: 'ease-in' }
  );
  await ctrl.finished;
}

/**
 * Smooth transition when switching subjects or main views (< 280ms).
 * @param {HTMLElement} el
 */
export function animatePageSwitch(el) {
  if (!el || prefersReducedMotion()) return;
  animate(
    el,
    { opacity: [0.4, 1], y: [6, 0] },
    { duration: 0.24, easing: 'ease-out' }
  );
}

/**
 * 3D vertical spring flip on changed MM:SS clock digits (< 280ms).
 * @param {HTMLElement} el
 */
export function animateDigitFlip(el) {
  if (!el || prefersReducedMotion()) return;
  animate(
    el,
    { y: [-8, 0], opacity: [0.35, 1], rotateX: [55, 0] },
    { type: 'spring', stiffness: 520, damping: 26, duration: 0.25 }
  );
}

/**
 * Smooth spring morph when expanding/collapsing the Chrono-Engine dock.
 * @param {HTMLElement} el
 */
export function animateDockMorph(el) {
  if (!el || prefersReducedMotion()) return;
  animate(
    el,
    { scale: [0.95, 1], opacity: [0.7, 1] },
    { type: 'spring', stiffness: 420, damping: 28, duration: 0.28 }
  );
}

let activeMotionCleanups = [];

/**
 * Stop and clean up all active motion.dev inView observers and hover listeners.
 */
export function cleanupMotionEffects() {
  activeMotionCleanups.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
  activeMotionCleanups = [];
}

/**
 * In-view reveal for dashboard cards/panels.
 * @param {string} selector
 */
export function observeDashboardReveals(selector = '.dash-card, .dash-panel, .xp-feature-panel') {
  cleanupMotionEffects();
  if (prefersReducedMotion()) return;
  const nodes = document.querySelectorAll(selector);
  if (!nodes.length) return;
  const stopInView = inView(nodes, (info) => {
    animate(
      info.target,
      { opacity: [0.45, 1], y: [10, 0] },
      { duration: 0.28, easing: 'ease-out' }
    );
  });
  if (typeof stopInView === 'function') {
    activeMotionCleanups.push(stopInView);
  }

  nodes.forEach((card) => {
    if (card.dataset.hoverBound === '1') return;
    card.dataset.hoverBound = '1';
    const onEnter = () => {
      animate(card, { y: -2 }, { type: 'spring', stiffness: 450, damping: 26, duration: 0.2 });
    };
    const onLeave = () => {
      animate(card, { y: 0 }, { type: 'spring', stiffness: 450, damping: 26, duration: 0.2 });
    };
    card.addEventListener('pointerenter', onEnter);
    card.addEventListener('pointerleave', onLeave);
    activeMotionCleanups.push(() => {
      card.removeEventListener('pointerenter', onEnter);
      card.removeEventListener('pointerleave', onLeave);
      delete card.dataset.hoverBound;
    });
  });
}
