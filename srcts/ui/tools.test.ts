// The board actions that the DAG's toolbar offers from its own list
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-toolbar).

import type { BoardAction } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { COPY, PASTE } from "../actions/index.ts";
import { BOARD_TOOLS, SELECTION_TOOLS, shownTools } from "./tools.ts";

// A board action of the id given, which plays the role given, with the icon
// given.
function action(id: string, role?: string, icon?: string): BoardAction {
  return { id, label: id, on: ["board", "selection"], category: "add", run: () => [], ...(role === undefined ? {} : { role }), ...(icon === undefined ? {} : { icon }) };
}

describe("the toolbar's list", () => {
  test("takes core's board actions by the roles that they play, and the DAG's by their ids, in the list's order", () => {
    const offered = [
      action(PASTE, undefined, "<svg/>"),
      action("mykit-add_block_action", "add_block_role"),
      action("blockr.core-add_stack_action", "add_stack_role"),
      action("blockr.other-export_action"),
    ];
    expect(shownTools(BOARD_TOOLS, offered)).toEqual([
      { kind: "add", label: "Add to the board", actions: [offered[1], offered[2]] },
      { kind: "button", action: offered[0], icon: "<svg/>" },
    ]);
  });

  test("shows no + with nothing to pop out, and no button that a menu of the target does not offer", () => {
    expect(shownTools(BOARD_TOOLS, [])).toEqual([]);
    const copy = action(COPY, undefined, "<svg/>");
    expect(shownTools(SELECTION_TOOLS, [copy])).toEqual([{ kind: "button", action: copy, icon: "<svg/>" }]);
  });

  test("gives a board action the DAG's icon where it has none of its own", () => {
    const remove = action("mykit-remove_action", "remove_selected_role");
    const [shown] = shownTools(SELECTION_TOOLS, [remove]);
    expect(shown?.kind === "button" ? shown.icon : undefined).toMatch(/^<svg/);
    const own = action("blockr.core-remove_selected_action", "remove_selected_role", "<svg id='own'/>");
    expect(shownTools(SELECTION_TOOLS, [own])).toEqual([{ kind: "button", action: own, icon: "<svg id='own'/>" }]);
  });
});
