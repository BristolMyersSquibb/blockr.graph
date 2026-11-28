// The DAG's keys (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#keys).

import { afterEach, describe, expect, test } from "vitest";
import { COPY, CUT } from "../actions/index.ts";
import { keyAction } from "./keys.ts";
import type { Pressed } from "./keys.ts";

const selection = [{ block: "a" }, { link: "ab" }];

function pressed(key: string, mods: Partial<Pressed> = {}, target: EventTarget | null = document.body): Pressed {
  return { key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target, ...mods };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("a key in the DAG", () => {
  test("Backspace triggers Remove on the selection, through its role", () => {
    expect(keyAction(pressed("Backspace"), selection, false)).toEqual({ action: { role: "remove_selected_role" }, target: { selection } });
    expect(keyAction(pressed("Backspace"), [], false)).toBeUndefined();
  });

  test("Cmd or Ctrl with C and X triggers Copy and Cut", () => {
    expect(keyAction(pressed("c", { metaKey: true }), selection, false)).toEqual({ action: { id: COPY }, target: { selection } });
    expect(keyAction(pressed("x", { ctrlKey: true }), selection, false)).toEqual({ action: { id: CUT }, target: { selection } });
  });

  test("Cmd or Ctrl with V triggers nothing, so that the browser runs its own paste", () => {
    expect(keyAction(pressed("v", { ctrlKey: true }), [], false)).toBeUndefined();
    expect(keyAction(pressed("v", { metaKey: true }), selection, false)).toBeUndefined();
  });

  test("C and X copy nothing while the user has selected text or nothing", () => {
    expect(keyAction(pressed("c", { metaKey: true }), selection, true)).toBeUndefined();
    expect(keyAction(pressed("x", { metaKey: true }), selection, true)).toBeUndefined();
    expect(keyAction(pressed("c", { metaKey: true }), [], false)).toBeUndefined();
  });

  test("acts not with Shift or Alt held, nor without Cmd or Ctrl", () => {
    expect(keyAction(pressed("c", { metaKey: true, shiftKey: true }), selection, false)).toBeUndefined();
    expect(keyAction(pressed("Backspace", { altKey: true }), selection, false)).toBeUndefined();
    expect(keyAction(pressed("c"), selection, false)).toBeUndefined();
  });

  test("leaves alone a key pressed in a field, or in the DAG's panels", () => {
    const field = document.createElement("input");
    const panel = document.createElement("section");
    panel.className = "blockr-graph-panel";
    const button = document.createElement("button");
    panel.append(button);
    document.body.append(field, panel);
    expect(keyAction(pressed("Backspace", {}, field), selection, false)).toBeUndefined();
    expect(keyAction(pressed("c", { metaKey: true }, field), selection, false)).toBeUndefined();
    expect(keyAction(pressed("Backspace", {}, button), selection, false)).toBeUndefined();
  });
});
