// What the components that draw the DAG share: CoreApi, the id of the
// plugin's class, what a handle tells the canvas, and how the DAG opens core's
// menus of board actions and triggers board actions, through a React context
// of the DAG's own root.

import type { CoreApi, LinkId, PluginClassId } from "@blockr/core";
import { createContext, useContext } from "react";
import type { GraphActions } from "./actions.ts";
import type { Side } from "./elements.ts";

// A handle that the pointer enters: its node, by the node's id, its side, the
// link that feeds it, if any, and whether its side is crowded.
export interface Entered {
  readonly node: string;
  readonly side: Side;
  readonly link?: LinkId;
  readonly crowded: boolean;
}

export interface Graph {
  readonly core: CoreApi;
  // The id of the plugin's class, under which the board holds the DAG's
  // state.
  readonly plugin: PluginClassId;
  // As the pointer enters a handle: shows the link that feeds it as the link
  // shows while the pointer is over it, and spreads out its side where the
  // side is crowded.
  readonly enter: (handle: Entered) => void;
  // As the pointer leaves a handle: shows the link as before, and folds a
  // spread side back once the pointer has entered none of its handles for a
  // moment.
  readonly leave: () => void;
  // Opens core's menus of board actions and triggers board actions
  // (./actions.ts).
  readonly actions: GraphActions;
}

export const GraphContext = createContext<Graph | null>(null);

export function useGraph(): Graph {
  const graph = useContext(GraphContext);
  if (graph === null) throw new Error("A component of the DAG draws outside the DAG's root.");
  return graph;
}
