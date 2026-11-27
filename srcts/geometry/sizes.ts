// The nominal sizes from which the DAG places, lays out and makes room, and
// the gaps of the spacings
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#placing-added-blocks).
// They read nothing on the page, so that the same board gives the same
// positions wherever the DAG runs.
//
// A block's node is its mark, 32 px across, as today's node is, with the
// block's name below it, as G6 draws today's label.
// A block's position is the centre of its node, as a stack's position is
// the centre of its box.
// Laying out and making room both work on centres, and React Flow places a
// node by its centre with nodeOrigin [0.5, 0.5], so no position needs
// converting.
// The name is a line of 12 px text 4 px below the mark, with 5 px on either
// side, as today's label is.
// Its width comes from its length, at 6.2 px for a character, which is what
// the spike that checked making room took. The length counts the name's
// UTF-16 code units, which every browser counts alike.
// It is capped at 160 px, as in the spike.
// Today's labels never break, since G6 draws them with labelWordWrap off, so
// the DAG draws a longer name cut at that width.

import type { Layout } from "../state/index.ts";

// The width and the height of a block's mark.
export const MARK = 32;

// How far below the mark the name starts, and how tall its line is.
const NAME_OFFSET = 4;
const NAME_HEIGHT = 16;

// The width that the name takes for each of its characters, the room on
// either side of it, and the widest that it gets.
const CHARACTER = 6.2;
const NAME_PADDING = 5;
const NAME_MAX = 160;

// The height of a block's node with its name.
export const BLOCK_HEIGHT = MARK + NAME_OFFSET + NAME_HEIGHT;

// The room that a stack's shape keeps around each of its blocks, and that
// its box keeps around them all: 20 px, dagre's default edgesep.
// Laying the board out, dagre bounds a cluster with border nodes, and puts
// half of edgesep and half a gap between a border node and a node beside
// it, and edgesep between two border nodes.
// So a stack's box, and its shape within it, lies within its cluster, and
// keeps one gap from the nodes and the boxes beside it, as two nodes do.
export const STACK_PADDING = 20;

// The box of a collapsed stack and of a stack that holds no block, which
// holds the stack's name and the number of its blocks.
export const STACK_WIDTH = 170;
export const STACK_HEIGHT = 44;

// The gap between two nodes and between two ranks, for each spacing, as
// today's presets have them.
const GAPS: Readonly<Record<Layout["spacing"], number>> = { compact: 50, normal: 70, loose: 100 };

export function gapOf(spacing: Layout["spacing"]): number {
  return GAPS[spacing];
}

// The width of a block's node with its name: the name's, or the mark's
// where the name is narrower.
export function blockWidth(name: string): number {
  const text = name.length * CHARACTER + 2 * NAME_PADDING;
  return Math.min(NAME_MAX, Math.max(MARK, Math.round(text)));
}
