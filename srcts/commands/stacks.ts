// The DAG's command that collapses a stack, as the blocks around it close up
// on it, or expands it, putting back what its collapse moved
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#collapsing-and-expanding-a-stack).
// It sets the stack's entry in `stacks` or drops it, and makes room around
// the stack in the same delta.
// It takes an undo step, since it moves blocks, so that one undo takes back a
// collapse or an expand with all that it moved.
// Its preflight refuses a stack that holds no block, since such a stack shows
// as a collapsed one does already.
// A stack that shows as asked already changes nothing.

import type { StackId } from "@blockr/core";
import { collapse, expand } from "../collapse/index.ts";
import { changePatches, entryPatches } from "../patches/index.ts";
import { GRAPH, graphState, isCollapse } from "../state/index.ts";
import { command, passes, stateFailures } from "./common.ts";
import * as schemas from "./schemas.ts";

interface CollapseStack {
  readonly stack: StackId;
  readonly collapsed: boolean;
}

export const stackCommands = [
  command<CollapseStack>({
    id: "blockr.graph-collapse_stack",
    label: "Collapse or expand stack",
    description:
      "Collapses a stack, which then shows as a small box that holds its name and the number of its blocks, while the blocks around it close up on it, or expands a collapsed stack, putting back the blocks that its collapse moved. A stack that holds no block cannot collapse.",
    args: schemas.object(
      {
        stack: schemas.stack,
        collapsed: { type: "boolean", description: "True to collapse the stack, false to expand it." },
      },
      ["stack", "collapsed"],
    ),
    preflight(board, { stack }, context) {
      const held = board.stacks[stack];
      return passes(
        [
          ...stateFailures(board),
          ...(held === undefined ? [`The board holds no stack "${stack}".`] : []),
          ...(held?.blocks.length === 0
            ? [`The stack "${stack}" holds no block, so it shows as a collapsed stack does already.`]
            : []),
        ],
        context,
      );
    },
    run(board, { stack, collapsed }) {
      const state = graphState(board);
      const entry = state?.stacks[stack];
      if (state === undefined || (entry !== undefined && isCollapse(entry)) === collapsed) return [];
      const folded = collapsed ? collapse(board, state, stack) : expand(board, state, stack);
      return { patches: [...changePatches(state, folded.changes, GRAPH), ...entryPatches(state, folded.entries, GRAPH)] };
    },
  }),
];
