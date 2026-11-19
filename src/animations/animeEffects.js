import {
  animate,
  createTimer,
  createTimeline,
  createAnimatable,
  createDraggable,
  createScope,
  createLayout,
  engine,
  svg,
  splitText,
  waapi,
  onScroll,
  createSpring,
  cubicBezier,
  stagger,
  utils
} from 'animejs';
import { prefersReducedMotion } from './reducedMotion.js';
import { cleanupMotionEffects } from './motionEffects.js';
import { playDialTickSound } from '../features/audioSynth.js';

export const MAX_ACTIVE_PARTICLES = 40;

let activeViewScope = null;
let chronoSubTimer = null;
let chronoObserver = null;
let disposeBezel = null;
let visibilityBound = false;
let activeDraggables = [];
let activeAnimatables = [];
let activeScrollObservers = [];
let activeWaapiAnims = [];
let activeDomCleanups = [];

const HERO_EASE = cubicBezier(0.22, 1, 0.36, 1);

/**
 * Configure global anime.js engine defaults, visibility pause, and reduced motion.
 */
export function initAnimeEngine() {
  engine.pauseOnDocumentHidden = true;
  if (prefersReducedMotion()) {
    engine.defaults.duration = 0;
  } else {
    engine.defaults.ease = 'outCubic';
  }

  if (!visibilityBound && typeof document !== 'undefined') {
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        engine.pause();
        if (chronoSubTimer) chronoSubTimer.pause();
        activeWaapiAnims.forEach((w) => {
          try {
            w.pause?.();
          } catch {
            // ignore
          }
        });
      } else {
        engine.resume();
        activeWaapiAnims.forEach((w) => {
          try {
            w.play?.();
          } catch {
            // ignore
          }
        });
      }
    });
  }
}

/**
 * Cleanly revert active view-level Scope, Draggables, Animatables, ScrollObservers,
 * WAAPI loops, motion observers, and DOM listeners before rendering a new view.
 */
export function cleanupViewScope() {
  cleanupMotionEffects();

  if (chronoObserver) {
    try {
      chronoObserver.disconnect();
    } catch {
      // ignore
    }
    chronoObserver = null;
  }

  if (activeViewScope) {
    try {
      activeViewScope.revert();
    } catch {
      // ignore
    }
    activeViewScope = null;
  }

  activeDraggables.forEach((d) => {
    try {
      d.revert();
    } catch {
      // ignore
    }
  });
  activeDraggables = [];

  activeAnimatables.forEach((a) => {
    try {
      a.revert();
    } catch {
      // ignore
    }
  });
  activeAnimatables = [];

  activeScrollObservers.forEach((obs) => {
    try {
      obs.revert();
    } catch {
      // ignore
    }
  });
  activeScrollObservers = [];

  activeWaapiAnims.forEach((w) => {
    try {
      w.cancel?.();
      w.revert?.();
    } catch {
      // ignore
    }
  });
  activeWaapiAnims = [];

  if (disposeBezel) {
    try {
      disposeBezel();
    } catch {
      // ignore
    }
    disposeBezel = null;
  }

  activeDomCleanups.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
  activeDomCleanups = [];
}

/**
 * Create a managed anime.js Scope for the current view root.
 * Only replaces the active scope; never clears activeDomCleanups or activeDraggables
 * that were attached before runPostRenderAnimations() in the same render pass.
 * @param {HTMLElement|string} root
 * @param {(scope: any) => void} setupFn
 */
export function runInViewScope(root, setupFn) {
  if (activeViewScope) {
    try {
      activeViewScope.revert();
    } catch {
      // ignore
    }
    activeViewScope = null;
  }
  if (prefersReducedMotion()) return;
  try {
    activeViewScope = createScope({ root }).add((scope) => {
      setupFn(scope);
    });
  } catch (err) {
    console.warn('Scope animation error:', err);
  }
}

/**
 * 1. TEXT (splitText): Kinetic staggered entrance for main hero headlines.
 * @param {ParentNode} [root=document]
 */
