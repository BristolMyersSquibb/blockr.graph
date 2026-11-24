// The DAG's UI: the `ui` of the DAG plugin's class, which every frontend
// places as it places any plugin with a `ui`, the dock in a panel and core's
// basic frontend in a section, and which core mounts with mountPlugin() in
// the element that the frontend gives
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2).
// It draws the board with React Flow, in a React root of its own, on the one
// copy of React that core puts on the page, as the Edit board plugin of core
// does, since the DAG's UI shares no React context with the frontend's.
// It works on the board through CoreApi alone.

import type { PluginModule } from "@blockr/core";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { GraphRoot } from "./graph.tsx";

export const ui: PluginModule = {
  render({ el, core, plugin }) {
    const root = createRoot(el);
    flushSync(() => {
      root.render(<GraphRoot core={core} plugin={plugin} />);
    });
    return () => {
      root.unmount();
    };
  },
};
