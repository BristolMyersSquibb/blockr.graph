// The quick action of the DAG's board action Layout
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-dags-board-actions).
// It offers, in one level:
//
// - Lay out again, the two directions and the three spacings, which lay the
//   whole board out again through relayout of blockr.graph, with the
//   direction or the spacing that the row picks.
// - The two placements of new blocks, Repulsion and Beside, which run
//   set_placement of blockr.graph.
// - Snap to grid, which turns snapping on or off, and the snap size, in a
//   level of its own, which both run set_snap of blockr.graph.
//
// It checks the current direction, spacing and placement, and Snap to grid
// while snapping is on, as today's menu shows the current direction and
// spacing.
// A row that lays the board out again runs relayout of blockr.graph itself, as
// one step of the user, and then has each canvas fit its view to the board,
// as the canvas fits the view as it first mounts on a board (./noted.ts).
// The row runs the command itself, since a board action learns of no batch
// that core runs for it, and the view fits once the step has run.
// The menu shows that it loads while the layout runs, and shows why the store
// refused the step in place of its rows.

import type { CoreApi, QuickLevel, QuickRow } from "@blockr/core";
import type { Layout } from "../state/index.ts";
import { fitViews } from "./noted.ts";

const DIRECTIONS: readonly (readonly [Layout["direction"], string])[] = [
  ["TB", "Top to bottom"],
  ["LR", "Left to right"],
];

const SPACINGS: readonly (readonly [Layout["spacing"], string])[] = [
  ["compact", "Compact"],
  ["normal", "Normal"],
  ["loose", "Loose"],
];

const PLACEMENTS: readonly (readonly [Layout["placement"], string])[] = [
  ["repulsion", "Repulsion"],
  ["beside", "Beside"],
];

export function layoutLevel(layout: Layout, core: CoreApi): QuickLevel {
  const relayout =
    (args: { direction?: Layout["direction"]; spacing?: Layout["spacing"] }) =>
    async (): Promise<[]> => {
      // The menu shows the refusal in place of its rows, so core raises none.
      await core.commands.run(core.id("blockr.graph", "relayout"), args, "user", { notifier: () => undefined });
      fitViews();
      return [];
    };
  const rows: QuickRow[] = [
    { kind: "item", label: "Lay out again", pick: relayout({}) },
    ...DIRECTIONS.map(
      ([direction, label]): QuickRow => ({
        kind: "item",
        heading: "Direction",
        label,
        checked: layout.direction === direction,
        pick: relayout({ direction }),
      }),
    ),
    ...SPACINGS.map(
      ([spacing, label]): QuickRow => ({
        kind: "item",
        heading: "Spacing",
        label,
        checked: layout.spacing === spacing,
        pick: relayout({ spacing }),
      }),
    ),
    ...PLACEMENTS.map(
      ([placement, label]): QuickRow => ({
        kind: "item",
        heading: "New blocks",
        label,
        checked: layout.placement === placement,
        pick: () => [{ id: core.id("blockr.graph", "set_placement"), args: { placement } }],
      }),
    ),
    {
      kind: "item",
      heading: "Snapping",
      label: "Snap to grid",
      checked: layout.snap,
      pick: () => [{ id: core.id("blockr.graph", "set_snap"), args: { snap: !layout.snap } }],
    },
    {
      kind: "item",
      heading: "Snapping",
      label: "Snap size…",
      detail: `${String(layout.snap_size)} px`,
      pick: () => snapSizeLevel(layout.snap_size, core),
    },
  ];
  return { title: "Layout", rows };
}

// The level that sets the snap size, in pixels of the canvas, which takes a
// number above 0, as the schema of the DAG's state does. It names the command
// by the Id that the caller's core.id() gives.
function snapSizeLevel(size: number, core: Pick<CoreApi, "id">): QuickLevel {
  return {
    title: "Snap size",
    rows: [
      {
        kind: "text",
        label: "Snap size in pixels",
        value: String(size),
        check: (value) => (sizeOf(value) === undefined ? "The snap size is a number of pixels above 0." : undefined),
        submit(value) {
          const next = sizeOf(value);
          return next === undefined || next === size ? [] : [{ id: core.id("blockr.graph", "set_snap"), args: { snap_size: next } }];
        },
      },
    ],
  };
}

function sizeOf(value: string): number | undefined {
  const size = Number(value);
  return value.trim() !== "" && Number.isFinite(size) && size > 0 ? size : undefined;
}
