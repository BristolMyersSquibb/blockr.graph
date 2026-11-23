// The module of the DAG plugin's class, blockr.graph-graph_plugin, which
// blockr.graph lists in R with the class's id and the name "Workflow". Its
// default export is the class without its id
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.1.12#a-plugin).
// The class keeps the DAG's state, which ../../state defines.
// It gives core the schema of the state, which the build generates from the
// state's types, and the default of the state, which holds no position.

import type { PluginClass } from "@blockr/core";
// The schema of the class's state is the file that the build writes for R,
// beside the bundle.
// eslint-disable-next-line no-restricted-imports
import schema from "../../../inst/js/graph.schema.json" with { type: "json" };
import { defaultState } from "../../state/index.ts";

export const api = 1;

export default {
  state: { schema, default: defaultState },
} satisfies Omit<PluginClass, "id">;
