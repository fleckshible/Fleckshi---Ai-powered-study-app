import { escapeHtml } from '../utils/dom.js';

export const ICON_REGISTRY = {
  // Sidebar Primary Views
  'nav:subject': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-fill" d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v15H6.5a2.5 2.5 0 0 0-2.5 2.5Z"/>` +
      `<path class="rl-icon-draw" d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M8 7h8M8 11h6"/>`
  },
  'nav:focus': {
    animClass: 'rl-anim-spin',
    pathsHtml:
      `<circle class="rl-icon-fill" cx="12" cy="13" r="8"/>` +
      `<circle class="rl-icon-draw" cx="12" cy="13" r="8"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 9v4l2.5 2.5"/>` +
      `<path class="rl-icon-draw" d="M9 2h6M12 2v3"/>`
  },
  'nav:today': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<rect class="rl-icon-fill" x="3" y="4" width="18" height="5" rx="2"/>` +
      `<rect class="rl-icon-draw" x="3" y="4" width="18" height="17" rx="2"/>` +
      `<path class="rl-icon-draw" d="M8 2v4M16 2v4M3 9h18"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m9 14.5 2 2 4-4"/>`
  },
  'nav:dashboard': {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<rect class="rl-icon-fill" x="5.5" y="13" width="3" height="7" rx="1"/>` +
      `<rect class="rl-icon-fill" x="10.5" y="7" width="3" height="13" rx="1"/>` +
      `<rect class="rl-icon-fill" x="15.5" y="10" width="3" height="10" rx="1"/>` +
      `<path class="rl-icon-draw" d="M3 20h18"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M7 20v-7M12 20V7M17 20v-10"/>`
  },
  'nav:notebook': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<path class="rl-icon-fill" d="M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6Z"/>` +
      `<path class="rl-icon-draw" d="M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M19 15c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z"/>`
  },
  'action:cmd': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<rect class="rl-icon-fill" x="9" y="9" width="6" height="6" rx="1"/>` +
      `<path class="rl-icon-draw" d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3Z"/>`
  },
  'action:backup': {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<ellipse class="rl-icon-fill" cx="12" cy="5" rx="8" ry="3"/>` +
      `<ellipse class="rl-icon-draw" cx="12" cy="5" rx="8" ry="3"/>` +
      `<path class="rl-icon-draw" d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>`
  },

  // 7 Main Notebook Sections
  'sec:home': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-fill" d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z"/>` +
      `<path class="rl-icon-draw" d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="10" r="1.5"/>`
  },
  'sec:sources': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-fill" d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/>` +
      `<path class="rl-icon-draw" d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m3 12 9 4.5 9-4.5"/>` +
      `<path class="rl-icon-draw" d="m3 16.5 9 4.5 9-4.5"/>`
  },
  'sec:chat': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<path class="rl-icon-fill" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>` +
      `<path class="rl-icon-draw" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>`
  },
  'sec:learn': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-fill" d="M2 6a3 3 0 0 1 3-3h5a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5a3 3 0 0 1-3-3V6Z"/>` +
      `<path class="rl-icon-fill" d="M22 6a3 3 0 0 0-3-3h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5a3 3 0 0 0 3-3V6Z"/>` +
      `<path class="rl-icon-draw" d="M2 6a3 3 0 0 1 3-3h5a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5a3 3 0 0 1-3-3V6Z"/>` +
      `<path class="rl-icon-draw" d="M22 6a3 3 0 0 0-3-3h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5a3 3 0 0 0 3-3V6Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M6 8h3M15 8h3"/>`
  },
  'sec:practice': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-fill" d="M13 2 4 14h7l-1 8 10-12h-7l0-8Z"/>` +
      `<path class="rl-icon-draw" d="M13 2 4 14h7l-1 8 10-12h-7l0-8Z"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="19" cy="5" r="1.5"/>`
  },
  'sec:visual': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<circle class="rl-icon-fill" cx="6" cy="12" r="2.5"/>` +
      `<circle class="rl-icon-fill" cx="18" cy="6" r="2.5"/>` +
      `<circle class="rl-icon-fill" cx="18" cy="18" r="2.5"/>` +
      `<circle class="rl-icon-draw" cx="6" cy="12" r="2.5"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="18" cy="6" r="2.5"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="18" cy="18" r="2.5"/>` +
      `<path class="rl-icon-draw" d="M8.4 11 15.6 7.1M8.4 13l7.2 3.9"/>`
  },
  'sec:plan': {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<circle class="rl-icon-fill" cx="12" cy="12" r="9"/>` +
      `<circle class="rl-icon-draw" cx="12" cy="12" r="9"/>` +
      `<polygon class="rl-icon-accent rl-icon-draw" points="16.2 7.8 14 14 7.8 16.2 10 10 16.2 7.8"/>`
  },

  // Home Views
  'home:overview': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<rect class="rl-icon-draw" x="3" y="3" width="7" height="7" rx="1.5"/>` +
      `<rect class="rl-icon-accent rl-icon-draw" x="14" y="3" width="7" height="7" rx="1.5"/>` +
      `<rect class="rl-icon-draw" x="3" y="14" width="7" height="7" rx="1.5"/>` +
      `<rect class="rl-icon-draw" x="14" y="14" width="7" height="7" rx="1.5"/>`
  },
  'home:scan': {
    animClass: 'rl-anim-scan',
    pathsHtml:
      `<path class="rl-icon-draw" d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M4 12h16"/>` +
      `<path class="rl-icon-draw" d="M8 9h8M8 15h6"/>`
  },
  'home:tree': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<rect class="rl-icon-draw" x="3" y="3" width="6" height="5" rx="1"/>` +
      `<rect class="rl-icon-accent rl-icon-draw" x="14" y="8" width="7" height="5" rx="1"/>` +
      `<rect class="rl-icon-draw" x="14" y="16" width="7" height="5" rx="1"/>` +
      `<path class="rl-icon-draw" d="M6 8v10h8M6 10.5h8"/>`
  },
  'home:paste': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<rect class="rl-icon-draw" x="8" y="3" width="8" height="4" rx="1"/>` +
      `<path class="rl-icon-draw" d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M9 12h6M9 16h4"/>`
  },
  'home:sync': {
    animClass: 'rl-anim-spin',
    pathsHtml:
      `<path class="rl-icon-draw" d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M3 3v5h5"/>` +
      `<path class="rl-icon-draw" d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M16 16h5v5"/>`
  },
  'home:queue': {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<path class="rl-icon-draw" d="M4 6h16M4 12h10M4 18h8"/>` +
      `<polygon class="rl-icon-accent rl-icon-draw" points="16 13 21 16 16 19 16 13"/>`
  },

  // Sources Views
  'sources:library': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-draw" d="M4 4h4v16H4zM10 6h4v14h-4z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m16 5 4 1-2.5 14-4-1Z"/>`
  },
  'sources:upload': {
    animClass: 'rl-anim-scan',
    pathsHtml:
      `<path class="rl-icon-draw" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 15V3m0 0-4.5 4.5M12 3l4.5 4.5"/>`
  },
  'sources:paste': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-draw" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>` +
      `<path class="rl-icon-draw" d="M14 3v5h5"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M9 14h6M12 11v6"/>`
  },
  'sources:topics': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-draw" d="M9 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7l-2-2Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M8 13h8M12 10v6"/>`
  },

  // Chat Views
  'chat:stream': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<path class="rl-icon-draw" d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 7v4M10 9h4"/>`
  },
  'chat:citations': {
    animClass: 'rl-anim-scan',
    pathsHtml:
      `<path class="rl-icon-draw" d="M10 6H7a3 3 0 0 0-3 3v3h4v4H4M20 6h-3a3 3 0 0 0-3 3v3h4v4h-4"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M10 18h4"/>`
  },
  'chat:settings': {
    animClass: 'rl-anim-spin',
    pathsHtml:
      `<line class="rl-icon-draw" x1="4" y1="7" x2="20" y2="7"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="9" cy="7" r="2"/>` +
      `<line class="rl-icon-draw" x1="4" y1="12" x2="20" y2="12"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="15" cy="12" r="2"/>` +
      `<line class="rl-icon-draw" x1="4" y1="17" x2="20" y2="17"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="11" cy="17" r="2"/>`
  },

  // Learn Views
  notes: {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-draw" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/>` +
      `<path class="rl-icon-draw" d="M14 3v6h6"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M8 13h8M8 17h5"/>`
  },
  personalNotes: {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-draw" d="M12 20h9"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>`
  },
  summary: {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<path class="rl-icon-draw" d="M4 6h16M4 11h12M4 16h14M4 20h8"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="19" cy="11" r="2"/>`
  },
  studyGuide: {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-draw" d="m4 19 4-9 4 9M5.5 16h5"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M15 6h5M15 10h5M15 14h4"/>`
  },
  faq: {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<circle class="rl-icon-draw" cx="12" cy="12" r="9"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M9.5 9.5a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7M12 17.5h.01"/>`
  },
  glossary: {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-draw" d="M5 4h11a3 3 0 0 1 3 3v13H7a2 2 0 0 1-2-2V4Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M9 11h6M10 15h4"/>`
  },
  timeline: {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<line class="rl-icon-draw" x1="6" y1="4" x2="6" y2="20"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="6" cy="7" r="2"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="6" cy="14" r="2"/>` +
      `<path class="rl-icon-draw" d="M11 7h9M11 14h7M11 19h5"/>`
  },

  // Practice Views
  flashcards: {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<rect class="rl-icon-draw" x="3" y="6" width="15" height="12" rx="2"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M7 3h12a2 2 0 0 1 2 2v11"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M8 12h5"/>`
  },
  quiz: {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<rect class="rl-icon-draw" x="4" y="4" width="16" height="16" rx="2"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m8.5 12.5 2.3 2.3 4.7-4.8"/>`
  },
  'quiz:config': {
    animClass: 'rl-anim-spin',
    pathsHtml:
      `<path class="rl-icon-draw" d="M12 3v3M12 18v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M3 12h3M18 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="12" r="3.5"/>`
  },
  'quiz:history': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<path class="rl-icon-draw" d="M6 4h12v4a6 6 0 0 1-12 0V4Z"/>` +
      `<path class="rl-icon-draw" d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 14v5M8 21h8"/>`
  },

  // Visual Views
  mindMap: {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="12" r="3"/>` +
      `<circle class="rl-icon-draw" cx="5" cy="5" r="2"/>` +
      `<circle class="rl-icon-draw" cx="19" cy="5" r="2"/>` +
      `<circle class="rl-icon-draw" cx="5" cy="19" r="2"/>` +
      `<circle class="rl-icon-draw" cx="19" cy="19" r="2"/>` +
      `<path class="rl-icon-draw" d="M9.8 9.8 6.5 6.5M14.2 9.8l3.3-3.3M9.8 14.2l-3.3 3.3M14.2 14.2l3.3 3.3"/>`
  },
  'visual:matrix': {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<rect class="rl-icon-draw" x="3" y="4" width="18" height="16" rx="2"/>` +
      `<path class="rl-icon-draw" d="M3 10h18M9 4v16M15 4v16"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="15" r="1"/>`
  },

  // Plan Views
  revisionPlan: {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<rect class="rl-icon-draw" x="3" y="4" width="18" height="17" rx="2"/>` +
      `<path class="rl-icon-draw" d="M8 2v4M16 2v4M3 9h18"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M8 13h3M8 17h8M14 13h2"/>`
  },
  'plan:sync': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<circle class="rl-icon-draw" cx="12" cy="12" r="8"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="12" r="4"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="12" r="1"/>`
  },

  // Controls, Header Chips & Workspace Actions
  'ctrl:notebooks': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<rect class="rl-icon-draw" x="4" y="4" width="7" height="16" rx="1"/>` +
      `<rect class="rl-icon-accent rl-icon-draw" x="13" y="4" width="7" height="16" rx="1"/>`
  },
  'ctrl:sourcesMode': {
    animClass: 'rl-anim-scan',
    pathsHtml:
      `<path class="rl-icon-draw" d="M12 3 5 6v6c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m9.5 12 1.8 1.8 3.5-3.8"/>`
  },
  'ctrl:syllabusMode': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<path class="rl-icon-draw" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="12" r="3"/>`
  },
  'ctrl:scope': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<circle class="rl-icon-draw" cx="12" cy="12" r="7"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`
  },
  'ctrl:model': {
    animClass: 'rl-anim-spin',
    pathsHtml:
      `<rect class="rl-icon-draw" x="6" y="6" width="12" height="12" rx="2"/>` +
      `<rect class="rl-icon-accent rl-icon-draw" x="9.5" y="9.5" width="5" height="5" rx="0.5"/>` +
      `<path class="rl-icon-draw" d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>`
  },
  'ctrl:tools': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-draw" d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-5.6 5.6a1.5 1.5 0 0 0 2.1 2.1l5.6-5.6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.1-2.1 2.3-2.3Z"/>`
  },
  'ctrl:generate': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<path class="rl-icon-draw" d="m12 3 1.8 4.9L19 9.5l-4.9 1.8L12 16l-1.8-4.7L5 9.5l5.2-1.6L12 3Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m5 16 .8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16Z"/>`
  },
  'ctrl:fx': {
    animClass: 'rl-anim-spin',
    pathsHtml:
      `<polygon class="rl-icon-draw" points="12 2 15.1 8.6 22 9.3 16.9 14 18.4 21 12 17.3 5.6 21 7.1 14 2 9.3 8.9 8.6 12 2"/>`
  },
  'ctrl:key': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<circle class="rl-icon-draw" cx="7.5" cy="15.5" r="4.5"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m11 12 9-9M17 6l3 3"/>`
  },
  'ctrl:grid': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<rect class="rl-icon-draw" x="3" y="4" width="7" height="7" rx="1"/>` +
      `<rect class="rl-icon-accent rl-icon-draw" x="14" y="4" width="7" height="7" rx="1"/>` +
      `<rect class="rl-icon-accent rl-icon-draw" x="3" y="14" width="7" height="7" rx="1"/>` +
      `<rect class="rl-icon-draw" x="14" y="14" width="7" height="7" rx="1"/>`
  },
  'ctrl:camera': {
    animClass: 'rl-anim-scan',
    pathsHtml:
      `<path class="rl-icon-draw" d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="13" r="4"/>`
  },
  'ctrl:edit': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-draw" d="M12 20h9"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>`
  },
  'ctrl:copy': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<rect class="rl-icon-draw" x="9" y="9" width="12" height="12" rx="2"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`
  },
  'ctrl:download': {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<path class="rl-icon-draw" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M7 10l5 5 5-5M12 15V3"/>`
  },
  'ctrl:speak': {
    animClass: 'rl-anim-wave',
    pathsHtml:
      `<polygon class="rl-icon-draw" points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>`
  },
  'ctrl:versions': {
    animClass: 'rl-anim-spin',
    pathsHtml:
      `<circle class="rl-icon-fill" cx="12" cy="12" r="8"/>` +
      `<path class="rl-icon-draw" d="M3 12a9 9 0 1 0 3-6.7L3 8"/>` +
      `<path class="rl-icon-draw" d="M3 3v5h5"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 7v5l3 2"/>`
  },

  // Status & Action Icons (Icon System v2)
  'status:generated': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<circle class="rl-icon-fill" cx="12" cy="12" r="9"/>` +
      `<circle class="rl-icon-draw" cx="12" cy="12" r="9"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="m8.5 12.2 2.4 2.4 4.8-5.1"/>`
  },
  'status:stale': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-fill" d="M12 3 2.5 19.5h19L12 3Z"/>` +
      `<path class="rl-icon-draw" d="M10.3 3.9 2.6 17.5a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 9v4M12 16.5h.01"/>`
  },
  'status:due': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<circle class="rl-icon-fill" cx="12" cy="12" r="9"/>` +
      `<circle class="rl-icon-draw" cx="12" cy="12" r="9"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M12 7v5l3 2"/>`
  },
  'status:mastered': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<polygon class="rl-icon-fill" points="12 2.5 14.9 8.4 21.4 9.3 16.7 13.9 17.8 20.3 12 17.2 6.2 20.3 7.3 13.9 2.6 9.3 9.1 8.4 12 2.5"/>` +
      `<polygon class="rl-icon-draw" points="12 2.5 14.9 8.4 21.4 9.3 16.7 13.9 17.8 20.3 12 17.2 6.2 20.3 7.3 13.9 2.6 9.3 9.1 8.4 12 2.5"/>`
  },
  'action:plus': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<circle class="rl-icon-fill" cx="12" cy="12" r="9"/>` +
      `<path class="rl-icon-draw" d="M12 5v14M5 12h14"/>`
  },
  'action:trash': {
    animClass: 'rl-anim-tilt',
    pathsHtml:
      `<path class="rl-icon-fill" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Z"/>` +
      `<path class="rl-icon-draw" d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6"/>` +
      `<path class="rl-icon-accent rl-icon-draw" d="M10 11v6M14 11v6"/>`
  },
  'action:more': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<circle class="rl-icon-accent rl-icon-draw" cx="6" cy="12" r="1.5"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="12" cy="12" r="1.5"/>` +
      `<circle class="rl-icon-accent rl-icon-draw" cx="18" cy="12" r="1.5"/>`
  },
  'action:send': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<polygon class="rl-icon-fill" points="22 2 11 13 15 22 22 2"/>` +
      `<path class="rl-icon-draw" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>`
  },
  'action:check': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<path class="rl-icon-accent rl-icon-draw" d="m5 12.5 4.5 4.5L19 7.5"/>`
  },
  'action:play': {
    animClass: 'rl-anim-float',
    pathsHtml:
      `<polygon class="rl-icon-fill" points="6 4 20 12 6 20 6 4"/>` +
      `<polygon class="rl-icon-draw" points="6 4 20 12 6 20 6 4"/>`
  },
  'action:pause': {
    animClass: 'rl-anim-pulse',
    pathsHtml:
      `<rect class="rl-icon-fill" x="6" y="4" width="4" height="16" rx="1"/>` +
      `<rect class="rl-icon-fill" x="14" y="4" width="4" height="16" rx="1"/>` +
      `<rect class="rl-icon-draw" x="6" y="4" width="4" height="16" rx="1"/>` +
      `<rect class="rl-icon-draw" x="14" y="4" width="4" height="16" rx="1"/>`
  }
};

/**
 * Render a clean, theme-aware duotone inline SVG icon (20px default, 24px in hero tiles).
 */
export function renderAnimatedIcon(iconId, { size = 20, className = '' } = {}) {
  const entry = ICON_REGISTRY[iconId] || ICON_REGISTRY['sec:learn'];
  const s = Math.max(12, Number(size) || 20);
  const cls = ['rl-anim-icon', entry.animClass, className].filter(Boolean).join(' ');
  return (
    `<svg class="${escapeHtml(cls)}" width="${s}" height="${s}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" data-rl-icon="${escapeHtml(String(iconId))}">${entry.pathsHtml}</svg>`
  );
}

/**
 * Render a duotone icon inside a rounded gradient tile with soft section glow.
 */
export function renderIconTile(iconId, { size, variant = 'default', accent = '', className = '' } = {}) {
  const resolvedSize = size || (variant === 'hero' ? 24 : variant === 'sm' ? 16 : 20);
  const cls = [
    'rl-icon-tile',
    variant === 'hero' ? 'rl-icon-tile--hero' : variant === 'sm' ? 'rl-icon-tile--sm' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');
  const accentAttr = accent ? ` data-tile-accent="${escapeHtml(accent)}"` : '';
  return `<span class="${escapeHtml(cls)}"${accentAttr}>${renderAnimatedIcon(iconId, { size: resolvedSize })}</span>`;
}

/**
 * Render a semantic colored status badge (generated | stale | due | mastered) with an icon.
 */
export function renderStatusBadge(status, label = '') {
  const normalized = ['generated', 'stale', 'due', 'mastered'].includes(status) ? status : 'generated';
  const defaults = {
    generated: 'Generated',
    stale: 'Stale',
    due: 'Due',
    mastered: 'Mastered'
  };
  const text = label || defaults[normalized];
  return (
    `<span class="status-badge is-${escapeHtml(normalized)}">` +
    renderAnimatedIcon(`status:${normalized}`, { size: 14 }) +
    `<span>${escapeHtml(text)}</span>` +
    `</span>`
  );
}

/**
 * Render a colored empty-state card with a glowing 24px gradient hero icon tile.
 */
export function renderEmptyIllustration(iconId, { title = '', subtitle = '', actionHtml = '', accent = '' } = {}) {
  return (
    `<div class="rl-empty-card">` +
    renderIconTile(iconId, { variant: 'hero', size: 24, accent }) +
    (title ? `<h3 class="serif">${escapeHtml(title)}</h3>` : '') +
    (subtitle ? `<p>${escapeHtml(subtitle)}</p>` : '') +
    (actionHtml ? `<div class="u-row-center">${actionHtml}</div>` : '') +
    `</div>`
  );
}
