import {
  animate,
  stagger,
  createTimeline,
  createTimer,
  spring,
  cubicBezier,
  steps,
  irregular,
  linear,
  eases,
  svg,
  splitText,
  onScroll,
  createDraggable,
  createAnimatable,
  createScope,
  createLayout,
  utils,
  waapi
} from 'animejs';
import {
  animate as motionAnimate,
  hover as motionHover,
  press as motionPress,
  inView as motionInView,
  scroll as motionScroll,
  stagger as motionStagger
} from 'motion';
import { prefersReducedMotion } from './reducedMotion.js';
import { getFxLevel } from './fxController.js';

const TACTILE_SPRING = spring({ stiffness: 360, damping: 24 });
const TAB_SPRING = spring({ stiffness: 400, damping: 28 });
const STUDIO_BEZIER = cubicBezier(0.22, 1, 0.36, 1);
const TERMINAL_STEPS = steps(6);
const SPARK_IRREGULAR = irregular(6, 0.35);
const LINEAR_ORBIT = linear();
const SCORE_EASE = eases.outCubic;

let notebookScope = null;
let introTimeline = null;
let nbTimers = [];
let nbCleanups = [];
let nbAnimatables = [];
let nbDraggables = [];
let nbScrollObs = [];
let nbWaapis = [];
let nbAmbientAnims = [];
let nbTabCleanups = [];
let thinkingAnimCtrl = null;
let thinkingTimeline = null;

export const NOTEBOOK_MAX_PARTICLES = 40;

function isMinimalFx() {
  return prefersReducedMotion() || getFxLevel() === 'minimal';
}

function isFullFx() {
  return !isMinimalFx() && getFxLevel() === 'full';
}

/**
 * Dispose active tab-scoped listeners, draggables, animatables, WAAPI loops,
 * scroll observers, and timers when switching tabs so memory stays flat.
 */
export function cleanupNotebookTabEffects() {
  nbTabCleanups.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
  nbTabCleanups = [];

  nbDraggables.forEach((d) => {
    try {
      d.revert?.();
    } catch {
      // ignore
    }
  });
  nbDraggables = [];

  nbAnimatables.forEach((a) => {
    try {
      a.revert?.();
    } catch {
      // ignore
    }
  });
  nbAnimatables = [];

  nbScrollObs.forEach((s) => {
    try {
      s.revert?.();
    } catch {
      // ignore
    }
  });
  nbScrollObs = [];
}

export function cleanupNotebookEffects() {
  cleanupNotebookTabEffects();

  if (introTimeline) {
    try {
      introTimeline.pause?.();
    } catch {
      // ignore
    }
    introTimeline = null;
  }

  if (thinkingAnimCtrl) {
    try {
      thinkingAnimCtrl.pause?.();
      thinkingAnimCtrl.cancel?.();
    } catch {
      // ignore
    }
    thinkingAnimCtrl = null;
  }
  if (thinkingTimeline) {
    try {
      thinkingTimeline.pause?.();
    } catch {
      // ignore
    }
    thinkingTimeline = null;
  }

  nbAmbientAnims.forEach((a) => {
    try {
      a.pause?.();
      a.cancel?.();
    } catch {
      // ignore
    }
  });
  nbAmbientAnims = [];

  nbTimers.forEach((t) => {
    try {
      t.pause?.();
    } catch {
      // ignore
    }
  });
  nbTimers = [];

  nbWaapis.forEach((w) => {
    try {
      w.cancel?.();
      w.revert?.();
    } catch {
      // ignore
    }
  });
  nbWaapis = [];

  nbCleanups.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
  nbCleanups = [];

  if (notebookScope) {
    try {
      notebookScope.revert();
    } catch {
      // ignore
    }
    notebookScope = null;
  }
}

