// The module of the DAG plugin's class, blockr.graph-graph_plugin, which
// blockr.graph lists in R with the class's id and the name "Workflow". Its
// default export is the class without its id
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.12#a-plugin).
// The class keeps the DAG's state, which ../../state defines, and holds what
// the DAG keeps and how it moves blocks, in the client alone
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1):
//
// - Its `state`: the schema of the state, which the build generates from the
//   state's types, and the default of the state, which holds no position.
// - Its `update`, which drops what the state holds of each block and stack
//   that a delta removes, its `afterStep`, which places whatever a step adds,
//   and its `start`, which gives every block and stack a position as a board
//   opens (../../plugin).
// - Its five commands (../../commands), which core registers with the class.
// - Its four board actions, Copy, Cut, Paste and Layout (../../actions), which
//   core registers with the class, and which every menu of their objects
//   offers beside core's.
// - Its `ui`, which draws the board with React Flow, and opens core's menus
//   of board actions (../../ui).
//
// Its `update`, `afterStep`, `start` and commands give the same positions for
// the same board wherever they run, since none reads anything on the page.
// The board actions and the `ui` read the page, as the clipboard and where
// the user right-clicked.

import type { PluginClass } from "@blockr/core";
// The schema of the class's state is the file that the build writes for R,
// beside the bundle.
// eslint-disable-next-line no-restricted-imports
import schema from "../../../inst/js/graph.schema.json" with { type: "json" };
import { graphBoardActions } from "../../actions/index.ts";
import { graphCommands } from "../../commands/index.ts";
import { afterStep, start, update } from "../../plugin/index.ts";
import { defaultState } from "../../state/index.ts";
import { ui } from "../../ui/index.ts";

export const api = 1;

export default {
  state: { schema, default: defaultState },
  update,
  afterStep,
  start,
  commands: graphCommands,
  boardActions: graphBoardActions,
  ui,
} satisfies Omit<PluginClass, "id">;