export function animateHeroHeadline(root = document) {
  if (prefersReducedMotion()) return;
  const headings = root.querySelectorAll('.hero-split-title');
  headings.forEach((el) => {
    if (el.dataset.splitDone === '1') return;
    el.dataset.splitDone = '1';
    try {
      const splitter = splitText(el, { chars: true, words: true });
      if (splitter.chars?.length) {
        animate(splitter.chars, {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 320,
          delay: stagger(16),
          ease: HERO_EASE
        });
      }
    } catch {
      // fallback if text is empty
    }
  });
}

/**
 * 2. ANIMATABLE (createAnimatable): Smooth magnetic 3D tilt on Chrono-Engine & stat cards.
 * @param {ParentNode} [root=document]
 * @param {string} [selector='.dash-card, .chrono-stage']
 */
export function initMagneticTilt(root = document, selector = '.dash-card, .chrono-stage') {
  if (prefersReducedMotion()) return;
  const targets = root.querySelectorAll(selector);
  targets.forEach((el) => {
    const tilt = createAnimatable(el, {
      rotateX: { unit: 'deg', duration: 220, ease: 'outQuad' },
      rotateY: { unit: 'deg', duration: 220, ease: 'outQuad' }
    });
    activeAnimatables.push(tilt);

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      const maxDeg = el.classList.contains('chrono-stage') ? 4 : 6;
      tilt.rotateX(utils.clamp(-ny * maxDeg * 2, -maxDeg, maxDeg));
      tilt.rotateY(utils.clamp(nx * maxDeg * 2, -maxDeg, maxDeg));
    };

    const onLeave = () => {
      tilt.rotateX(0);
      tilt.rotateY(0);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    activeDomCleanups.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    });
  });
}

/**
 * 3. DRAGGABLE (createDraggable) + UTILITIES (snap, clamp):
 *    Tactile physics drag-to-reorder for syllabus topics.
 * @param {HTMLElement|null} listEl
 * @param {(fromIndex: number, toIndex: number) => void} onReorder
 */
export function initTopicDragReorder(listEl, onReorder) {
  if (!listEl || typeof onReorder !== 'function') return;
  const items = Array.from(listEl.querySelectorAll('.topic-item'));
  if (items.length < 2) return;

  items.forEach((item, fromIndex) => {
    const handle = item.querySelector('.topic-drag-handle');
    if (!handle) return;

    const draggable = createDraggable(item, {
      trigger: handle,
      x: false,
      y: true,
      releaseEase: createSpring({ stiffness: 280, damping: 24 }),
      onRelease: (d) => {
        const rowHeight = Math.max(48, item.getBoundingClientRect().height + 8);
        const stepDelta = Math.round(d.deltaY / rowHeight);
        d.reset();
        if (stepDelta !== 0) {
          const toIndex = utils.clamp(fromIndex + stepDelta, 0, items.length - 1);
          if (toIndex !== fromIndex) {
            onReorder(fromIndex, toIndex);
          }
        }
      }
    });
    activeDraggables.push(draggable);
  });
}

/**
 * Compute continuous bezel drag minutes via shortest signed angular delta (-180..180 deg)
 * so fast drags never misfire and dragging past 12 o'clock clamps cleanly at 5m or 120m.
 * @param {number|null} prevAngleDeg
 * @param {number|null} prevAccumMins
 * @param {number} currentAngleDeg
 * @param {number} [step=5]
 */
export function computeBezelDragStep(prevAngleDeg, prevAccumMins, currentAngleDeg, step = 5) {
  const normAngle = ((currentAngleDeg % 360) + 360) % 360;
  if (prevAngleDeg === null || prevAccumMins === null) {
    const raw = (normAngle / 360) * 120;
    const accumMins = utils.clamp(raw, 5, 120);
    const mins = utils.clamp(utils.snap(accumMins, step), 5, 120);
    return { angleDeg: normAngle, accumMins, mins };
  }
  const deltaDeg = ((normAngle - prevAngleDeg + 540) % 360) - 180;
  const deltaMins = (deltaDeg / 360) * 120;
  const accumMins = utils.clamp(prevAccumMins + deltaMins, 5, 120);
  const mins = utils.clamp(utils.snap(accumMins, step), 5, 120);
  return { angleDeg: normAngle, accumMins, mins };
}