let visListenerAdded = false;
function ensureVisibilityHook() {
  if (visListenerAdded || typeof document === 'undefined') return;
  visListenerAdded = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      nbTimers.forEach((t) => t.pause?.());
      nbAmbientAnims.forEach((a) => a.pause?.());
      thinkingTimeline?.pause?.();
      thinkingAnimCtrl?.pause?.();
      nbWaapis.forEach((w) => w.pause?.());
    } else if (!isMinimalFx()) {
      nbAmbientAnims.forEach((a) => a.play?.());
      nbWaapis.forEach((w) => w.play?.());
    }
  });
}

/**
 * 1. Signature Notebook Intro (`createScope` + `createTimeline` + `splitText` + `stagger`, skippable)
 */
export function animateNotebookOpen(root) {
  cleanupNotebookEffects();
  if (!root) return;
  ensureVisibilityHook();

  if (isMinimalFx()) {
    animate(root, { opacity: [0, 1], duration: 110, ease: 'linear' });
    return;
  }

  try {
    notebookScope = createScope({
      root,
      mediaQueries: {
        mobile: '(max-width: 820px)',
        desktop: '(min-width: 821px)'
      }
    }).add(() => {
      introTimeline = createTimeline({ defaults: { ease: STUDIO_BEZIER } });

      const ambient = root.querySelector('.nb-ambient-canvas');
      if (ambient) {
        introTimeline.add(ambient, { opacity: [0, 1], duration: 360 });
      }

      const header = root.querySelector('.nb-header');
      if (header) {
        introTimeline.add(header, { opacity: [0, 1], translateY: [-10, 0], duration: 280 }, 40);
      }

      const titleEl = root.querySelector('.nb-hero-title');
      if (titleEl && titleEl.dataset.splitDone !== '1') {
        titleEl.dataset.splitDone = '1';
        try {
          const sp = splitText(titleEl, { chars: true, words: true });
          if (sp.chars?.length) {
            introTimeline.add(
              sp.chars,
              {
                opacity: [0, 1],
                translateY: [8, 0],
                duration: 240,
                delay: stagger(12)
              },
              80
            );
          }
        } catch {
          // ignore empty
        }
      }

      const stage = root.querySelector('#nbTabStage');
      if (stage) {
        introTimeline.add(stage, { opacity: [0, 1], translateY: [14, 0], duration: 280 }, 120);
      }

      // Skip cinematic timeline immediately if user interacts
      const skipIntro = () => {
        try {
          introTimeline?.complete?.();
        } catch {
          // ignore
        }
      };
      root.addEventListener('pointerdown', skipIntro, { once: true });
      nbCleanups.push(() => root.removeEventListener('pointerdown', skipIntro));
    });
  } catch {
    // fallback safely
  }

  startAuroraAmbient(root);
  bindMotionGestures(root);
}

/**
 * Ambient Aurora Blobs animated purely on transform & opacity (`utils.random`),
 * disabled in Minimal FX mode and paused when offscreen/hidden.
 */
export function startAuroraAmbient(root) {
  if (!root || isMinimalFx()) return;
  const blobs = Array.from(root.querySelectorAll('.nb-aurora-blob'));
  if (!blobs.length) return;

  blobs.forEach((blob, idx) => {
    const dx = utils.random(-48, 48, 0) || (idx % 2 ? 36 : -36);
    const dy = utils.random(-36, 36, 0) || (idx % 2 ? -28 : 28);
    const anim = animate(blob, {
      translateX: [0, dx, -dx * 0.5, 0],
      translateY: [0, dy, -dy * 0.6, 0],
      scale: [1, 1.12, 0.94, 1],
      duration: 14000 + idx * 3500,
      loop: true,
      ease: 'inOutSine'
    });
    nbAmbientAnims.push(anim);
  });
}

/**
 * Animated SVG stroke drawing for empty state diagrams & dropzone glyphs (`svg.createDrawable`).
 */
export function animateDrawableIllustrations(root) {
  if (!root || isMinimalFx()) return;
  const paths = root.querySelectorAll('.nb-drawable-path');
  if (!paths.length) return;
  try {
    const drawables = svg.createDrawable(paths);
    animate(drawables, {
      draw: ['0 0', '0 1'],
      duration: 650,
      delay: stagger(55),
      ease: STUDIO_BEZIER
    });
  } catch {
    // ignore
  }
}

