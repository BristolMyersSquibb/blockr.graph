// The board actions that the DAG's toolbar offers: a list of its own, rather
// than every board action that core's menus offer on the board and on the
// selection, so that the toolbar stays short and each button reads at a
// glance.
//
// - On the board: a + that pops out Add block, Create link and Create stack,
//   then Paste and Layout.
// - On the selection, while the user has selected something: a + that pops
//   out Create stack and Add to stack, then Copy, Cut and Remove.
//
// The list names core's board actions by the roles that they play, so that a
// board action that the app picks for a role takes its place, and the DAG's
// own by their ids within blockr.graph. A + pops out board actions that share
// an icon, the plus of core's that add, or that have none, as Add to stack, so
// that no button needs an icon that tells apart a link from a stack.
// A button shows its board action's icon, or the DAG's own where the board
// action has none, as a board action that an app picks for a role may lack
// one.
// The toolbar shows only what a menu of the target offers now, as core's
// on() gives it, so that under the board lock it offers what the lock leaves:
// a + with nothing to pop out shows no button.

import type { BoardAction } from "@blockr/core";
import { COPY, CUT, LAYOUT, PASTE } from "../actions/index.ts";

// A board action of the list: one of core's, by the role that it plays, or
// one of the DAG's, by its id within blockr.graph, as PASTE. The id of a role
// and the id of a board action are both plain strings, so the record's key,
// `role` or `id`, tells them apart. The DAG triggers an { id } as
// core.id("blockr.graph", id).
export type Listed = { readonly role: string } | { readonly id: string };

// A tool of the list: a button of one board action, with the DAG's icon for
// it where the board action may have none, or a + that pops out several.
export type Tool =
  | { readonly kind: "button"; readonly action: Listed; readonly icon?: string }
  | { readonly kind: "add"; readonly label: string; readonly actions: readonly Listed[] };

// A tool as the toolbar shows it, with the board actions that a menu of the
// target offers, each beside the entry of the list that names it, by which
// the toolbar keys it, since two packages may give board actions of one id.
export type ShownTool =
  | { readonly kind: "button"; readonly listed: Listed; readonly action: BoardAction; readonly icon: string }
  | { readonly kind: "add"; readonly label: string; readonly actions: readonly { readonly listed: Listed; readonly action: BoardAction }[] };

// The bin of a button that removes, in the shape of core's, for a board
// action that plays remove_selected_role and has no icon.
const BIN =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 9h6.6l.7-9"/></svg>';

export const BOARD_TOOLS: readonly Tool[] = [
  {
    kind: "add",
    label: "Add to the board",
    actions: [{ role: "add_block_role" }, { role: "add_link_role" }, { role: "add_stack_role" }],
  },
  { kind: "button", action: { id: PASTE } },
  { kind: "button", action: { id: LAYOUT } },
];

export const SELECTION_TOOLS: readonly Tool[] = [
  { kind: "add", label: "Add the selection to a stack", actions: [{ role: "add_stack_role" }, { role: "add_to_stack_role" }] },
  { kind: "button", action: { id: COPY } },
  { kind: "button", action: { id: CUT } },
  { kind: "button", action: { role: "remove_selected_role" }, icon: BIN },
];

// The tools of the list that a menu of the target offers, given the board
// actions that core's on() gives the target: each button whose board action
// it offers, and each + with the board actions of it that it offers, in the
// order of the list. It finds a board action of the DAG's by its package,
// blockr.graph, beside its id.
export function shownTools(tools: readonly Tool[], offered: readonly BoardAction[]): ShownTool[] {
  const find = (listed: Listed): BoardAction | undefined =>
    offered.find((action) => ("role" in listed ? action.role === listed.role : action.package === "blockr.graph" && action.id === listed.id));
  return tools.flatMap((tool): ShownTool[] => {
    if (tool.kind === "add") {
      const actions = tool.actions.flatMap((listed) => {
        const action = find(listed);
        return action === undefined ? [] : [{ listed, action }];
      });
      return actions.length === 0 ? [] : [{ kind: "add", label: tool.label, actions }];
    }
    const action = find(tool.action);
    if (action === undefined) return [];
    return [
      {
        kind: "button",
        listed: tool.action,
        action,
        icon: action.icon === undefined || action.icon === "" ? (tool.icon ?? "") : action.icon,
      },
    ];
  });
}

// What tells the entry of the list apart from the others of its tool or its
// group, as a React key: the role, or the id of the DAG's board action.
export function listedKey(listed: Listed): string {
  return "role" in listed ? `role:${listed.role}` : `id:${listed.id}`;
}
