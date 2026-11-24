// The selection that the DAG draws from core.selection and sets from React
// Flow's changes (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures).

import type { BoardObject } from "@blockr/core";
import { describe, expect, test } from "vitest";
import { sameSelection, selectedIds, selectionAfter, shownBlock } from "./selection.ts";

const DRAWN = new Set(["b:a", "b:b", "b:c", "s:s1", "l:ab", "l:bc", "l:ca"]);

describe("the selection after React Flow's changes", () => {
  test("is what the changes leave selected, in the order of the selection and then of the changes", () => {
    const before: BoardObject[] = [{ block: "a" }, { link: "ab" }];
    expect(
      selectionAfter(before, DRAWN, [
        { id: "b:c", selected: true },
        { id: "l:ab", selected: false },
      ]),
    ).toEqual([{ block: "a" }, { block: "c" }]);
  });

  test("drops what the DAG does not draw where a change unselects something, as a click does", () => {
    const before: BoardObject[] = [{ block: "a" }, { block: "hidden" }, { option: "n_rows" }];
    expect(
      selectionAfter(before, DRAWN, [
        { id: "b:a", selected: false },
        { id: "b:b", selected: true },
      ]),
    ).toEqual([{ block: "b" }]);
  });

  test("keeps what the DAG does not draw where every change selects, as a click with Cmd or Ctrl does", () => {
    const before: BoardObject[] = [{ block: "hidden" }, { option: "n_rows" }];
    expect(selectionAfter(before, DRAWN, [{ id: "b:b", selected: true }])).toEqual([{ block: "hidden" }, { option: "n_rows" }, { block: "b" }]);
  });

  test("of a rectangle keeps only the links whose two nodes it covers", () => {
    const edges = [
      { id: "l:ab", source: "b:a", target: "b:b" },
      { id: "l:bc", source: "b:b", target: "b:c" },
      { id: "l:ca", source: "b:c", target: "b:a" },
    ];
    const changes = ["b:a", "b:b", "l:ab", "l:bc", "l:ca"].map((id) => ({ id, selected: true }));
    expect(selectionAfter([], DRAWN, changes, { edges })).toEqual([{ block: "a" }, { block: "b" }, { link: "ab" }]);
    expect(selectionAfter([], DRAWN, changes)).toHaveLength(5);
  });
});

describe("a selection", () => {
  test("draws the nodes and the edges of its blocks, stacks and links", () => {
    expect([...selectedIds([{ block: "a" }, { stack: "s1" }, { link: "ab" }, { option: "n_rows" }])]).toEqual(["b:a", "s:s1", "l:ab"]);
  });

  test("shows its block where it holds one block alone", () => {
    expect(shownBlock([{ block: "a" }])).toBe("a");
    expect(shownBlock([{ block: "a" }, { block: "b" }])).toBeUndefined();
    expect(shownBlock([{ stack: "s1" }])).toBeUndefined();
    expect(shownBlock([{ link: "ab" }])).toBeUndefined();
    expect(shownBlock([])).toBeUndefined();
  });

  test("is the same as another that holds the same objects in any order", () => {
    expect(sameSelection([{ block: "a" }, { link: "ab" }], [{ link: "ab" }, { block: "a" }])).toBe(true);
    expect(sameSelection([{ block: "a" }], [{ block: "a" }, { block: "b" }])).toBe(false);
    expect(sameSelection([{ block: "a" }], [{ stack: "a" }])).toBe(false);
  });
});