/**
 * Staggered entrance for rendered Markdown headings, lists, and KaTeX math blocks.
 */
export function animateRenderedNotesSections(root) {
  if (!root || isMinimalFx()) return;
  const targets = root.querySelectorAll(
    '.nb-markdown-body > h1, .nb-markdown-body > h2, .nb-markdown-body > h3, .nb-markdown-body > p, .nb-markdown-body > ul > li, .nb-math-block'
  );
  if (!targets.length) return;
  const capped = Array.from(targets).slice(0, 32);
  animate(capped, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: 240,
    delay: stagger(18),
    ease: STUDIO_BEZIER
  });
}

/**
 * Matrix-style "decode" character scramble & settle on generated titles (`splitText` + `createTimer`).
 */
export function animateDecodeTitle(titleEl) {
  if (!titleEl || isMinimalFx() || titleEl.dataset.decoded === '1') return;
  titleEl.dataset.decoded = '1';
  const glyphSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789∑Δπλ';
  try {
    const sp = splitText(titleEl, { chars: true });
    const chars = sp.chars || [];
    if (!chars.length || chars.length > 60) return;
    const orig = chars.map((c) => c.textContent);
    chars.forEach((c) => {
      if (c.textContent.trim()) c.textContent = glyphSet[utils.random(0, glyphSet.length - 1, 0)];
    });
    const timer = createTimer({
      duration: 380,
      onUpdate: (t) => {
        const threshold = t.progress;
        chars.forEach((c, idx) => {
          if (!orig[idx].trim()) return;
          if (idx / chars.length <= threshold) {
            c.textContent = orig[idx];
          } else {
            c.textContent = glyphSet[utils.random(0, glyphSet.length - 1, 0)];
          }
        });
      },
      onComplete: () => {
        chars.forEach((c, idx) => {
          c.textContent = orig[idx];
        });
      }
    });
    nbTimers.push(timer);
  } catch {
    // ignore
  }
}

function bindMotionGestures(root) {
  if (isMinimalFx()) return;

  const covCards = root.querySelectorAll('.nb-coverage-card');
  if (covCards.length) {
    nbTabCleanups.push(
      motionHover(covCards, (el) => {
        motionAnimate(el, { y: -2 }, { type: 'spring', stiffness: 450, damping: 26 });
        return () => {
          motionAnimate(el, { y: 0 }, { type: 'spring', stiffness: 450, damping: 26 });
        };
      })
    );
    nbTabCleanups.push(
      motionPress(covCards, (el) => {
        motionAnimate(el, { scale: 0.985 }, { duration: 0.1 });
        return () => {
          motionAnimate(el, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 24 });
        };
      })
    );
  }

  const chatMsgs = root.querySelectorAll('.nb-chat-msg');
  if (chatMsgs.length) {
    nbTabCleanups.push(
      motionInView(chatMsgs, (info) => {
        motionAnimate(
          info.target,
          { opacity: [0.55, 1], y: [8, 0] },
          { duration: 0.22, delay: motionStagger(0.025) }
        );
      })
    );
  }
}

/**
 * 2. Pointer Spotlight, Optional 3D Tilt (Full FX), Magnetic Buttons & On-Scroll Parallax/Progress
 */