/**
 * 3b. POINTER-CAPTURE RADIAL BEZEL DRAGGING + 3-STATE MORPHING HANDLE:
 *     Idle (sapphire/white ring) -> Hover (spring scale + rotational grip arrows)
 *     -> Holding (crosshair target + live floating badge + Web Audio tick click).
 * Uses a single module-level disposeBezel so per-second re-renders never leak listeners.
 * @param {HTMLElement|SVGElement|null} bezelTarget
 * @param {SVGElement|null} svgEl
 * @param {(minutes: number, step: number, commit: boolean) => void} onMinutesChange
 * @param {() => void} [onAutoPause]
 */
export function initBezelDraggable(bezelTarget, svgEl, onMinutesChange, onAutoPause) {
  if (disposeBezel) {
    try {
      disposeBezel();
    } catch {
      // ignore
    }
    disposeBezel = null;
  }
  if (!bezelTarget || !svgEl || typeof onMinutesChange !== 'function') return;
  svgEl.dataset.bezelBound = '1';

  const knob = svgEl.querySelector('#chronoBezelKnob');
  const knobCore = knob?.querySelector('.knob-core-ring');
  const knobHalo = knob?.querySelector('.knob-halo');
  const knobArrows = knob?.querySelector('.knob-grip-arrows');
  const knobCrosshair = knob?.querySelector('.knob-crosshair');
  const dragBadge = svgEl.querySelector('#chronoDragBadge');
  const dragBadgeText = svgEl.querySelector('#chronoDragBadgeText');

  const getPointerPolar = (clientX, clientY) => {
    const rect = svgEl.getBoundingClientRect();
    const w = rect.width || Number(svgEl.getAttribute?.('width')) || 360;
    const h = rect.height || Number(svgEl.getAttribute?.('height')) || 360;
    const cx = rect.left + w / 2;
    const cy = rect.top + h / 2;
    const scaleX = 360 / w;
    const scaleY = 360 / h;
    const distFromCenter = Math.hypot((clientX - cx) * scaleX, (clientY - cy) * scaleY);
    let angleDeg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
    if (angleDeg < 0) angleDeg += 360;
    return { angleDeg, distFromCenter };
  };

  const setHandleVisualState = (stateName) => {
    if (stateName === 'holding') {
      bezelTarget.style.cursor = 'grabbing';
      if (knob) knob.style.cursor = 'grabbing';
      if (knobArrows) knobArrows.setAttribute('opacity', '0');
      if (knobCrosshair) knobCrosshair.setAttribute('opacity', '1');
      if (dragBadge) dragBadge.setAttribute('opacity', '1');
      if (!prefersReducedMotion() && knobHalo && knobCore) {
        animate(knobHalo, { r: 19, duration: 160, ease: 'outQuad' });
        animate(knobCore, { r: 6.5, duration: 160, ease: 'outQuad' });
      }
    } else if (stateName === 'hover') {
      bezelTarget.style.cursor = 'grab';
      if (knob) knob.style.cursor = 'grab';
      if (knobCrosshair) knobCrosshair.setAttribute('opacity', '0');
      if (dragBadge) dragBadge.setAttribute('opacity', '0');
      if (!prefersReducedMotion()) {
        if (knobArrows) {
          animate(knobArrows, { opacity: 1, duration: 180, ease: 'outQuad' });
        }
        if (knobCore) {
          animate(knobCore, {
            r: 10,
            duration: 240,
            ease: createSpring({ stiffness: 360, damping: 20 })
          });
        }
        if (knobHalo) {
          animate(knobHalo, { r: 18, duration: 220, ease: 'outQuad' });
        }
      } else if (knobArrows) {
        knobArrows.setAttribute('opacity', '1');
      }
    } else {
      bezelTarget.style.cursor = 'grab';
      if (knob) knob.style.cursor = 'grab';
      if (knobCrosshair) knobCrosshair.setAttribute('opacity', '0');
      if (dragBadge) dragBadge.setAttribute('opacity', '0');
      if (!prefersReducedMotion()) {
        if (knobArrows) animate(knobArrows, { opacity: 0, duration: 150 });
        if (knobCore) {
          animate(knobCore, {
            r: 8.5,
            duration: 240,
            ease: createSpring({ stiffness: 320, damping: 22 })
          });
        }
        if (knobHalo) animate(knobHalo, { r: 15, duration: 180 });
      } else if (knobArrows) {
        knobArrows.setAttribute('opacity', '0');
      }
    }
  };

  const paintBezelPreview = (mins) => {
    const angleRad = (((mins / 120) * 360 - 90) * Math.PI) / 180;
    const kx = 180 + 136 * Math.cos(angleRad);
    const ky = 180 + 136 * Math.sin(angleRad);
    if (knob) {
      knob.setAttribute('transform', `translate(${kx.toFixed(1)}, ${ky.toFixed(1)})`);
      knob.setAttribute('aria-valuenow', String(mins));
    }
    if (dragBadge && dragBadgeText) {
      const bx = utils.clamp(180 + 104 * Math.cos(angleRad), 54, 306);
      const by = utils.clamp(180 + 104 * Math.sin(angleRad), 26, 334);
      dragBadge.setAttribute('transform', `translate(${bx.toFixed(1)}, ${by.toFixed(1)})`);
      const reps = Math.max(1, Math.round(mins / 25));
      dragBadgeText.textContent = `${mins}m · ${reps} ${reps === 1 ? 'REP' : 'REPS'}`;
    }
    svgEl.querySelectorAll('.chrono-tick').forEach((tick) => {
      const idx = Number(tick.getAttribute('data-tick-idx') || 0);
      tick.setAttribute('stroke', idx < mins ? '#38BDF8' : 'var(--dial-unlit-tick)');
    });
    const activeSegs = Math.max(1, Math.round((mins / 120) * 12));
    svgEl.querySelectorAll('.chrono-seg').forEach((seg) => {
      const idx = Number(seg.getAttribute('data-seg-idx') || 0);
      const lit = idx < activeSegs;
      seg.setAttribute(
        'stroke',
        lit ? (idx >= 9 ? '#10B981' : idx >= 5 ? '#38BDF8' : '#2563EB') : 'var(--dial-unlit-seg)'
      );
      seg.setAttribute('opacity', lit ? '1' : '0.65');
    });
  };

  let dragging = false;
  let lastAngleDeg = null;
  let accumMins = null;
  let lastMins = null;
  let lastStep = 5;

  const onEnter = () => {
    if (!dragging) setHandleVisualState('hover');
  };
  const onLeave = () => {
    if (!dragging) setHandleVisualState('idle');
  };
  bezelTarget.addEventListener('pointerenter', onEnter);
  bezelTarget.addEventListener('pointerleave', onLeave);

  const onMove = (e) => {
    if (!dragging) return;
    const step = e.shiftKey ? 1 : 5;
    const { angleDeg } = getPointerPolar(e.clientX, e.clientY);
    const next = computeBezelDragStep(lastAngleDeg, accumMins, angleDeg, step);
    lastAngleDeg = next.angleDeg;
    accumMins = next.accumMins;
    lastStep = step;
    if (next.mins !== lastMins) {
      lastMins = next.mins;
      playDialTickSound(next.mins);
      paintBezelPreview(next.mins);
      onMinutesChange(next.mins, step, false);
    }
  };

  const finishDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    window.__chronoBezelDragging = false;
    try {
      if (e?.pointerId != null) bezelTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    setHandleVisualState('idle');
    if (lastMins !== null) onMinutesChange(lastMins, lastStep, true);
  };

  const onDown = (e) => {
    const { angleDeg, distFromCenter } = getPointerPolar(e.clientX, e.clientY);
    if (distFromCenter < 108) return;
    e.preventDefault();
    dragging = true;
    window.__chronoBezelDragging = true;
    onAutoPause?.();
    try {
      bezelTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    setHandleVisualState('holding');
    const step = e.shiftKey ? 1 : 5;
    const init = computeBezelDragStep(null, null, angleDeg, step);
    lastAngleDeg = init.angleDeg;
    accumMins = init.accumMins;
    lastMins = init.mins;
    lastStep = step;
    playDialTickSound(init.mins);
    paintBezelPreview(init.mins);
    onMinutesChange(init.mins, step, false);
  };

  bezelTarget.addEventListener('pointerdown', onDown);
  bezelTarget.addEventListener('pointermove', onMove);
  bezelTarget.addEventListener('pointerup', finishDrag);
  bezelTarget.addEventListener('pointercancel', finishDrag);

  disposeBezel = () => {
    bezelTarget.removeEventListener('pointerenter', onEnter);
    bezelTarget.removeEventListener('pointerleave', onLeave);
    bezelTarget.removeEventListener('pointerdown', onDown);
    bezelTarget.removeEventListener('pointermove', onMove);
    bezelTarget.removeEventListener('pointerup', finishDrag);
    bezelTarget.removeEventListener('pointercancel', finishDrag);
    delete svgEl.dataset.bezelBound;
  };
}

/**
 * 3c. DRAGGABLE DAY/NIGHT THEME SWITCH:
 *     Horizontal draggable pill track using anime.js createDraggable + spring snap.
 * @param {HTMLElement|null} trackEl
 * @param {HTMLElement|null} thumbEl
 * @param {() => 'light'|'dark'} getTheme
 * @param {(theme: 'light'|'dark') => void} onSetTheme
 */
export function initThemeSwitchDraggable(trackEl, thumbEl, getTheme, onSetTheme) {
  if (!trackEl || !thumbEl || typeof onSetTheme !== 'function') return;
  if (trackEl.dataset.switchBound === '1') return;
  trackEl.dataset.switchBound = '1';

  const SUN_SVG =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  const MOON_SVG =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

  const applyThumbPosition = (theme, instant = false) => {
    const targetX = theme === 'dark' ? 38 : 0;
    if (instant || prefersReducedMotion()) {
      thumbEl.style.transform = `translateX(${targetX}px)`;
    } else {
      animate(thumbEl, {
        translateX: targetX,
        duration: 240,
        ease: createSpring({ stiffness: 360, damping: 24 })
      });
    }
    thumbEl.innerHTML = theme === 'dark' ? MOON_SVG : SUN_SVG;
    trackEl.setAttribute('data-theme-state', theme);
    trackEl.setAttribute('aria-checked', String(theme === 'dark'));
  };

  applyThumbPosition(getTheme(), true);

  let dragged = false;
  try {
    const draggable = createDraggable(thumbEl, {
      container: trackEl,
      containerPadding: [2, 2, 2, 2],
      y: false,
      x: { snap: 38 },
      releaseEase: createSpring({ stiffness: 360, damping: 24 }),
      onGrab: () => {
        dragged = false;
      },
      onDrag: () => {
        dragged = true;
      },
      onRelease: (d) => {
        const nextTheme = d.x >= 19 ? 'dark' : 'light';
        onSetTheme(nextTheme);
        applyThumbPosition(nextTheme, false);
      }
    });
    activeDraggables.push(draggable);
  } catch {
    // fallback handled by click below
  }

  const onClick = () => {
    if (dragged) {
      dragged = false;
      return;
    }
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    onSetTheme(next);
    applyThumbPosition(next, false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      onSetTheme(next);
      applyThumbPosition(next, false);
    }
  };

  trackEl.addEventListener('click', onClick);
  trackEl.addEventListener('keydown', onKeyDown);

  activeDomCleanups.push(() => {
    trackEl.removeEventListener('click', onClick);
    trackEl.removeEventListener('keydown', onKeyDown);
    delete trackEl.dataset.switchBound;
  });
}

/**
 * 4. SVG (createDrawable, createMotionPath):
 *    Animate outer neon segments and orbit comet dot along inner parabolic curve.
 * @param {ParentNode} root
 * @param {number} progressPct (0..1)
 */
export function animateChronoSvg(root = document, progressPct = 0) {
  const segs = root.querySelectorAll('.chrono-seg');
  if (segs.length && !prefersReducedMotion()) {
    try {
      const drawables = svg.createDrawable(segs);
      animate(drawables, {
        draw: ['0 0', '0 1'],
        duration: 340,
        delay: stagger(16),
        ease: 'outCubic'
      });
    } catch {
      // safe fallback
    }
  }

  const comet = root.querySelector('#chronoCometDot');
  const curve = root.querySelector('#chronoEasingCurve');
  if (comet && curve && !prefersReducedMotion()) {
    try {
      const motionPath = svg.createMotionPath(curve);
      const mpAnim = animate(comet, {
        ...motionPath,
        duration: 1000,
        autoplay: false,
        ease: 'linear'
      });
      mpAnim.seek(utils.clamp(progressPct, 0, 1) * 1000);
    } catch {
      // ignore if hidden
    }
  }
}

/**
 * 5. TIMER (createTimer):
 *    Sub-second orbital sweep & star core breathing ONLY while running and visible.
 *    Automatically pauses when idle, tab-hidden, or scrolled off-screen.
 * @param {boolean} isRunning
 * @param {ParentNode} [root=document]
 */
export function syncChronoSubTimer(isRunning, root = document) {
  if (chronoSubTimer) {
    chronoSubTimer.pause();
    chronoSubTimer = null;
  }
  if (chronoObserver) {
    chronoObserver.disconnect();
    chronoObserver = null;
  }
  if (!isRunning || prefersReducedMotion() || (typeof document !== 'undefined' && document.hidden)) {
    return;
  }

  const orbits = root.querySelectorAll('.chrono-orbit');
  const star = root.querySelector('.chrono-star-core');
  if (!orbits.length && !star) return;

  let accum = 0;
  chronoSubTimer = createTimer({
    duration: 2000,
    loop: true,
    onUpdate: (t) => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const p = t.iterationProgress;
      accum += 1.2;
      orbits.forEach((orb, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        const factor = 1 + idx * 0.45;
        orb.style.transform = `rotate(${(dir * accum * factor) % 360}deg)`;
      });
      if (star) {
        const s = 1 + Math.sin(p * Math.PI * 2) * 0.055;
        star.style.transform = `scale(${s.toFixed(3)})`;
      }
    }
  });

  const targetEl = root instanceof Element ? root : root.firstElementChild;
  if (targetEl && typeof IntersectionObserver !== 'undefined') {
    chronoObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (!chronoSubTimer) return;
        if (visible && !document.hidden) chronoSubTimer.play();
        else chronoSubTimer.pause();
      },
      { threshold: 0.05 }
    );
    chronoObserver.observe(targetEl);
  }
}

