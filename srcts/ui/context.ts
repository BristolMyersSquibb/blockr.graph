// What the components that draw the DAG share: CoreApi, the id of the
// plugin's class, and what a node tells the canvas, through a React context
// of the DAG's own root.

import type { CoreApi, LinkId, PluginClassId } from "@blockr/core";
import { createContext, useContext } from "react";

export interface Graph {
  readonly core: CoreApi;
  // The id of the plugin's class, under which the board holds the DAG's
  // state.
  readonly plugin: PluginClassId;
  // Shows the link as it shows while the pointer is over it, or none, as the
  // pointer enters and leaves the handle of the input that the link feeds.
  readonly hover: (link: LinkId | null) => void;
}

export const GraphContext = createContext<Graph | null>(null);

export function useGraph(): Graph {
  const graph = useContext(GraphContext);
  if (graph === null) throw new Error("A component of the DAG draws outside the DAG's root.");
  return graph;
}