export function bindNotebookAmbientInteractions(root) {
  if (!root) return;

  animateDrawableIllustrations(root);

  if (isMinimalFx()) return;

  const fullMode = isFullFx();

  // Spotlight & subtle 3D tilt (tilt only in Full FX)
  root.querySelectorAll('.nb-spotlight-zone').forEach((zone) => {
    const props = {
      '--mx': { unit: '%', duration: 180, ease: 'outQuad' },
      '--my': { unit: '%', duration: 180, ease: 'outQuad' }
    };
    if (fullMode && zone.classList.contains('nb-tilt-card')) {
      props.rotateX = { unit: 'deg', duration: 220, ease: 'outQuad' };
      props.rotateY = { unit: 'deg', duration: 220, ease: 'outQuad' };
    }
    const tracker = createAnimatable(zone, props);
    nbAnimatables.push(tracker);

    const onMove = (e) => {
      const rect = zone.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = utils.clamp(utils.mapRange(e.clientX - rect.left, 0, rect.width, 0, 100), 0, 100);
      const py = utils.clamp(utils.mapRange(e.clientY - rect.top, 0, rect.height, 0, 100), 0, 100);
      tracker['--mx'](utils.round(px, 1));
      tracker['--my'](utils.round(py, 1));
      if (tracker.rotateX && tracker.rotateY) {
        tracker.rotateY(utils.round(utils.mapRange(px, 0, 100, -1.8, 1.8), 2));
        tracker.rotateX(utils.round(utils.mapRange(py, 0, 100, 1.6, -1.6), 2));
      }
    };
    const onLeave = () => {
      if (tracker.rotateX && tracker.rotateY) {
        tracker.rotateX(0);
        tracker.rotateY(0);
      }
    };
    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerleave', onLeave);
    nbTabCleanups.push(() => {
      zone.removeEventListener('pointermove', onMove);
      zone.removeEventListener('pointerleave', onLeave);
    });
  });

  // Subtle magnetic pull on primary buttons in Balanced/Full FX
  root.querySelectorAll('.btn-primary').forEach((btn) => {
    const mag = createAnimatable(btn, {
      translateX: { unit: 'px', duration: 180, ease: 'outQuad' },
      translateY: { unit: 'px', duration: 180, ease: 'outQuad' }
    });
    nbAnimatables.push(mag);
    const onMove = (e) => {
      const r = btn.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dx = utils.clamp(utils.mapRange(e.clientX - (r.left + r.width / 2), -r.width / 2, r.width / 2, -3.5, 3.5), -3.5, 3.5);
      const dy = utils.clamp(utils.mapRange(e.clientY - (r.top + r.height / 2), -r.height / 2, r.height / 2, -2.5, 2.5), -2.5, 2.5);
      mag.translateX(dx);
      mag.translateY(dy);
    };
    const onLeave = () => {
      mag.translateX(0);
      mag.translateY(0);
    };
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerleave', onLeave);
    nbTabCleanups.push(() => {
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerleave', onLeave);
    });
  });

  // Scroll-linked reading progress bar + subtle grid parallax
  const stageScroll =
    root.querySelector('#nbArtifactScroll') ||
    root.querySelector('.nb-workspace-body') ||
    root.querySelector('#nbTabStage');
  const outputScroll = stageScroll;
  const progressBar = root.querySelector('#nbReadProgressBar');
  if (outputScroll && progressBar) {
    try {
      const obs = animate(progressBar, {
        scaleX: [0, 1],
        ease: 'linear',
        autoplay: onScroll({
          container: outputScroll,
          target: outputScroll,
          enter: 'top top',
          leave: 'bottom bottom',
          sync: true
        })
      });
      if (obs?._autoplay?.revert) nbScrollObs.push(obs._autoplay);
    } catch {
      const stopScroll = motionScroll(
        (progress) => {
          progressBar.style.transform = `scaleX(${progress.toFixed(3)})`;
        },
        { container: outputScroll }
      );
      nbTabCleanups.push(stopScroll);
    }
  }

  const gridEl = root.querySelector('.nb-perspective-grid');
  if (stageScroll && gridEl) {
    try {
      const pObs = animate(gridEl, {
        translateY: [0, -28],
        ease: 'linear',
        autoplay: onScroll({
          container: stageScroll,
          target: stageScroll,
          enter: 'top top',
          leave: 'bottom bottom',
          sync: true
        })
      });
      if (pObs?._autoplay?.revert) nbScrollObs.push(pObs._autoplay);
    } catch {
      // ignore
    }
  }

  animateRenderedNotesSections(root);
  bindMotionGestures(root);
}

