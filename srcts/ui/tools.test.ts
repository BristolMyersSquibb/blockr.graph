// The board actions that the DAG's toolbar offers from its own list
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-toolbar).

import type { BoardAction } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { COPY, PASTE } from "../actions/index.ts";
import { BOARD_TOOLS, listedKey, SELECTION_TOOLS, shownTools } from "./tools.ts";

// A board action of the package and the id given, which plays the role given,
// with the icon given, as core's on() gives it.
function action(pkg: string, id: string, role?: string, icon?: string): BoardAction {
  return {
    package: pkg,
    id,
    label: id,
    on: ["board", "selection"],
    category: "add",
    run: () => [],
    ...(role === undefined ? {} : { role }),
    ...(icon === undefined ? {} : { icon }),
  };
}

describe("the toolbar's list", () => {
  test("takes core's board actions by the roles that they play, and the DAG's by their ids, in the list's order", () => {
    const offered = [
      action("blockr.graph", PASTE, undefined, "<svg/>"),
      action("mykit", "add_block_action", "add_block_role"),
      action("blockr.core", "add_stack_action", "add_stack_role"),
      action("blockr.other", "export_action"),
    ];
    expect(shownTools(BOARD_TOOLS, offered)).toEqual([
      {
        kind: "add",
        label: "Add to the board",
        actions: [
          { listed: { role: "add_block_role" }, action: offered[1] },
          { listed: { role: "add_stack_role" }, action: offered[2] },
        ],
      },
      { kind: "button", listed: { id: PASTE }, action: offered[0], icon: "<svg/>" },
    ]);
  });

  test("takes the DAG's board actions by their package beside their ids", () => {
    const other = action("blockr.other", PASTE, undefined, "<svg/>");
    expect(shownTools(BOARD_TOOLS, [other])).toEqual([]);
    const own = action("blockr.graph", PASTE, undefined, "<svg/>");
    expect(shownTools(BOARD_TOOLS, [other, own])).toEqual([{ kind: "button", listed: { id: PASTE }, action: own, icon: "<svg/>" }]);
  });

  test("keys a role apart from a board action of the same id", () => {
    expect(listedKey({ role: PASTE })).not.toBe(listedKey({ id: PASTE }));
  });

  test("shows no + with nothing to pop out, and no button that a menu of the target does not offer", () => {
    expect(shownTools(BOARD_TOOLS, [])).toEqual([]);
    const copy = action("blockr.graph", COPY, undefined, "<svg/>");
    expect(shownTools(SELECTION_TOOLS, [copy])).toEqual([{ kind: "button", listed: { id: COPY }, action: copy, icon: "<svg/>" }]);
  });

  test("gives a board action the DAG's icon where it has none of its own", () => {
    const remove = action("mykit", "remove_action", "remove_selected_role");
    const [shown] = shownTools(SELECTION_TOOLS, [remove]);
    expect(shown?.kind === "button" ? shown.icon : undefined).toMatch(/^<svg/);
    const own = action("blockr.core", "remove_selected_action", "remove_selected_role", "<svg id='own'/>");
    expect(shownTools(SELECTION_TOOLS, [own])).toEqual([
      { kind: "button", listed: { role: "remove_selected_role" }, action: own, icon: "<svg id='own'/>" },
    ]);
  });
});
