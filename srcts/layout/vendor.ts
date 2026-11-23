// The part of dagre that laying the board out uses
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#laying-the-board-out-again).
// The build bundles it, minified, into dagre-<hash>.js, which the DAG loads
// only once it lays a board out, in place of this file.

export { graphlib, layout } from "@dagrejs/dagre";