/**
 * 3. Thinking Constellation + Motion Path Thought Dot + Send->Load->Check Morph
 */
export function startThinkingConstellation(root, active = true) {
  if (thinkingTimeline) {
    thinkingTimeline.pause?.();
    thinkingTimeline = null;
  }
  if (thinkingAnimCtrl) {
    thinkingAnimCtrl.pause?.();
    thinkingAnimCtrl = null;
  }

  const glyph = root?.querySelector('#nbSendGlyph');
  const targetIcon = root?.querySelector(active ? '#nbIconThinkRef' : '#nbIconCheckRef');
  const sendIcon = root?.querySelector('#nbIconSendRef');

  if (glyph && targetIcon && !isMinimalFx()) {
    try {
      animate(glyph, {
        d: svg.morphTo(targetIcon),
        duration: 240,
        ease: STUDIO_BEZIER,
        onComplete: () => {
          if (!active && sendIcon) {
            setTimeout(() => {
              try {
                animate(glyph, { d: svg.morphTo(sendIcon), duration: 220 });
              } catch {
                // ignore
              }
            }, 650);
          }
        }
      });
    } catch {
      // ignore
    }
  }

  if (!active || !root || isMinimalFx()) return;

  const nodes = root.querySelectorAll('.nb-constellation-dot');
  const dot = root.querySelector('#nbThoughtDot');
  const orbitPath = root.querySelector('#nbThoughtPath');

  thinkingTimeline = createTimeline({ loop: true });
  if (nodes.length) {
    thinkingTimeline.add(nodes, {
      scale: () => [0.7, utils.random(1.1, 1.45, 2), 0.7],
      opacity: [0.35, 1, 0.35],
      duration: 900,
      delay: stagger(110, { from: 'center' }),
      ease: SPARK_IRREGULAR
    });
  }

  if (dot && orbitPath) {
    try {
      const mp = svg.createMotionPath(orbitPath);
      thinkingAnimCtrl = animate(dot, {
        ...mp,
        duration: 1800,
        loop: true,
        ease: LINEAR_ORBIT
      });
    } catch {
      // ignore
    }
  }
}

export function startStreamingTimers(cursorEl, saveEl) {
  if (isMinimalFx()) return () => {};
  const t = createTimer({
    duration: 700,
    loop: true,
    onUpdate: (timer) => {
      if (cursorEl) {
        cursorEl.style.opacity = timer.iterationProgress < 0.5 ? '1' : '0.15';
      }
    }
  });
  nbTimers.push(t);

  if (saveEl) {
    animate(saveEl, {
      opacity: [0.4, 1],
      duration: 280,
      ease: TERMINAL_STEPS
    });
  }
  return () => t.pause?.();
}

export function revealWordsAnimated(el) {
  if (!el || isMinimalFx()) return;
  try {
    const sp = splitText(el, { words: true });
    if (sp.words?.length && sp.words.length <= 180) {
      animate(sp.words, {
        opacity: [0, 1],
        translateY: [4, 0],
        duration: 180,
        delay: stagger(10),
        ease: STUDIO_BEZIER
      });
    }
  } catch {
    // ignore
  }
}