/**
 * 6. TIMELINE (createTimeline):
 *    Click star core -> spring compression, expanding micro shock rings, and 120-tick shockwave ripple.
 * @param {ParentNode} [root=document]
 */
export function animateChronoStartShockwave(root = document) {
  if (prefersReducedMotion()) return;
  const ticks = root.querySelectorAll('.chrono-tick');
  const orbits = root.querySelectorAll('.chrono-orbit');
  const star = root.querySelector('.chrono-star-core');
  const shockRings = root.querySelectorAll('.chrono-shock-ring');

  const tl = createTimeline({ defaults: { ease: 'outCubic' } });
  if (star) {
    tl.add(star, {
      scale: [0.76, 1.18, 1],
      duration: 360,
      ease: createSpring({ stiffness: 380, damping: 18 })
    });
  }
  if (shockRings.length) {
    tl.add(
      shockRings,
      {
        r: [28, 156],
        opacity: [0.95, 0],
        duration: 420,
        delay: stagger(90)
      },
      0
    );
  }
  if (ticks.length) {
    tl.add(
      ticks,
      {
        opacity: [0.35, 1, 0.72],
        duration: 280,
        delay: stagger(2, { from: 'first' })
      },
      20
    );
  }
  if (orbits.length) {
    tl.add(
      orbits,
      {
        opacity: [0.35, 0.95],
        duration: 280,
        delay: stagger(40)
      },
      0
    );
  }
}

