// The icons of the DAG's board actions, which its toolbar's buttons and the
// rows of core's menus show: SVG markup in the colour of the text around it,
// drawn as core draws the icons of its own board actions, in the style of
// blockr.ui's icons, which hold none for copying, cutting, pasting or a
// layout.

const svg = (paths: string): string =>
  `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

// Two sheets, one over the other.
export const COPY_ICON = svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>');

// A pair of scissors.
export const CUT_ICON = svg('<circle cx="4.5" cy="11.5" r="2"/><circle cx="11.5" cy="11.5" r="2"/><path d="M6 10 12.5 2.5M10 10 3.5 2.5"/>');

// A clipboard.
export const PASTE_ICON = svg(
  '<path d="M10.5 2.5h1a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1"/><rect x="5.5" y="1.5" width="5" height="2.5" rx=".75"/>',
);

// A block that feeds two blocks below it.
export const LAYOUT_ICON = svg(
  '<rect x="6" y="1.5" width="4" height="3.5" rx="1"/><rect x="1.5" y="11" width="4" height="3.5" rx="1"/><rect x="10.5" y="11" width="4" height="3.5" rx="1"/><path d="M8 5v3M3.5 11V8h9v3"/>',
);