export function drawCitationConnector(root, citationBtn, chunkEl) {
  if (!root || !chunkEl) return;

  chunkEl.scrollIntoView({ behavior: isMinimalFx() ? 'auto' : 'smooth', block: 'center' });

  if (!isMinimalFx()) {
    try {
      const wAnim = waapi.animate(chunkEl, {
        boxShadow: [
          '0 0 0 rgba(34,211,238,0)',
          '0 0 18px rgba(52,211,153,0.65)',
          '0 0 0 rgba(34,211,238,0)'
        ],
        duration: 1100,
        loop: 2,
        ease: 'inOutSine'
      });
      if (wAnim) nbWaapis.push(wAnim);
    } catch {
      // ignore
    }
  }

  const overlay = root.querySelector('#nbCitationOverlay');
  const line = overlay?.querySelector('#nbCitationPath');
  if (!overlay || !line || !citationBtn || isMinimalFx()) return;

  const hostRect = root.getBoundingClientRect();
  const aRect = citationBtn.getBoundingClientRect();
  const bRect = chunkEl.getBoundingClientRect();

  const x1 = aRect.left - hostRect.left + aRect.width / 2;
  const y1 = aRect.top - hostRect.top + aRect.height / 2;
  const x2 = bRect.left - hostRect.left + bRect.width - 12;
  const y2 = bRect.top - hostRect.top + bRect.height / 2;
  const mx = utils.lerp(x1, x2, 0.5);

  line.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${mx.toFixed(1)} ${y1.toFixed(1)}, ${mx.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  overlay.style.opacity = '1';

  try {
    const [drawable] = svg.createDrawable(line);
    animate(drawable, {
      draw: ['0 0', '0 1'],
      duration: 360,
      ease: SCORE_EASE,
      onComplete: () => {
        setTimeout(() => {
          animate(overlay, { opacity: [1, 0], duration: 260 });
        }, 900);
      }
    });
  } catch {
    overlay.style.opacity = '0';
  }
}

export function animateOcrScanSweep(containerEl) {
  if (!containerEl || isMinimalFx()) return;
  const thumbs = containerEl.querySelectorAll('.nb-ocr-thumb');
  if (thumbs.length) {
    animate(thumbs, {
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 240,
      delay: stagger(35)
    });
  }
  const beam = containerEl.querySelector('.nb-scan-line');
  if (beam) {
    const anim = animate(beam, {
      translateY: ['0%', '100%', '0%'],
      duration: 1400,
      loop: true,
      ease: 'inOutSine'
    });
    nbTabCleanups.push(() => anim.pause?.());
  }
}

export function animateMindMapBuild(svgContainer) {
  if (!svgContainer) return;
  const edges = svgContainer.querySelectorAll('.nb-mm-edge');
  const nodes = svgContainer.querySelectorAll('.nb-mm-node');

  if (!isMinimalFx()) {
    if (edges.length) {
      try {
        const drawables = svg.createDrawable(edges);
        animate(drawables, {
          draw: ['0 0', '0 1'],
          duration: 420,
          delay: stagger(30),
          ease: SCORE_EASE
        });
      } catch {
        // ignore
      }
    }
    if (nodes.length) {
      animate(nodes, {
        opacity: [0, 1],
        scale: [0.7, 1],
        duration: 320,
        delay: stagger(35, { from: 'center' }),
        ease: TACTILE_SPRING
      });
    }
  }

  svgContainer.querySelectorAll('.nb-mm-html-node').forEach((nodeEl) => {
    try {
      const d = createDraggable(nodeEl, {
        releaseEase: TACTILE_SPRING,
        container: svgContainer
      });
      nbDraggables.push(d);
    } catch {
      // ignore
    }
  });
}

export function bindFlashcardInteractions(cardEl, onFlipToggle, onSwipeScore) {
  if (!cardEl) return;

  const flipAnim = isMinimalFx()
    ? null
    : animate(cardEl, {
        rotateY: [0, 180],
        duration: 340,
        autoplay: false,
        ease: TACTILE_SPRING
      });

  let flipped = false;
  const onClick = (e) => {
    if (e.target.closest('button')) return;
    flipped = !flipped;
    if (flipAnim) {
      if (flipped) flipAnim.play();
      else flipAnim.reverse();
    }
    cardEl.classList.toggle('is-flipped', flipped);
    onFlipToggle?.(flipped);
  };
  cardEl.addEventListener('click', onClick);
  nbTabCleanups.push(() => cardEl.removeEventListener('click', onClick));

  try {
    const d = createDraggable(cardEl, {
      y: false,
      releaseEase: TACTILE_SPRING,
      onRelease: (inst) => {
        if (inst.x > 85) {
          onSwipeScore?.('easy');
        } else if (inst.x < -85) {
          onSwipeScore?.('hard');
        } else {
          inst.reset();
        }
      }
    });
    nbDraggables.push(d);
  } catch {
    // ignore
  }
}

export function bindSourceDragInteractions(root, onReorder, onDropOnGenerator) {
  if (!root) return;
  const cards = Array.from(root.querySelectorAll('.nb-source-card'));
  const tiles = Array.from(root.querySelectorAll('.nb-gen-tile'));

  cards.forEach((card, fromIdx) => {
    const handle = card.querySelector('.nb-src-drag');
    if (!handle) return;
    try {
      const d = createDraggable(card, {
        trigger: handle,
        releaseEase: TACTILE_SPRING,
        onRelease: (inst) => {
          const rect = card.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;

          const hitTile = tiles.find((tile) => {
            const tr = tile.getBoundingClientRect();
            return cx >= tr.left && cx <= tr.right && cy >= tr.top && cy <= tr.bottom;
          });

          if (hitTile) {
            const srcId = card.getAttribute('data-source-id');
            const tool = hitTile.getAttribute('data-gen-tool');
            inst.reset();
            if (srcId && tool) onDropOnGenerator?.(srcId, tool);
            return;
          }

          const rowH = Math.max(58, rect.height + 8);
          const stepDelta = Math.round(inst.deltaY / rowH);
          inst.reset();
          if (stepDelta !== 0) {
            const toIdx = utils.clamp(fromIdx + stepDelta, 0, cards.length - 1);
            if (toIdx !== fromIdx) onReorder?.(fromIdx, toIdx);
          }
        }
      });
      nbDraggables.push(d);
    } catch {
      // ignore
    }
  });
}

export function runNotebookLayoutUpdate(containerSelector, mutatorFn) {
  if (isMinimalFx()) {
    mutatorFn();
    return;
  }
  try {
    createLayout(containerSelector, {
      duration: 240,
      ease: STUDIO_BEZIER
    }).update(mutatorFn);
  } catch {
    mutatorFn();
  }
}

export function animateQuizFinish(root, scorePct) {
  if (!root || isMinimalFx()) return;
  const ring = root.querySelector('#nbQuizScoreRing');
  const countEl = root.querySelector('#nbQuizScoreText');
  const suggestBox = root.querySelector('#nbQuizMarkSuggest');

  const tl = createTimeline({ defaults: { ease: SCORE_EASE } });

  if (ring) {
    try {
      const [drawable] = svg.createDrawable(ring);
      const frac = utils.clamp(scorePct / 100, 0, 1);
      tl.add(drawable, {
        draw: ['0 0', `0 ${frac.toFixed(2)}`],
        duration: 480
      });
    } catch {
      // ignore
    }
  }

  if (countEl) {
    const obj = { t: 0 };
    tl.add(
      obj,
      {
        t: 1,
        duration: 440,
        onUpdate: () => {
          countEl.textContent = `${utils.round(utils.lerp(0, scorePct, obj.t), 0)}%`;
        }
      },
      0
    );
  }

  if (suggestBox) {
    tl.add(
      suggestBox,
      {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 260,
        ease: TACTILE_SPRING
      },
      '-=160'
    );
  }

  if (scorePct >= 80 && ring && typeof document !== 'undefined') {
    const rect = ring.getBoundingClientRect();
    const count = Math.min(24, NOTEBOOK_MAX_PARTICLES);
    const colors = ['#34D399', '#22D3EE', '#8B5CF6', '#D946EF'];
    const particles = [];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.style.cssText = `position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;width:5px;height:5px;border-radius:50%;background:${colors[i % colors.length]};pointer-events:none;z-index:999;`;
      document.body.appendChild(p);
      particles.push(p);
    }
    animate(particles, {
      translateX: () => utils.random(-85, 85, 0),
      translateY: () => utils.random(-95, 55, 0),
      scale: [1, 0],
      opacity: [1, 0],
      duration: 580,
      ease: 'outCubic',
      onComplete: () => particles.forEach((p) => p.remove())
    });
  }
}

