// The default of the DAG plugin's state
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#the-state).

import type { GraphState } from "./types.ts";

// The state that the store gives a board that holds none for the DAG.
// It holds no position, so the DAG lays the whole board out as the board
// opens.
// Its layout is the one that R's graph_layout() gives by default, as the
// default of R's new_graph_plugin() holds it.
export const defaultState: GraphState = {
  positions: {},
  stacks: {},
  layout: { direction: "TB", spacing: "normal", placement: "repulsion", snap: false, snap_size: 20 },
};
