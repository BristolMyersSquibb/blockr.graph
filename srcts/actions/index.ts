// The DAG's board actions, Copy, Cut, Paste and Layout, which its class lists
// in `boardActions`, and what the DAG's UI notes for them: where the user
// pastes, and how each canvas fits its view after a layout.

export { CLIPBOARD_UNREAD, COPY, CUT, graphBoardActions, LAYOUT, NOTHING_TO_PASTE, PASTE } from "./actions.ts";
export { fitViews, notedPaste, notePaste, onFit } from "./noted.ts";
export type { NotedPaste } from "./noted.ts";