/**
 * 7. LAYOUT (createLayout):
 *    Smooth FLIP layout transitions when morphing Chrono-Engine or reordering topics.
 * @param {HTMLElement|string} rootSelector
 * @param {() => void} mutatorFn
 */
export function runLayoutTransition(rootSelector, mutatorFn) {
  if (prefersReducedMotion()) {
    mutatorFn();
    return;
  }
  try {
    const layout = createLayout(rootSelector, {
      duration: 280,
      ease: 'outCubic'
    });
    layout.update(mutatorFn);
  } catch {
    mutatorFn();
  }
}

/**
 * 8. EVENTS (onScroll):
 *    Scroll-linked subtle reveal on topic rows & dashboard panels.
 * @param {ParentNode} [root=document]
 */
export function initScrollReveals(root = document) {
  if (prefersReducedMotion()) return;
  const targets = root.querySelectorAll('.dash-panel, .srs-card');
  targets.forEach((el) => {
    try {
      const anim = animate(el, {
        opacity: [0.65, 1],
        translateY: [10, 0],
        duration: 300,
        ease: HERO_EASE,
        autoplay: onScroll({
          target: el,
          enter: 'bottom top',
          leave: 'top bottom'
        })
      });
      if (anim?._autoplay?.revert) {
        activeScrollObservers.push(anim._autoplay);
      }
    } catch {
      // ignore if scroll container not ready
    }
  });
}

