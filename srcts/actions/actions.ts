// The DAG's four board actions, which its class lists in `boardActions`
// beside core's, and which every menu of their objects offers
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-dags-board-actions):
//
// | Board action | On                                  | Category  |
// |--------------|-------------------------------------|-----------|
// | Copy         | A block, a stack or a selection     | clipboard |
// | Cut          | A block, a stack or a selection     | clipboard |
// | Paste        | The board                           | clipboard |
// | Layout       | The board                           | edit      |
//
// - Copy puts on the clipboard, at once, a JSON board of the blocks and stacks
//   that it acts on, with their positions (./copy.ts, ./clipboard.ts). It runs
//   no command.
// - Cut copies, then runs core's commands that remove the blocks and stacks
//   that it copied, as one step.
// - Paste reads the clipboard, and the board on it through
//   core.store.read(), which gives the board that opening the text would give,
//   its blocks migrated, and what opening it would drop, holding nothing. It
//   adds the blocks, links and stacks of that board under new ids, where they
//   sat as they were copied, moved together to the point that the DAG's UI
//   noted last (./paste.ts, ./noted.ts). Its run returns a promise, since it
//   reads the clipboard before it returns its batch. It leaves the board alone
//   where the text is no JSON board, as today's paste does. A block whose
//   class the app lacks is left out of the paste, since the store leaves it
//   out of the board that it reads. The DAG raises no notification of it, as
//   core is to raise one for what read() leaves out
//   (https://github.com/BristolMyersSquibb/blockr.core/issues/878).
// - Layout's quick action lays the board out again and sets the placement of
//   new blocks and snapping (./layout.ts).
//
// Under the board lock, Cut and Paste fail their offers, since the store
// refuses what they run, while Copy and Layout stay, since copying changes
// nothing and the DAG locks nothing of its own
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#on-a-locked-board).
// Copy and Cut fail their offers as well where the target names no block or
// stack that the board holds, so that no menu offers them for a link alone.

import type { BoardAction, CommandCall, CoreApi, Target } from "@blockr/core";
import { defaultState, graphState } from "../state/index.ts";
import { readClipboard, writeClipboard } from "./clipboard.ts";
import { copiedBoard, copiedOf, copies } from "./copy.ts";
import type { Copied } from "./copy.ts";
import { COPY_ICON, CUT_ICON, LAYOUT_ICON, PASTE_ICON } from "./icons.ts";
import { layoutLevel } from "./layout.ts";
import { notedPoint } from "./noted.ts";
import { pasteBatch } from "./paste.ts";

export const COPY = "blockr.graph-copy_action";
export const CUT = "blockr.graph-cut_action";
export const PASTE = "blockr.graph-paste_action";
export const LAYOUT = "blockr.graph-layout_action";

export const graphBoardActions: readonly BoardAction[] = [
  {
    id: COPY,
    label: "Copy",
    icon: COPY_ICON,
    on: ["block", "stack", "selection"],
    category: "clipboard",
    offers: (board, target) => copies(board, target),
    run(_board, target, core) {
      copy(target, core);
      return undefined;
    },
  },
  {
    id: CUT,
    label: "Cut",
    icon: CUT_ICON,
    on: ["block", "stack", "selection"],
    category: "clipboard",
    offers: (board, target, lock) => !lock.board && copies(board, target),
    run(_board, target, core) {
      const { blocks, stacks } = copy(target, core);
      return [
        ...blocks.map((id): CommandCall => ({ id: "blockr.core-remove_block", args: { id } })),
        ...stacks.map((id): CommandCall => ({ id: "blockr.core-remove_stack", args: { id } })),
      ];
    },
  },
  {
    id: PASTE,
    label: "Paste",
    icon: PASTE_ICON,
    on: ["board"],
    category: "clipboard",
    offers: (_board, _target, lock) => !lock.board,
    async run(_board, _target, core) {
      const text = await readClipboard(document);
      if (text === undefined) return undefined;
      let read: Awaited<ReturnType<CoreApi["store"]["read"]>>;
      try {
        read = await core.store.read(text);
      } catch {
        return undefined;
      }
      const batch = pasteBatch(core.store.board(), read.board, notedPoint(), (taken) => core.mintId(taken));
      return batch.length === 0 ? undefined : batch;
    },
  },
  {
    id: LAYOUT,
    label: "Layout",
    icon: LAYOUT_ICON,
    on: ["board"],
    category: "edit",
    quick: (board, _target, core) => layoutLevel((graphState(board) ?? defaultState).layout, core),
  },
];

// Puts the JSON board of what the target names on the clipboard, at once, so
// that the write starts within the user's gesture, and returns what it
// copied.
function copy(target: Target, core: CoreApi): Copied {
  const board = core.store.board();
  const copied = copiedOf(board, target);
  if (copied.blocks.length + copied.stacks.length > 0) {
    void writeClipboard(document, JSON.stringify(copiedBoard(core.store.jsonBoard(), copied)));
  }
  return copied;
}
