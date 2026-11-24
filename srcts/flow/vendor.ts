// The parts of React Flow, `@xyflow/react`, that the DAG draws with, which the
// build bundles, minified, into xyflow-<hash>.js, which the DAG's module
// imports up front (../build/build.ts).
// React Flow imports React, which stays an import, so that it draws with the
// one copy of React that blockr.core puts on the page.
// React Flow 13 is built with the React Compiler, and the build preset gives
// it the compiler's runtime of that copy of React.

export {
  BaseEdge,
  getBezierPath,
  getViewportForBounds,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
