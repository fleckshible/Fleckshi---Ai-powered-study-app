import { escapeHtml } from '../utils/dom.js';
import { getState } from '../storage/store.js';

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function getTimeDigits(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return str.split('');
}

export function renderDigitSpans(totalSec) {
  return getTimeDigits(totalSec)
    .map((ch, idx) =>
      ch === ':'
        ? `<span class="digit-sep">:</span>`
        : `<span class="flip-digit" data-digit-pos="${idx}" data-digit-val="${ch}">${ch}</span>`
    )
    .join('');
}

/**
 * Render the Anime.js Hero-inspired Concentric SVG Chrono-Engine Dial.
 * No play triangle: the central 4-point scanline star core is the Start/Pause trigger,
 * and the outer 120-tick bezel carries a prominent grabbable radial knob.
 * @param {object} pomoState
 * @param {number} [size=320]
 * @param {boolean} [interactive=true]
 */
export function renderChronoDialSvg(pomoState, size = 320, interactive = true) {
  const cx = 180;
  const cy = 180;
  const total = Math.max(1, pomoState.totalSeconds || 1500);
  const elapsed = Math.max(0, total - (pomoState.secondsLeft ?? total));
  const progress = Math.min(1, elapsed / total);
  const isBreak = pomoState.mode === 'break';

  const dialMinutes = pomoState.running
    ? Math.max(1, Math.ceil((pomoState.secondsLeft || 60) / 60))
    : Math.min(120, Math.max(5, Math.round(total / 60)));

  // 1. Outer 12 Segmented Neon Arcs
  const segCount = 12;
  const activeSegs = pomoState.running
    ? Math.round(progress * segCount)
    : Math.max(1, Math.round((dialMinutes / 120) * segCount));
  const segmentsHtml = Array.from({ length: segCount }, (_, i) => {
    const startA = i * 30 + 4;
    const endA = (i + 1) * 30 - 4;
    const d = describeArc(cx, cy, 154, startA, endA);
    const isLit = i < activeSegs;
    const isMintSeg = isBreak || i >= 9;
    const stroke = isLit
      ? isMintSeg
        ? '#10B981'
        : i >= 5
          ? '#38BDF8'
          : '#2563EB'
      : 'var(--dial-unlit-seg)';
    const opacity = isLit ? '1' : '0.65';
    return `<path class="chrono-seg" data-seg-idx="${i}" d="${d}" fill="none" stroke="${stroke}" stroke-width="5.5" stroke-linecap="round" opacity="${opacity}" ${
      isLit ? 'filter="url(#chrono-glow)"' : ''
    }/>`;
  }).join('');

  // 2. 120-Tick Precision Bezel (1 tick = 1 minute up to 120m)
  const ticksHtml = Array.from({ length: 120 }, (_, i) => {
    const angle = i * 3;
    const isMajor = i % 5 === 0;
    const r1 = isMajor ? 128 : 132;
    const r2 = 141;
    const p1 = polarToCartesian(cx, cy, r1, angle);
    const p2 = polarToCartesian(cx, cy, r2, angle);
    const isSelected = i < dialMinutes;
    const color = isSelected
      ? isBreak
        ? '#10B981'
        : '#38BDF8'
      : 'var(--dial-unlit-tick)';
    return `<line class="chrono-tick" data-tick-idx="${i}" x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(
      1
    )}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${color}" stroke-width="${
      isMajor ? 1.8 : 1
    }"/>`;
  }).join('');

  const knobPos = polarToCartesian(cx, cy, 136, (Math.min(120, dialMinutes) / 120) * 360);

  // 3. Three Sweeping Concentric Orbital Tracks
  const orbitsHtml = [
    { r: 116, start: 85, end: 185, color: '#38BDF8', w: 1.9 },
    { r: 105, start: 105, end: 210, color: '#2563EB', w: 2.3 },
    { r: 94, start: 130, end: 235, color: '#10B981', w: 1.6 }
  ]
    .map(
      (orb, idx) =>
        `<path class="chrono-orbit" data-orbit-idx="${idx}" d="${describeArc(
          cx,
          cy,
          orb.r,
          orb.start,
          orb.end
        )}" fill="none" stroke="${orb.color}" stroke-width="${orb.w}" stroke-linecap="round" opacity="0.78" style="transform-origin:${cx}px ${cy}px;"/>`
    )
    .join('');

  // 4. Dotted Parabolic Easing Curve inside center core
  const curveDots = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const x = (1 - t) * (1 - t) * 124 + 2 * (1 - t) * t * 178 + t * t * 236;
    const y = (1 - t) * (1 - t) * 230 + 2 * (1 - t) * t * 176 + t * t * 130;
    const lit = t <= progress;
    return `<circle class="chrono-curve-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${
      lit ? 2.8 : 1.8
    }" fill="${lit ? (isBreak ? '#10B981' : '#38BDF8') : 'var(--dial-unlit-tick)'}"/>`;
  }).join('');

  return (
    `<svg class="chrono-svg" id="${interactive ? 'chronoMainSvg' : 'chronoMiniSvg'}" width="${size}" height="${size}" viewBox="0 0 360 360" aria-hidden="${!interactive}">` +
    `<defs>` +
    `<filter id="chrono-glow" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feGaussianBlur stdDeviation="3.2" result="blur"/>` +
    `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter>` +
    `<pattern id="chrono-scanlines" width="6" height="5" patternUnits="userSpaceOnUse">` +
    `<line x1="0" y1="1.5" x2="6" y2="1.5" stroke="${isBreak ? '#10B981' : '#38BDF8'}" stroke-width="1.8" opacity="0.78"/>` +
    `</pattern>` +
    `<clipPath id="chrono-star-clip">` +
    `<path d="M 180 110 Q 185 175 250 180 Q 185 185 180 250 Q 175 185 110 180 Q 175 175 180 110 Z"/>` +
    `</clipPath>` +
    `</defs>` +
    `<circle class="waapi-pulse" cx="${cx}" cy="${cy}" r="166" fill="none" stroke="${
      isBreak ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)'
    }" stroke-width="1"/>` +
    `<g class="chrono-segments">${segmentsHtml}</g>` +
    `<g class="${interactive ? 'chrono-bezel' : ''}" ${interactive ? 'data-chrono-bezel="true"' : ''}>` +
    `<circle cx="${cx}" cy="${cy}" r="136" fill="none" stroke="transparent" stroke-width="28"/>` +
    ticksHtml +
    (interactive
      ? `<g id="chronoBezelKnob" class="chrono-knob-group" transform="translate(${knobPos.x.toFixed(
          1
        )}, ${knobPos.y.toFixed(
          1
        )})" role="slider" aria-label="Dial duration minutes" aria-valuemin="5" aria-valuemax="120" aria-valuenow="${dialMinutes}">` +
        `<circle cx="0" cy="0" r="22" fill="transparent"/>` +
        `<circle class="knob-halo" cx="0" cy="0" r="15" fill="${
          isBreak ? 'rgba(16,185,129,0.22)' : 'rgba(56,189,248,0.24)'
        }"/>` +
        `<g class="knob-grip-arrows" opacity="0" pointer-events="none">` +
        `<path d="M -11 -6 A 12.5 12.5 0 0 1 11 -6" fill="none" stroke="#38BDF8" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M 8 -9 L 12 -6 L 8 -3" fill="none" stroke="#38BDF8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M 11 6 A 12.5 12.5 0 0 1 -11 6" fill="none" stroke="#38BDF8" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M -8 9 L -12 6 L -8 3" fill="none" stroke="#38BDF8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</g>` +
        `<circle class="knob-core-ring chrono-knob-handle" cx="0" cy="0" r="8.5" fill="${
          isBreak ? '#10B981' : '#2563EB'
        }" stroke="#FFFFFF" stroke-width="2.2" filter="url(#chrono-glow)"/>` +
        `<circle class="knob-center-dot" cx="0" cy="0" r="2.6" fill="#FFFFFF"/>` +
        `<g class="knob-crosshair" opacity="0" pointer-events="none">` +
        `<path d="M -14 0 L -5 0 M 5 0 L 14 0 M 0 -14 L 0 -5 M 0 5 L 0 14" stroke="#A7F3D0" stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="0" cy="0" r="12" fill="none" stroke="#38BDF8" stroke-width="1.2" stroke-dasharray="3 3"/>` +
        `</g>` +
        `</g>` +
        `<g id="chronoDragBadge" opacity="0" pointer-events="none" transform="translate(180, 32)">` +
        `<rect x="-46" y="-12" width="92" height="22" rx="4" fill="#0B0F17" stroke="#A7F3D0" stroke-width="1"/>` +
        `<text id="chronoDragBadgeText" x="0" y="3" text-anchor="middle" fill="#A7F3D0" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700">${dialMinutes}m · ${Math.max(
          1,
          Math.round(dialMinutes / 25)
        )} REPS</text>` +
        `</g>`
      : '') +
    `</g>` +
    `<g class="chrono-orbits">${orbitsHtml}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="82" fill="var(--bg-dial-core)" stroke="var(--border-strong)" stroke-width="1.2"/>` +
    `<circle class="chrono-shock-ring" cx="${cx}" cy="${cy}" r="28" fill="none" stroke="${
      isBreak ? '#10B981' : '#38BDF8'
    }" stroke-width="2" opacity="0" pointer-events="none"/>` +
    `<circle class="chrono-shock-ring" cx="${cx}" cy="${cy}" r="28" fill="none" stroke="#2563EB" stroke-width="1.5" opacity="0" pointer-events="none"/>` +
    `<path id="chronoEasingCurve" d="M 124 230 Q 178 176 236 130" fill="none" stroke="var(--dial-curve-track)" stroke-width="1" stroke-dasharray="3 4"/>` +
    curveDots +
    `<circle id="chronoCometDot" cx="124" cy="230" r="4.2" fill="${isBreak ? '#10B981' : '#2563EB'}" filter="url(#chrono-glow)"/>` +
    `<g class="chrono-star-core" id="${interactive ? 'chronoStarTrigger' : 'chronoMiniStar'}" ${
      interactive
        ? `data-pomo="${pomoState.running ? 'pause' : 'start'}" role="button" tabindex="0" aria-label="${
            pomoState.running ? 'Pause Chrono-Engine' : 'Start Chrono-Engine'
          }"`
        : ''
    } style="transform-origin:${cx}px ${cy}px;">` +
    `<circle cx="${cx}" cy="${cy}" r="66" fill="transparent"/>` +
    `<rect x="108" y="108" width="144" height="144" fill="url(#chrono-scanlines)" clip-path="url(#chrono-star-clip)"/>` +
    `<path d="M 180 110 Q 185 175 250 180 Q 185 185 180 250 Q 175 185 110 180 Q 175 175 180 110 Z" fill="none" stroke="${
      pomoState.running ? (isBreak ? '#10B981' : '#38BDF8') : 'var(--border-strong)'
    }" stroke-width="1.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${
      pomoState.running ? (isBreak ? '#10B981' : '#A7F3D0') : '#2563EB'
    }" stroke="#FFFFFF" stroke-width="1.5"/>` +
    `</g>` +
    `</svg>`
  );
}