/**
 * 9. WAAPI (waapi.animate):
 *    Hardware-accelerated ambient glow pulses off the main JS thread.
 * @param {ParentNode} [root=document]
 */
export function initAmbientWaapiPulses(root = document) {
  if (prefersReducedMotion() || (typeof document !== 'undefined' && document.hidden)) return;
  const els = root.querySelectorAll('.waapi-pulse');
  if (!els.length) return;
  try {
    const anim = waapi.animate(els, {
      opacity: [0.65, 1, 0.65],
      duration: 2400,
      loop: true,
      ease: 'inOutSine'
    });
    if (anim) activeWaapiAnims.push(anim);
  } catch {
    // ignore in environments without Element.animate
  }
}

/**
 * Staggered entrance of topic list rows (< 400ms total feel).
 * @param {HTMLElement|null} container
 */
export function animateTopicStagger(container) {
  if (!container || prefersReducedMotion()) return;
  const items = container.querySelectorAll('.topic-item');
  if (!items.length) return;

  animate(items, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: 240,
    delay: stagger(18, { start: 0 }),
    ease: HERO_EASE
  });
}

/**
 * Animate SVG progress rings & concentric mastery gauges.
 * @param {ParentNode} [root=document]
 */
export function animateProgressRings(root = document) {
  if (prefersReducedMotion()) return;
  const rings = root.querySelectorAll('.subject-progress-ring');
  rings.forEach((ring) => {
    const pct = Number(ring.getAttribute('data-ring-pct') || 0);
    const circ = Number(ring.getAttribute('data-ring-circ') || 75.4);
    const targetOffset = circ * (1 - pct / 100);
    const fg = ring.querySelector('circle.fg');
    if (!fg) return;

    animate(fg, {
      strokeDashoffset: [circ, targetOffset],
      duration: 360,
      ease: 'outCubic'
    });
  });

  const masteryArcs = root.querySelectorAll('.mastery-ring-fg');
  masteryArcs.forEach((arc) => {
    const target = Number(arc.getAttribute('data-target-offset') || 0);
    const circ = Number(arc.getAttribute('data-circ') || 100);
    animate(arc, {
      strokeDashoffset: [circ, target],
      duration: 400,
      ease: 'outCubic'
    });
  });
}

