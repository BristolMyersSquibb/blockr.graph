// The DAG's keys, which it binds on its own element rather than on the whole
// document, so that they never fire while the user types in a block's UI
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#keys).
// They act on the selection that core.selection holds:
//
// - Backspace triggers Remove on the selection, through its role,
//   remove_selected_role, as React Flow binds it.
// - Cmd or Ctrl with C, X and V triggers Copy, Cut and Paste, but for C and X
//   while the user has selected text, which the browser copies as usual.
//
// Within its element, the DAG leaves alone a key that the user presses in a
// field, and every key that the user presses in its panel of advanced actions
// or its panel of search and the outline, whose forms and fields take their
// own keys.
// The arrow keys, Enter, Space and Escape on a node are React Flow's, which
// move and select the nodes (./canvas.tsx).

import type { BoardObject, Target } from "@blockr/core";
import { COPY, CUT, PASTE } from "../actions/index.ts";

// A key that the user pressed, as a keyboard event gives it.
export interface Pressed {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly target: EventTarget | null;
}

// What a key triggers: a board action, by its id or a role's, on a target.
export interface KeyAction {
  readonly id: string;
  readonly target: Target;
}

// Where the DAG's keys do not act: in a field, and in its panels.
const OWN_KEYS = "input, textarea, select, [contenteditable]:not([contenteditable='false']), .blockr-graph-panel, .blockr-graph-search";

// The board action that the key triggers, with its target, or undefined for a
// key that the DAG leaves alone. The selection is what core.selection holds,
// and `text` whether the user has selected text on the page.
export function keyAction(pressed: Pressed, selection: readonly BoardObject[], text: boolean): KeyAction | undefined {
  const { target } = pressed;
  if (target instanceof Element && target.closest(OWN_KEYS) !== null) return undefined;
  if (target instanceof HTMLElement && target.isContentEditable) return undefined;
  const mod = pressed.metaKey || pressed.ctrlKey;
  if (pressed.altKey || pressed.shiftKey) return undefined;
  const chosen = selection.length === 0 ? undefined : { selection };
  if (pressed.key === "Backspace" && !mod) return chosen === undefined ? undefined : { id: "remove_selected_role", target: chosen };
  if (!mod) return undefined;
  switch (pressed.key.toLowerCase()) {
    case "c":
      return text || chosen === undefined ? undefined : { id: COPY, target: chosen };
    case "x":
      return text || chosen === undefined ? undefined : { id: CUT, target: chosen };
    case "v":
      return { id: PASTE, target: { board: true } };
    default:
      return undefined;
  }
}