export function animateKeyLockedMorph(root) {
  if (!root || isMinimalFx()) return;
  const path = root.querySelector('#nbKeyMorphPath');
  const lockRef = root.querySelector('#nbLockIconRef');
  if (!path || !lockRef) return;

  createTimeline()
    .add(path, {
      d: svg.morphTo(lockRef),
      duration: 320,
      ease: TACTILE_SPRING
    })
    .add(
      path,
      {
        stroke: ['#22D3EE', '#34D399'],
        duration: 240
      },
      '-=160'
    );
}

export function animateTabWorkspaceSwitch(panelEl) {
  if (!panelEl) return;
  if (isMinimalFx()) {
    animate(panelEl, { opacity: [0.6, 1], duration: 100, ease: 'linear' });
    return;
  }
  try {
    animate(panelEl, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 240,
      ease: STUDIO_BEZIER
    });
  } catch {
    // ignore
  }
}

export function bindSyllabusTreeDrag(treeEl, onReorderChapter) {
  if (!treeEl) return;
  const rows = Array.from(treeEl.querySelectorAll('.nb-tree-chapter'));
  rows.forEach((row, fromIdx) => {
    const handle = row.querySelector('.nb-tree-drag');
    if (!handle) return;
    try {
      const d = createDraggable(row, {
        x: false,
        trigger: handle,
        releaseEase: TACTILE_SPRING,
        onRelease: (inst) => {
          const rect = row.getBoundingClientRect();
          const rowH = Math.max(64, rect.height + 8);
          const stepDelta = Math.round(inst.deltaY / rowH);
          inst.reset();
          if (stepDelta !== 0) {
            const toIdx = utils.clamp(fromIdx + stepDelta, 0, rows.length - 1);
            if (toIdx !== fromIdx) onReorderChapter?.(fromIdx, toIdx);
          }
        }
      });
      nbDraggables.push(d);
    } catch {
      // ignore
    }
  });
}