/**
 * Animate numeric counters with [data-count-to] using utils.lerp interpolation.
 * @param {ParentNode} [root=document]
 */
export function animateCounters(root = document) {
  const els = root.querySelectorAll('[data-count-to]');
  if (!els.length) return;

  els.forEach((el) => {
    const target = Number(el.getAttribute('data-count-to') || 0);
    const suffix = el.getAttribute('data-count-suffix') || '';
    if (prefersReducedMotion()) {
      el.textContent = `${target}${suffix}`;
      return;
    }

    const obj = { t: 0 };
    animate(obj, {
      t: 1,
      duration: 360,
      ease: 'outCubic',
      onUpdate: () => {
        const val = Math.round(utils.lerp(0, target, obj.t));
        el.textContent = `${val}${suffix}`;
      }
    });
  });
}

/**
 * Celebration timeline when a topic reaches all 3 levels.
 * @param {HTMLElement|null} rowEl
 */
export function animateTopicCelebration(rowEl) {
  if (!rowEl || prefersReducedMotion()) return;
  const marks = rowEl.querySelectorAll('.mark-btn');
  if (!marks.length) return;

  const tl = createTimeline({ defaults: { duration: 180, ease: createSpring({ stiffness: 400, damping: 18 }) } });
  tl.add(marks, {
    scale: [1, 1.24, 1],
    delay: stagger(45)
  }).add(
    rowEl,
    {
      borderColor: ['#A7F3D0', 'rgba(56, 189, 248, 0.28)']
    },
    '-=120'
  );
  animateParticleBurst(rowEl);
}

