// The DAG's five commands, which core registers with the class
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#commands).
// Each `description` and `args` describe it to the assistant's tools.
// They declare no `shortcut`, since the DAG binds its keys within its own
// element.
// They lock nothing of the DAG's own: each passes its preflight on a locked
// board, so that a reader moves blocks, lays the board out and collapses
// stacks there as on any board, while the store still refuses what the board
// lock fixes (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.1#on-a-locked-board).

import { layoutCommands } from "./layout.ts";
import { positionCommands } from "./positions.ts";
import { stackCommands } from "./stacks.ts";

export const graphCommands = [...positionCommands, ...layoutCommands, ...stackCommands];
