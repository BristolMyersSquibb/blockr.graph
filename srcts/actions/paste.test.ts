// The batch of the DAG's Paste
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#the-dags-board-actions).

import type { CoreApi } from "@blockr/core";
import { id } from "@blockr/core/stubs";
import { describe, expect, test } from "vitest";
import { boardOf } from "../testing/index.ts";
import { pasteBatch } from "./paste.ts";

// Mints ids as "n1", "n2" and on, one count for every collection, skipping
// those taken, as core's mintId() mints ids that the board does not hold.
function minter(): CoreApi["mintId"] {
  let n = 0;
  return (taken) => {
    let minted: string;
    do minted = `n${String(++n)}`;
    while (taken(minted));
    return minted;
  };
}

// The commands that a paste runs, as the batch names them.
const ADD_BLOCK = { package: "blockr.core", id: "add_block" };
const ADD_STACK = { package: "blockr.core", id: "add_stack" };
const ADD_LINK = { package: "blockr.core", id: "add_link" };

// The registry id of the class of each block that boardOf() makes, as a
// command's args hold it.
const HEAD_BLOCK = { package: "blockr.core", id: "head_block" };

// The board that the user pastes on, whose block n1 takes the first id that
// the minter gives.
const board = boardOf({ blocks: { n1: "Taken" } });

// The board that the store read from the clipboard: a feeding b, both in the
// stack s1, and the stack s2, which holds no block.
const read = boardOf({
  blocks: { a: "Iris", b: "Head" },
  links: [["a", "b"]],
  stacks: { s1: ["a", "b"], s2: [] },
  state: { positions: { a: { x: 100, y: 0 }, b: { x: 100, y: 150 } }, stacks: { s2: { x: 300, y: 50 } } },
});

describe("Paste", () => {
  test("adds the blocks, the stacks and the links under new ids, with the blocks' names and the stacks' names marked as copies", () => {
    const batch = pasteBatch(board, read, { x: 0, y: 0 }, { id, mintId: minter() });
    expect(batch.slice(0, 5)).toEqual([
      { id: ADD_BLOCK, args: { registry_id: HEAD_BLOCK, id: "n2", name: "Iris", state: {} } },
      { id: ADD_BLOCK, args: { registry_id: HEAD_BLOCK, id: "n3", name: "Head", state: {} } },
      { id: ADD_STACK, args: { id: "n4", name: "s1 (copy)", blocks: ["n2", "n3"], color: null } },
      { id: ADD_STACK, args: { id: "n5", name: "s2 (copy)", blocks: [], color: null } },
      { id: ADD_LINK, args: { id: "n6", from: "n2", to: "n3", input: "data" } },
    ]);
  });

  test("moves what it adds together, so that the middle of their positions lands at the point", () => {
    const [moved] = pasteBatch(board, read, { x: 1000, y: 1000 }, { id, mintId: minter() }).slice(-1);
    // The positions span 100 to 300 across and 0 to 150 down, so their middle
    // is at 200, 75.
    expect(moved).toEqual({
      id: { package: "blockr.graph", id: "change_position" },
      args: { positions: { n2: { x: 900, y: 925 }, n3: { x: 900, y: 1075 } }, stacks: { n5: { x: 1100, y: 975 } } },
    });
  });

  test("moves what it adds on to the free spot nearest the point, where it would come within the gap of a node", () => {
    const taken = boardOf({ blocks: { n1: "Taken" }, state: { positions: { n1: { x: 0, y: 0 } } } });
    const one = boardOf({ blocks: { a: "Iris" }, state: { positions: { a: { x: 500, y: 500 } } } });
    const [moved] = pasteBatch(taken, one, { x: 0, y: 0 }, { id, mintId: minter() }).slice(-1);
    // The nodes of "Taken" and "Iris" are 41 and 35 px wide, so "Iris" keeps
    // the gap of 70 px 108 px beside "Taken", which the grid rounds up to 110.
    expect(moved?.args).toEqual({ positions: { n2: { x: -110, y: 0 } }, stacks: {} });
  });

  test("keeps the positions as they were copied where no point is noted", () => {
    const [moved] = pasteBatch(board, read, undefined, { id, mintId: minter() }).slice(-1);
    expect(moved?.args).toEqual({ positions: { n2: { x: 100, y: 0 }, n3: { x: 100, y: 150 } }, stacks: { n5: { x: 300, y: 50 } } });
  });

  test("gives no position where the copied board gives none, so that the strategy starts the blocks", () => {
    const batch = pasteBatch(board, boardOf({ blocks: { a: "Iris" } }), { x: 0, y: 0 }, { id, mintId: minter() });
    expect(batch.map((call) => call.id)).toEqual([ADD_BLOCK]);
  });

  test("takes a variadic block's next place for a link with no input", () => {
    const variadic = boardOf({ blocks: { a: "A", b: "B" } });
    const linked = { ...variadic, links: { ab: { from: "a", to: "b", input: "" } } };
    expect(pasteBatch(board, linked, undefined, { id, mintId: minter() }).find((call) => call.id === id("blockr.core", "add_link"))?.args).toEqual({
      id: "n4",
      from: "n2",
      to: "n3",
    });
  });

  test("adds nothing for a board that holds nothing", () => {
    expect(pasteBatch(board, boardOf({ blocks: {} }), { x: 0, y: 0 }, { id, mintId: minter() })).toEqual([]);
  });
});
