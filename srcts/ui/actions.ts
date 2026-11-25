// How the DAG opens core's menus of board actions and triggers board actions,
// from its canvas, its toolbar and its keys. The DAG draws no menu, block
// picker or editor of its own
// (https://github.com/BristolMyersSquibb/blockr/wiki/Rewrite-1.3.2#gestures):
//
// - A right click opens the menu of its object through
//   core.boardActions.menu(), at the pointer, or the menu of the selection
//   where the object is one of several that the user selected.
// - A button of the toolbar, a key and a link dropped on the canvas trigger a
//   board action through core.boardActions.trigger(), by its id or by the id
//   of a role.
//
// Each call hands core:
//
// - The DAG's element, or the toolbar's button, as the element that the user
//   triggered from, to which the keyboard's focus returns as a menu closes.
// - Where the menu opens: at the pointer for a right click and a dropped
//   link, and to the right of the toolbar for its buttons, level with the
//   button, as the panel of search opens to the right of the toolbar's first
//   button.
// - For the canvas, the toolbar's board actions on the board and a dropped
//   link, an `extend` that starts what the board action adds at a point: where
//   the user right-clicked, the middle of the view, or the drop (./added.ts).
// - A `notifier`, so that the DAG shows a refused batch where it opened the
//   menu or triggered the board action, and core raises none.
// - The panel of advanced actions as `advanced`, where the panel has room
//   beside the object of the target (./panel.tsx).
//
// Before each call, the DAG notes the point where the user pastes, for
// Paste's run: where the menu opens, or the middle of its view for a button or
// a key (../actions).

import type { CoreApi, Notification, Target } from "@blockr/core";
import { useEffect, useMemo, useRef } from "react";
import { notePoint } from "../actions/index.ts";
import type { Point } from "../state/index.ts";
import { startAt } from "./added.ts";
import type { Panel } from "./panel.tsx";

// Where a board action is triggered from: a button of the toolbar, a key, or a
// link that the user dropped on the canvas, with the drop on the screen and on
// the canvas.
export type TriggeredFrom =
  | { readonly button: HTMLElement }
  | { readonly key: true }
  | { readonly drop: { readonly client: Point; readonly canvas: Point } };

export interface GraphActions {
  // Opens the menu of the target where the user right-clicked, at the point on
  // the screen.
  readonly menu: (target: Target, client: Point) => void;
  // Triggers the board action with the id given, or the board action that
  // plays the role with the id given, and resolves once it ends.
  readonly trigger: (id: string, target: Target, from: TriggeredFrom) => Promise<void>;
}

export interface ActionParts {
  readonly core: CoreApi;
  // The DAG's element.
  readonly element: () => HTMLElement | null;
  // The point on the canvas under a point on the screen.
  readonly toCanvas: (client: Point) => Point;
  // Shows why the board took nothing, at a point on the screen.
  readonly refuse: (client: Point, message: string) => void;
  readonly panel: Panel["advanced"];
}

// The DAG's actions for its components: the same object on every render,
// whose calls read the parts that the DAG's root gave last.
export function useGraphActions(parts: ActionParts): GraphActions {
  const latest = useRef(parts);
  useEffect(() => {
    latest.current = parts;
  });
  return useMemo<GraphActions>(
    () => ({
      menu(target, client) {
        graphActions(latest.current).menu(target, client);
      },
      trigger: (id, target, from) => graphActions(latest.current).trigger(id, target, from),
    }),
    [],
  );
}

export function graphActions({ core, element, toCanvas, refuse, panel }: ActionParts): GraphActions {
  // What starts what the batch adds at the point, through `extend`.
  const extendAt = (point: Point) => (deltas: Parameters<typeof startAt>[1]) => {
    let after;
    try {
      after = core.store.dryRun(deltas);
    } catch {
      // The store refuses the batch, and tells the notifier why.
      return [];
    }
    return startAt(after, deltas, point);
  };
  const notifierAt = (client: Point) => (notifications: readonly Notification[]) => {
    refuse(client, notifications.map((notification) => notification.message).join("\n"));
  };

  return {
    menu(target, client) {
      const el = element();
      if (el === null) return;
      const point = toCanvas(client);
      notePoint(point);
      const advanced = panel(target);
      core.boardActions.menu(target, {
        el,
        anchor: new DOMRect(client.x, client.y, 0, 0),
        ...("board" in target ? { extend: extendAt(point) } : {}),
        notifier: notifierAt(client),
        ...(advanced === undefined ? {} : { advanced }),
      });
    },
    async trigger(id, target, from) {
      const frame = element();
      const el = "button" in from ? from.button : frame;
      if (el === null || frame === null) return;
      const middle = middleOf(frame);
      const at = "drop" in from ? from.drop : { client: middle, canvas: toCanvas(middle) };
      notePoint(at.canvas);
      const advanced = panel(target);
      const button = "button" in from ? from.button.getBoundingClientRect() : undefined;
      const anchor = "drop" in from ? new DOMRect(from.drop.client.x, from.drop.client.y, 0, 0) : "button" in from ? besideToolbar(from.button) : undefined;
      await core.boardActions
        .trigger(id, target, {
          el,
          ...(anchor === undefined ? {} : { anchor }),
          ...("board" in target || "drop" in from ? { extend: extendAt(at.canvas) } : {}),
          notifier: notifierAt(button === undefined ? at.client : { x: button.right, y: button.top }),
          ...(advanced === undefined ? {} : { advanced }),
        })
        .catch(() => undefined);
    },
  };
}

// How far below its anchor core's menu hangs: the offset of the popover of
// core's React SDK.
const MENU_OFFSET = 4;

// How far to the right of the toolbar a menu opens, as the panel of search
// keeps from it (../modules/graph/index.css).
const SIDE_GAP = 8;

// Where a menu that a button of the toolbar opens hangs from: SIDE_GAP to the
// right of the toolbar, so that the menu's top lies as far above the button's
// as the toolbar's own top lies above its first button's, which the toolbar's
// border and padding set alike on every side.
function besideToolbar(button: HTMLElement): DOMRect {
  const rect = button.getBoundingClientRect();
  const toolbar = button.closest(".blockr-graph-toolbar")?.getBoundingClientRect() ?? rect;
  const inset = rect.left - toolbar.left;
  return new DOMRect(toolbar.right + SIDE_GAP, rect.top - inset - MENU_OFFSET, 0, 0);
}

// The middle of the element, on the screen.
function middleOf(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