/**
 * 10. UTILITIES (stagger grid, random):
 *     Grid-staggered heatmap cells + radial blue/white/mint XP confetti burst.
 * @param {ParentNode} [root=document]
 */
export function animateDashboardCharts(root = document) {
  if (prefersReducedMotion()) return;

  const cells = root.querySelectorAll('.heatmap-cell');
  if (cells.length) {
    animate(cells, {
      opacity: [0, 1],
      scale: [0.4, 1],
      duration: 260,
      delay: stagger(10, { grid: [20, 7], from: 'center' }),
      ease: 'outQuad'
    });
  }

  const xpBars = root.querySelectorAll('.xp-bar-fill');
  xpBars.forEach((bar) => {
    const targetPct = bar.getAttribute('data-xp-pct') || '0%';
    animate(bar, {
      width: ['0%', targetPct],
      duration: 380,
      ease: createSpring({ stiffness: 220, damping: 22 })
    });
  });

  const bars = root.querySelectorAll('.weekly-bar-fill');
  bars.forEach((bar) => {
    const targetWidth = bar.getAttribute('data-bar-width') || '0%';
    animate(bar, {
      width: ['0%', targetWidth],
      duration: 360,
      ease: 'outCubic'
    });
  });
}

/**
 * Trigger a crisp particle burst in Sapphire, Cyan, Pure White, and Whisper-Mint.
 * @param {HTMLElement|null} originEl
 */
export function animateParticleBurst(originEl) {
  if (prefersReducedMotion() || typeof document === 'undefined') return;

  const rect = originEl?.getBoundingClientRect?.() || {
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    width: 0,
    height: 0
  };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  let layer = document.getElementById('burstLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'burstLayer';
    layer.className = 'burst-layer';
    document.body.appendChild(layer);
  }

  const colors = ['#FFFFFF', '#38BDF8', '#2563EB', '#A7F3D0'];
  const particles = [];
  const batchSize = 14;

  while (layer.childElementCount + batchSize > MAX_ACTIVE_PARTICLES && layer.firstElementChild) {
    layer.firstElementChild.remove();
  }

  for (let i = 0; i < batchSize; i++) {
    const p = document.createElement('span');
    p.className = 'burst-particle';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.background = colors[i % colors.length];
    layer.appendChild(p);
    particles.push(p);
  }

  const cleanupBurst = () => {
    particles.forEach((p) => p.remove());
  };
  const fallbackTimer = setTimeout(cleanupBurst, 450);

  animate(particles, {
    translateX: () => utils.random(-85, 85),
    translateY: () => utils.random(-85, 85),
    scale: () => [utils.random(0.8, 1.35), 0],
    rotate: () => utils.random(-180, 180),
    opacity: [1, 0],
    duration: 380,
    ease: 'outExpo',
    onComplete: () => {
      clearTimeout(fallbackTimer);
      cleanupBurst();
    }
  });
}

/**
 * Animate the 3-node Mastery Pipeline energy beam when a node is activated.
 * @param {HTMLElement|null} rowEl
 */
export function animatePipelineBeam(rowEl) {
  if (!rowEl || prefersReducedMotion()) return;
  const beams = rowEl.querySelectorAll('.pipeline-beam-fill');
  if (!beams.length) return;
  beams.forEach((beam) => {
    const targetW = beam.getAttribute('data-beam-w') || '0%';
    animate(beam, {
      width: targetW,
      duration: 280,
      ease: 'outCubic'
    });
  });
}

/**
 * Swipe-out exit animation for graded recall cards in Today's Revisions.
 * @param {HTMLElement|null} cardEl
 * @returns {Promise<void>}
 */
export async function animateRecallCardSwipe(cardEl) {
  if (!cardEl || prefersReducedMotion()) return;
  const anim = animate(cardEl, {
    translateX: [0, 64],
    opacity: [1, 0],
    duration: 220,
    ease: 'inCubic'
  });
  await anim.finished;
}