export function animateWorkspacePopover(popoverEl) {
  if (!popoverEl || isMinimalFx()) return;
  try {
    animate(popoverEl, {
      opacity: [0, 1],
      translateY: [-6, 0],
      duration: 200,
      ease: TAB_SPRING
    });
  } catch {
    // ignore
  }
}

const mountedDrawnIcons = new Set();

export function animateNotebookIcons(root) {
  if (!root || isMinimalFx()) return;
  try {
    const popupBoxes = root.querySelectorAll('.nb-split-menu .nb-item-icon-box');
    if (popupBoxes.length) {
      animate(popupBoxes, {
        scale: [0.82, 1],
        duration: 220,
        delay: stagger(18),
        ease: TAB_SPRING
      });
    }

    const icons = Array.from(
      root.querySelectorAll(
        '.nb-workspace-topbar .rl-anim-icon, .nb-top-tabs .rl-anim-icon, .rl-icon-tile .rl-anim-icon'
      )
    );
    const drawPaths = [];
    for (const iconEl of icons) {
      const key = iconEl.getAttribute('data-rl-icon');
      if (!key || iconEl.getAttribute('data-rl-drawn') === '1' || mountedDrawnIcons.has(key)) {
        continue;
      }
      mountedDrawnIcons.add(key);
      iconEl.setAttribute('data-rl-drawn', '1');
      iconEl.querySelectorAll('.rl-icon-draw').forEach((p) => {
        if (drawPaths.length < 28) drawPaths.push(p);
      });
    }

    if (drawPaths.length) {
      const drawables = svg.createDrawable(drawPaths);
      animate(drawables, {
        draw: ['0 0', '0 1'],
        duration: 360,
        delay: stagger(14),
        ease: STUDIO_BEZIER
      });
    }
  } catch {
    // ignore
  }
}

export function shuffleItems(arr) {
  return utils.shuffle([...arr]);
}
