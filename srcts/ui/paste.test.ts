// How the DAG pastes as the user presses Cmd or Ctrl with V, through the
// browser's paste (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#keys).
// The browser fires the paste event at the page's body where nothing is
// selected, as these tests do.

import { afterEach, describe, expect, test } from "vitest";
import { onPaste } from "./paste.ts";

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

// The DAG's element, focusable as the DAG's is, with a field of its own, and
// what it pasted.
function dag(): { el: HTMLElement; field: HTMLInputElement; pasted: string[] } {
  const el = document.createElement("div");
  el.tabIndex = -1;
  const field = document.createElement("input");
  el.append(field);
  document.body.append(el);
  const pasted: string[] = [];
  stops.push(
    onPaste(el, (text) => {
      pasted.push(text);
    }),
  );
  return { el, field, pasted };
}

// Fires the browser's paste of the text at the page's body, and returns
// whether a listener prevented its default.
function paste(text: string): boolean {
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", text);
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });
  document.body.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("the browser's paste", () => {
  test("pastes its text while the focus lies within the DAG's element, in place of the browser", () => {
    const { el, pasted } = dag();
    el.focus();
    expect(paste("Iris")).toBe(true);
    expect(pasted).toEqual(["Iris"]);
  });

  test("is left to the browser where the focus lies in a field of the DAG, or outside the DAG", () => {
    const { field, pasted } = dag();
    field.focus();
    expect(paste("Iris")).toBe(false);
    field.blur();
    expect(paste("Iris")).toBe(false);
    expect(pasted).toEqual([]);
  });

  test("stops as the DAG unmounts", () => {
    const { el, pasted } = dag();
    for (const stop of stops.splice(0)) stop();
    el.focus();
    expect(paste("Iris")).toBe(false);
    expect(pasted).toEqual([]);
  });
});