/**
 * Render the Compact Corner HUD when browsing Subjects / Today / Stats.
 */
export function renderPomodoroWidget(pomoState, activeView = 'subject') {
  if (activeView === 'focus') {
    return '';
  }

  const { pomodoro } = getState();
  const isBreak = pomoState.mode === 'break';
  const modeLabel = isBreak ? 'BREAK' : 'FOCUS';
  const topicLabel = pomoState.topicName
    ? `${modeLabel} · ${pomoState.topicName}`
    : `${modeLabel} · ${pomodoro?.workMinutes || 25}m`;

  if (activeView === 'notebook') {
    return (
      `<div class="chrono-dock chrono-dock--notebook${isBreak ? ' break-mode' : ''}" id="chronoDock" role="region" aria-label="Compact Chrono-Engine Pill">` +
      `<span class="chrono-pill-dot${pomoState.running ? ' running' : ''}"></span>` +
      `<div class="chrono-dock-time">${renderDigitSpans(pomoState.secondsLeft)}</div>` +
      `<div class="pomo-controls">` +
      (pomoState.running
        ? `<button type="button" class="pomo-btn primary" data-pomo="pause">Pause</button>`
        : `<button type="button" class="pomo-btn primary" data-pomo="start">Start</button>`) +
      `<button type="button" class="pomo-btn mint" id="expandChronoBtn" title="Open Focus Engine Studio">Focus</button>` +
      `</div>` +
      `</div>`
    );
  }

  return (
    `<div class="chrono-dock${isBreak ? ' break-mode' : ''}" id="chronoDock" role="region" aria-label="Chrono-Engine HUD">` +
    renderChronoDialSvg(pomoState, 56, false) +
    `<div class="chrono-dock-meta">` +
    `<div class="chrono-dock-time">${renderDigitSpans(pomoState.secondsLeft)}</div>` +
    `<div class="chrono-dock-topic" title="${escapeHtml(topicLabel)}">${escapeHtml(topicLabel)}</div>` +
    `</div>` +
    `<div class="pomo-controls">` +
    (pomoState.running
      ? `<button type="button" class="pomo-btn primary" data-pomo="pause">PAUSE</button>`
      : `<button type="button" class="pomo-btn primary" data-pomo="start">START</button>`) +
    `<button type="button" class="pomo-btn" data-pomo="reset">RST</button>` +
    `<button type="button" class="pomo-btn mint" id="expandChronoBtn" title="Open Focus Engine Studio">STUDIO</button>` +
    `</div>` +
    `</div>`
  );
}
