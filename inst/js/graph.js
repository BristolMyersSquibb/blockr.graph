// inst/js/graph.schema.json
var graph_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    positions: {
      type: "object",
      additionalProperties: {
        $ref: "#/definitions/Point"
      },
      description: "Where each block sits on the canvas, by the block's id: the centre of the block's node, which holds its mark and its name below it. The canvas is no panel or view of the frontend. Set only the blocks to move: every other block keeps its position. Laying the board out again moves every block, so run blockr.graph-relayout before placing blocks by hand."
    },
    stacks: {
      type: "object",
      additionalProperties: {
        $ref: "#/definitions/StackEntry"
      },
      description: "What the DAG keeps about a stack, by the stack's id, for a stack that holds no block, or one with blocks that the DAG shows collapsed. A stack that holds blocks and shows expanded has no entry."
    },
    layout: {
      $ref: "#/definitions/Layout",
      description: "How the DAG arranges the board."
    }
  },
  required: [
    "positions",
    "stacks",
    "layout"
  ],
  additionalProperties: false,
  description: "The state of the Workflow, which draws the board as a directed acyclic graph of its blocks and the links between them: where each block sits on the canvas, what the DAG keeps about stacks, and how it arranges the board.",
  definitions: {
    Point: {
      type: "object",
      properties: {
        x: {
          type: "number",
          description: "How far to the right the point lies."
        },
        y: {
          type: "number",
          description: "How far down the point lies."
        }
      },
      required: [
        "x",
        "y"
      ],
      additionalProperties: false,
      description: "A point on the canvas, in pixels, with x to the right and y downwards. A block is about 50 px across, so a block beside another sits about 150 px from it: to its left or right at the same y, or above or below it at the same x."
    },
    StackEntry: {
      anyOf: [
        {
          $ref: "#/definitions/Point"
        },
        {
          $ref: "#/definitions/Collapse"
        }
      ],
      description: "What the DAG keeps about a stack: the position of a stack that holds no block, or the collapse of a stack with blocks."
    },
    Collapse: {
      type: "object",
      properties: {
        collapsed: {
          type: "number",
          description: "The stack's place among the collapses, in the order they were made."
        },
        moved: {
          $ref: "#/definitions/Moved",
          description: "What collapsing the stack moved to close up on it, which expanding it puts back."
        }
      },
      required: [
        "collapsed",
        "moved"
      ],
      additionalProperties: false,
      description: "A stack with blocks that the DAG shows collapsed, as a small box centred where its blocks sit."
    },
    Moved: {
      type: "object",
      properties: {
        positions: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Move"
          },
          description: "The blocks that the collapse moved, by the block's id."
        },
        stacks: {
          type: "object",
          additionalProperties: {
            $ref: "#/definitions/Move"
          },
          description: "The stacks that hold no block and that the collapse moved, by the stack's id."
        }
      },
      required: [
        "positions",
        "stacks"
      ],
      additionalProperties: false,
      description: "What a collapse moved, by id, each from where and to where."
    },
    Move: {
      type: "object",
      properties: {
        from: {
          $ref: "#/definitions/Point",
          description: "Where the block or stack sat before the move."
        },
        to: {
          $ref: "#/definitions/Point",
          description: "Where the move put it."
        }
      },
      required: [
        "from",
        "to"
      ],
      additionalProperties: false,
      description: "A move, from one point to another."
    },
    Layout: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: [
            "TB",
            "LR"
          ],
          description: "The way that the board runs: TB from top to bottom, or LR from left to right."
        },
        spacing: {
          type: "string",
          enum: [
            "compact",
            "normal",
            "loose"
          ],
          description: "The gaps between blocks and between ranks: 50 px when compact, 70 px when normal and 100 px when loose."
        },
        placement: {
          type: "string",
          enum: [
            "repulsion",
            "beside"
          ],
          description: "How a block that a step adds gets its place: repulsion keeps it where it starts and moves the blocks around it to make room, and beside moves it to the nearest free spot and moves no other block."
        },
        snap: {
          type: "boolean",
          description: "Whether every position that the DAG sets snaps to a multiple of snap_size."
        },
        snap_size: {
          type: "number",
          description: "The size that positions snap to, in pixels of the canvas.",
          exclusiveMinimum: 0
        }
      },
      required: [
        "direction",
        "spacing",
        "placement",
        "snap",
        "snap_size"
      ],
      additionalProperties: false,
      description: "How the DAG arranges the board. Changing the direction or the spacing through blockr.graph-relayout lays the whole board out again."
    }
  }
};

// srcts/state/json.ts
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// srcts/state/patch.ts
function pointer(segments) {
  return segments.map((segment) => `/${segment.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
}
function segmentsFromPath(path) {
  if (!path.startsWith("/")) return void 0;
  const segments = path.slice(1).split("/");
  if (segments.some((segment) => /~(?![01])/.test(segment))) return void 0;
  return segments.map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}
function patched(state, patches, plugin) {
  let at2 = state;
  for (const patch of patches) {
    const segments = segmentsFromPath(patch.path);
    if (segments?.[0] !== "plugins" || segments[1] !== plugin) continue;
    at2 = at2 === void 0 ? void 0 : applied(at2, segments.slice(2), patch);
  }
  return at2;
}
function applied(at2, segments, patch) {
  const [segment, ...rest] = segments;
  if (segment === void 0) return patch.op === "replace" ? patch.value : void 0;
  if (!isObject(at2)) return void 0;
  const has = Object.hasOwn(at2, segment);
  if (rest.length > 0) {
    const inner = has ? applied(at2[segment], rest, patch) : void 0;
    return inner === void 0 ? void 0 : { ...at2, [segment]: inner };
  }
  if (patch.op === "remove") {
    return has ? Object.fromEntries(Object.entries(at2).filter(([name]) => name !== segment)) : void 0;
  }
  if (patch.value === void 0 || patch.op === "replace" && !has) return void 0;
  return { ...at2, [segment]: patch.value };
}

// srcts/state/state.ts
var GRAPH = "blockr.graph-graph_plugin";
var defaultState = {
  positions: {},
  stacks: {},
  layout: { direction: "TB", spacing: "normal", placement: "repulsion", snap: false, snap_size: 20 }
};
function graphState(board, plugin = GRAPH) {
  const state = board.plugins[plugin];
  return isGraphState(state) ? state : void 0;
}
function isGraphState(value) {
  return isObject(value) && isRecordOf(value.positions, isPoint) && isRecordOf(value.stacks, isStackEntry) && isLayout(value.layout);
}
function isCollapse(entry) {
  return "collapsed" in entry;
}
function isPoint(value) {
  return isObject(value) && typeof value.x === "number" && typeof value.y === "number";
}
function isStackEntry(value) {
  if (!isObject(value)) return false;
  if (!("collapsed" in value)) return isPoint(value);
  return typeof value.collapsed === "number" && isMoved(value.moved);
}
function isMoved(value) {
  return isObject(value) && isRecordOf(value.positions, isMove) && isRecordOf(value.stacks, isMove);
}
function isMove(value) {
  return isObject(value) && isPoint(value.from) && isPoint(value.to);
}
function isLayout(value) {
  return isObject(value) && (value.direction === "TB" || value.direction === "LR") && (value.spacing === "compact" || value.spacing === "normal" || value.spacing === "loose") && (value.placement === "repulsion" || value.placement === "beside") && typeof value.snap === "boolean" && typeof value.snap_size === "number";
}
function isRecordOf(value, item) {
  return isObject(value) && Object.values(value).every(item);
}

// srcts/actions/clipboard.ts
var last;
function writeClipboard(doc, text) {
  last = text;
  const clipboard = clipboardOf(doc);
  if (clipboard === void 0) return Promise.resolve(copyCommand(doc, text));
  return clipboard.writeText(text).then(
    () => true,
    () => copyCommand(doc, text)
  );
}
async function readClipboard(doc) {
  const clipboard = clipboardOf(doc);
  if (clipboard === void 0) return last;
  try {
    return await clipboard.readText();
  } catch {
    return last;
  }
}
function clipboardOf(doc) {
  const { clipboard } = doc.defaultView?.navigator ?? {};
  return clipboard;
}
function copyCommand(doc, text) {
  const before = doc.activeElement;
  const field = doc.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position: fixed; inset-block-start: 0; opacity: 0;";
  doc.body.append(field);
  field.select();
  try {
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (before instanceof HTMLElement) before.focus({ preventScroll: true });
  }
}

// srcts/actions/copy.ts
function copiedOf(board, target) {
  const objects = "selection" in target ? target.selection : [target];
  const actedBlocks = /* @__PURE__ */ new Set();
  const actedStacks = /* @__PURE__ */ new Set();
  for (const object2 of objects) {
    if ("input" in object2) continue;
    if ("block" in object2 && Object.hasOwn(board.blocks, object2.block)) actedBlocks.add(object2.block);
    if ("stack" in object2 && Object.hasOwn(board.stacks, object2.stack)) actedStacks.add(object2.stack);
  }
  for (const stack2 of actedStacks) {
    for (const block of board.stacks[stack2]?.blocks ?? []) {
      if (Object.hasOwn(board.blocks, block)) actedBlocks.add(block);
    }
  }
  const stacks = Object.entries(board.stacks).flatMap(
    ([id, stack2]) => actedStacks.has(id) || stack2.blocks.length > 0 && stack2.blocks.every((block) => actedBlocks.has(block)) ? [id] : []
  );
  return { blocks: Object.keys(board.blocks).filter((block) => actedBlocks.has(block)), stacks };
}
function copies(board, target) {
  const { blocks, stacks } = copiedOf(board, target);
  return blocks.length + stacks.length > 0;
}
function copiedBoard(json, copied) {
  const blocks = new Set(copied.blocks);
  const stacks = new Set(copied.stacks);
  const { board } = json;
  const graph = board.plugins[GRAPH];
  const state = graph === void 0 || !isGraphState(graph.state) ? void 0 : graph.state;
  return {
    ...json,
    board: {
      ...board,
      blocks: kept(board.blocks, (id) => blocks.has(id)),
      links: kept(board.links, (_id, link) => blocks.has(link.from) && blocks.has(link.to)),
      stacks: kept(board.stacks, (id) => stacks.has(id)),
      options: {},
      plugins: graph === void 0 || state === void 0 ? {} : { [GRAPH]: { ...graph, state: copiedState(state, blocks, stacks) } }
    }
  };
}
function copiedState(state, blocks, stacks) {
  return {
    ...state,
    positions: kept(state.positions, (id) => blocks.has(id)),
    stacks: kept(state.stacks, (id, entry) => stacks.has(id) && isPoint(entry))
  };
}
function kept(record, keep) {
  return Object.fromEntries(Object.entries(record).filter(([id, value]) => keep(id, value)));
}

// srcts/actions/icons.ts
var svg = (paths) => `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
var COPY_ICON = svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>');
var CUT_ICON = svg('<circle cx="4.5" cy="11.5" r="2"/><circle cx="11.5" cy="11.5" r="2"/><path d="M6 10 12.5 2.5M10 10 3.5 2.5"/>');
var PASTE_ICON = svg(
  '<path d="M10.5 2.5h1a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1"/><rect x="5.5" y="1.5" width="5" height="2.5" rx=".75"/>'
);
var LAYOUT_ICON = svg(
  '<rect x="6" y="1.5" width="4" height="3.5" rx="1"/><rect x="1.5" y="11" width="4" height="3.5" rx="1"/><rect x="10.5" y="11" width="4" height="3.5" rx="1"/><path d="M8 5v3M3.5 11V8h9v3"/>'
);

// srcts/actions/noted.ts
var noted;
var fits = /* @__PURE__ */ new Set();
function notePoint(point) {
  noted = point;
}
function notedPoint() {
  return noted;
}
function onFit(fit) {
  fits.add(fit);
  return () => {
    fits.delete(fit);
  };
}
function fitViews() {
  for (const fit of fits) fit();
}

// srcts/actions/layout.ts
var DIRECTIONS = [
  ["TB", "Top to bottom"],
  ["LR", "Left to right"]
];
var SPACINGS = [
  ["compact", "Compact"],
  ["normal", "Normal"],
  ["loose", "Loose"]
];
var PLACEMENTS = [
  ["repulsion", "Repulsion"],
  ["beside", "Beside"]
];
function layoutLevel(layout, core) {
  const relayout = (args) => async () => {
    await core.commands.run("blockr.graph-relayout", args, "user", { notifier: () => void 0 });
    fitViews();
    return [];
  };
  const rows = [
    { kind: "item", label: "Lay out again", pick: relayout({}) },
    ...DIRECTIONS.map(
      ([direction, label]) => ({
        kind: "item",
        heading: "Direction",
        label,
        checked: layout.direction === direction,
        pick: relayout({ direction })
      })
    ),
    ...SPACINGS.map(
      ([spacing, label]) => ({
        kind: "item",
        heading: "Spacing",
        label,
        checked: layout.spacing === spacing,
        pick: relayout({ spacing })
      })
    ),
    ...PLACEMENTS.map(
      ([placement, label]) => ({
        kind: "item",
        heading: "New blocks",
        label,
        checked: layout.placement === placement,
        pick: () => [{ id: "blockr.graph-set_placement", args: { placement } }]
      })
    ),
    {
      kind: "item",
      heading: "Snapping",
      label: "Snap to grid",
      checked: layout.snap,
      pick: () => [{ id: "blockr.graph-set_snap", args: { snap: !layout.snap } }]
    },
    {
      kind: "item",
      heading: "Snapping",
      label: "Snap size\u2026",
      detail: `${String(layout.snap_size)} px`,
      pick: () => snapSizeLevel(layout.snap_size)
    }
  ];
  return { title: "Layout", rows };
}
function snapSizeLevel(size) {
  return {
    title: "Snap size",
    rows: [
      {
        kind: "text",
        label: "Snap size in pixels",
        value: String(size),
        check: (value) => sizeOf(value) === void 0 ? "The snap size is a number of pixels above 0." : void 0,
        submit(value) {
          const next = sizeOf(value);
          return next === void 0 || next === size ? [] : [{ id: "blockr.graph-set_snap", args: { snap_size: next } }];
        }
      }
    ]
  };
}
function sizeOf(value) {
  const size = Number(value);
  return value.trim() !== "" && Number.isFinite(size) && size > 0 ? size : void 0;
}

// srcts/geometry/box.ts
function bounds(boxes) {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    left = Math.min(left, box.x - box.w / 2);
    right = Math.max(right, box.x + box.w / 2);
    top = Math.min(top, box.y - box.h / 2);
    bottom = Math.max(bottom, box.y + box.h / 2);
  }
  if (left === Infinity) return void 0;
  return { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top };
}
function padded(box, by) {
  return { ...box, w: box.w + 2 * by, h: box.h + 2 * by };
}
function shifted(box, dx, dy) {
  return { ...box, x: box.x + dx, y: box.y + dy };
}
function apart(a, b) {
  return { x: Math.abs(a.x - b.x) - (a.w + b.w) / 2, y: Math.abs(a.y - b.y) - (a.h + b.h) / 2 };
}
function distance(a, b) {
  const { x, y } = apart(a, b);
  return Math.hypot(Math.max(0, x), Math.max(0, y));
}
function overlaps(a, b, gap = 0) {
  const { x, y } = apart(a, b);
  return x < gap - EPSILON && y < gap - EPSILON;
}
var EPSILON = 1e-6;

// srcts/geometry/sizes.ts
var MARK = 32;
var NAME_OFFSET = 4;
var NAME_HEIGHT = 16;
var CHARACTER = 6.2;
var NAME_PADDING = 5;
var NAME_MAX = 160;
var BLOCK_HEIGHT = MARK + NAME_OFFSET + NAME_HEIGHT;
var STACK_PADDING = 20;
var STACK_WIDTH = 170;
var STACK_HEIGHT = 44;
var GAPS = { compact: 50, normal: 70, loose: 100 };
function gapOf(spacing) {
  return GAPS[spacing];
}
function blockWidth(name) {
  const text = name.length * CHARACTER + 2 * NAME_PADDING;
  return Math.min(NAME_MAX, Math.max(MARK, Math.round(text)));
}

// srcts/geometry/canvas.ts
function canvasOf(board, state) {
  const points2 = {};
  const collapsed = /* @__PURE__ */ new Set();
  for (const [id, entry] of Object.entries(state.stacks)) {
    const stack2 = board.stacks[id];
    if (stack2 === void 0) continue;
    if (isCollapse(entry)) {
      if (stack2.blocks.length > 0) collapsed.add(id);
    } else if (stack2.blocks.length === 0) {
      points2[id] = entry;
    }
  }
  return { board, positions: state.positions, points: points2, collapsed };
}
function stackOf(board) {
  const held = /* @__PURE__ */ new Map();
  for (const [id, stack2] of Object.entries(board.stacks)) {
    for (const block of stack2.blocks) if (!held.has(block)) held.set(block, id);
  }
  return held;
}
function blockBox(point, name) {
  return { x: point.x, y: point.y, w: blockWidth(name), h: BLOCK_HEIGHT };
}
function stackBoxAt(point) {
  return { x: point.x, y: point.y, w: STACK_WIDTH, h: STACK_HEIGHT };
}
function boxOfBlock(canvas, block) {
  const point = canvas.positions[block];
  const name = canvas.board.blocks[block]?.name;
  return point === void 0 || name === void 0 ? void 0 : blockBox(point, name);
}
function expandedBox(canvas, stack2) {
  const blocks = canvas.board.stacks[stack2]?.blocks ?? [];
  const box = bounds(blocks.flatMap((block) => boxOfBlock(canvas, block) ?? []));
  return box === void 0 ? void 0 : padded(box, STACK_PADDING);
}
function shownBox(canvas, stack2) {
  const point = canvas.points[stack2];
  if (point !== void 0) return stackBoxAt(point);
  const box = expandedBox(canvas, stack2);
  return box === void 0 || !canvas.collapsed.has(stack2) ? box : stackBoxAt(box);
}
function canvasNodes(canvas) {
  const held = stackOf(canvas.board);
  const nodes = [];
  for (const block of Object.keys(canvas.board.blocks)) {
    const stack2 = held.get(block) ?? null;
    const box = boxOfBlock(canvas, block);
    if (box === void 0 || stack2 !== null && canvas.collapsed.has(stack2)) continue;
    nodes.push({ kind: "block", id: block, box, stack: stack2 });
  }
  for (const stack2 of Object.keys(canvas.board.stacks)) {
    if (!canvas.collapsed.has(stack2) && canvas.points[stack2] === void 0) continue;
    const box = shownBox(canvas, stack2);
    if (box !== void 0) nodes.push({ kind: "stack", id: stack2, box, stack: stack2 });
  }
  return nodes;
}
function nodeChanges(canvas, node, box) {
  const point = { x: box.x, y: box.y };
  if (node.kind === "block") return { positions: { [node.id]: point }, points: {} };
  if (canvas.points[node.id] !== void 0) return { positions: {}, points: { [node.id]: point } };
  const [dx, dy] = [box.x - node.box.x, box.y - node.box.y];
  const positions = {};
  for (const block of canvas.board.stacks[node.id]?.blocks ?? []) {
    const point2 = canvas.positions[block];
    if (point2 !== void 0) positions[block] = { x: point2.x + dx, y: point2.y + dy };
  }
  return { positions, points: {} };
}
function changed(canvas, changes) {
  return {
    ...canvas,
    positions: { ...canvas.positions, ...changes.positions },
    points: { ...canvas.points, ...changes.points }
  };
}
function merged(first, later) {
  return { positions: { ...first.positions, ...later.positions }, points: { ...first.points, ...later.points } };
}

// srcts/geometry/snap.ts
function snapPoint(point, size) {
  return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size };
}
var REACH = 4;
function snapChanges(canvas, changes, layout) {
  if (!layout.snap) return changes;
  const size = layout.snap_size;
  const gap = gapOf(layout.spacing);
  const positions = {};
  const points2 = {};
  for (const [id, point] of Object.entries(changes.positions)) positions[id] = snapPoint(point, size);
  for (const [id, point] of Object.entries(changes.points)) points2[id] = snapPoint(point, size);
  const nodes = canvasNodes(changed(canvas, { positions, points: points2 }));
  const boxes = nodes.map((node) => node.box);
  for (const [i, node] of nodes.entries()) {
    const raw = node.kind === "block" ? changes.positions[node.id] : changes.points[node.id];
    if (raw === void 0) continue;
    const name = canvas.board.blocks[node.id]?.name ?? "";
    const boxAt = (point) => node.kind === "block" ? blockBox(point, name) : stackBoxAt(point);
    const unsnapped = boxAt(raw);
    const tooClose = (box) => boxes.some((other, j) => j !== i && overlaps(box, other, gap) && !overlaps(unsnapped, other, gap));
    if (!tooClose(boxes[i] ?? unsnapped)) continue;
    const spot = multiplesNear(raw, size).find((point) => !tooClose(boxAt(point)));
    if (spot === void 0) continue;
    boxes[i] = boxAt(spot);
    if (node.kind === "block") positions[node.id] = spot;
    else points2[node.id] = spot;
  }
  return { positions, points: points2 };
}
function multiplesNear(point, size) {
  const [x0, y0] = [Math.floor(point.x / size), Math.floor(point.y / size)];
  const spots = [];
  for (let i = -REACH; i <= REACH + 1; i++) {
    for (let j = -REACH; j <= REACH + 1; j++) spots.push({ x: (x0 + i) * size, y: (y0 + j) * size });
  }
  const far = (spot) => (spot.x - point.x) ** 2 + (spot.y - point.y) ** 2;
  return spots.sort((a, b) => far(a) - far(b) || a.y - b.y || a.x - b.x);
}

// srcts/placement/beside.ts
var RINGS = 40;
function beside(canvas, added, gap) {
  const nodes = canvasNodes(canvas);
  const isAdded = (node) => (node.kind === "block" ? added.blocks : added.stacks).has(node.id);
  const group = nodes.filter(isAdded);
  const others = nodes.filter((node) => !isAdded(node)).map((node) => node.box);
  const stacks = stackBoxes(canvas, nodes, isAdded);
  const fits2 = (dx, dy) => group.every((node) => {
    const box = shifted(node.box, dx, dy);
    return others.every((other) => !overlaps(box, other, gap)) && stacks.every(([stack2, other]) => stack2 === node.stack || !overlaps(box, other, gap));
  });
  for (const [dx, dy] of rings(gap)) {
    if (!fits2(dx, dy)) continue;
    const positions = {};
    const points2 = {};
    if (dx === 0 && dy === 0) return { positions, points: points2 };
    for (const node of group) {
      const changes = nodeChanges(canvas, node, shifted(node.box, dx, dy));
      Object.assign(positions, changes.positions);
      Object.assign(points2, changes.points);
    }
    return { positions, points: points2 };
  }
  return { positions: {}, points: {} };
}
function stackBoxes(canvas, nodes, isAdded) {
  const held = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    if (node.kind !== "block" || node.stack === null || isAdded(node)) continue;
    held.set(node.stack, [...held.get(node.stack) ?? [], node.box]);
  }
  return [...held].flatMap(([stack2, boxes]) => {
    const box = bounds(boxes);
    return box === void 0 || canvas.collapsed.has(stack2) ? [] : [[stack2, padded(box, STACK_PADDING)]];
  });
}
function* rings(step) {
  yield [0, 0];
  for (let ring = 1; ring <= RINGS; ring++) {
    const spots = [];
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) if (Math.max(Math.abs(i), Math.abs(j)) === ring) spots.push([i, j]);
    }
    spots.sort(([i1, j1], [i2, j2]) => i1 ** 2 + j1 ** 2 - (i2 ** 2 + j2 ** 2) || j1 - j2 || i1 - i2);
    for (const [i, j] of spots) yield [i * step, j * step];
  }
}

// srcts/placement/free.ts
var STEP = 10;
var REACH2 = 1e3;
function shownBoxes(canvas) {
  const boxes = canvasNodes(canvas).map((node) => node.box);
  for (const stack2 of Object.keys(canvas.board.stacks)) {
    if (canvas.collapsed.has(stack2) || canvas.points[stack2] !== void 0) continue;
    const box = expandedBox(canvas, stack2);
    if (box !== void 0) boxes.push(box);
  }
  return boxes;
}
function freeOffset(canvas, boxes, layout) {
  const taken = shownBoxes(canvas);
  const gap = gapOf(layout.spacing);
  const free = ({ x, y }) => boxes.every((box) => {
    const moved = shifted(box, x, y);
    return taken.every((other) => !overlaps(moved, other, gap));
  });
  const none = { x: 0, y: 0 };
  if (boxes.length === 0 || free(none)) return none;
  return offsets(layout.snap ? layout.snap_size : STEP).find(free) ?? none;
}
function offsets(step) {
  const rings2 = Math.ceil(REACH2 / step);
  const grid = [];
  for (let j = -rings2; j <= rings2; j++) {
    for (let i = -rings2; i <= rings2; i++) grid.push({ x: i * step, y: j * step });
  }
  return grid.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
}

// srcts/room/pairs.ts
function closePairs(boxes, reach) {
  const left = boxes.map((box) => box.x - box.w / 2);
  const order = boxes.map((_, i) => i).sort((i, j) => (left[i] ?? 0) - (left[j] ?? 0) || i - j);
  const pairs = [];
  for (const [k, i] of order.entries()) {
    const a = boxes[i];
    if (a === void 0) continue;
    const end = a.x + a.w / 2 + reach;
    for (let m = k + 1; m < order.length; m++) {
      const j = order[m] ?? i;
      const b = boxes[j];
      if (b === void 0 || (left[j] ?? 0) >= end) break;
      if (Math.abs(a.y - b.y) - (a.h + b.h) / 2 < reach) pairs.push(i < j ? [i, j] : [j, i]);
    }
  }
  return pairs.sort(([i1, j1], [i2, j2]) => i1 - i2 || j1 - j2);
}

// srcts/room/project.ts
import { Constraint, Solver, Variable } from "./vpsc-35683e50.js";
var ROUNDS = 8;
var FIXED_WEIGHT = 1e6;
var SLACK = 0.5;
function project(bodies, targets, gap, smoothing = 1) {
  const n = bodies.length;
  const sat = bodies.map((body2) => ({ x: body2.x, y: body2.y, w: body2.w, h: body2.h }));
  const body = (i) => bodies[i] ?? { x: 0, y: 0, w: 0, h: 0, holder: null };
  const isFixed = (i) => body(i).fixed !== void 0;
  const pad = (i) => body(i).holder === null ? 0 : STACK_PADDING;
  const at2 = (axis, i) => body(i)[axis];
  const goal = { x: targets.map((t, i) => isFixed(i) ? body(i).x : t.x), y: targets.map((t, i) => isFixed(i) ? body(i).y : t.y) };
  const now = { x: bodies.map((b) => b.x), y: bodies.map((b) => b.y) };
  const need = (i, j, axis) => {
    const [a, b] = [body(i), body(j)];
    const size = axis === "x" ? a.w + b.w : a.h + b.h;
    const padding = a.holder !== null && a.holder === b.holder ? 0 : pad(i) + pad(j);
    return size / 2 + gap + padding;
  };
  const rank = { x: ranks(bodies.map((b) => b.x)), y: ranks(bodies.map((b) => b.y)) };
  const constraints = { x: /* @__PURE__ */ new Map(), y: /* @__PURE__ */ new Map() };
  const key = (axis, i, j) => (rank[axis][i] ?? 0) < (rank[axis][j] ?? 0) ? i * n + j : j * n + i;
  const kept2 = (axis, i, j) => constraints[axis].get(key(axis, i, j)) ?? -Infinity;
  const keep = (axis, i, j, sep) => {
    constraints[axis].set(key(axis, i, j), Math.max(kept2(axis, i, j), sep));
  };
  const separation = (i, j) => {
    const off = apart(sat[i] ?? NONE, sat[j] ?? NONE);
    const axis = off.x >= off.y ? "x" : "y";
    const had = Math.abs(at2(axis, i) - at2(axis, j));
    const push = body(i).fixed ?? body(j).fixed;
    const full = push === "all" || push === "inside" && off.x < 0 && off.y < 0;
    const want = need(i, j, axis);
    return { axis, sep: full ? want : Math.min(want, had) };
  };
  const near = bodies.map(() => []);
  for (const [i, j] of closePairs(sat, 2 * gap)) {
    if (isFixed(i) && isFixed(j)) continue;
    if (distance(sat[i] ?? NONE, sat[j] ?? NONE) >= 2 * gap) continue;
    near[i]?.push(j);
    near[j]?.push(i);
    const { axis, sep } = separation(i, j);
    keep(axis, i, j, sep);
    if (isFixed(i) || isFixed(j)) continue;
    for (const ordered of AXES) {
      if (Math.abs(at2(ordered, i) - at2(ordered, j)) >= gap / 2) keep(ordered, i, j, gap / 2);
    }
  }
  const members = /* @__PURE__ */ new Map();
  for (const [i, b] of bodies.entries()) {
    if (b.holder !== null && b.fixed === void 0) members.set(b.holder, [...members.get(b.holder) ?? [], i]);
  }
  const boxOf = (of, where) => padded(bounds(of.map(where)) ?? NONE, STACK_PADDING);
  const satBoxes = new Map([...members].map(([stack2, of]) => [stack2, boxOf(of, (i) => sat[i] ?? NONE)]));
  const guard = (stack2, i) => {
    const off = apart(sat[i] ?? NONE, satBoxes.get(stack2) ?? NONE);
    const axis = off.x >= off.y ? "x" : "y";
    let added = 0;
    for (const j of members.get(stack2) ?? []) {
      const sep = Math.min(need(i, j, axis), Math.abs(at2(axis, i) - at2(axis, j)));
      if (kept2(axis, i, j) >= sep - SLACK) continue;
      keep(axis, i, j, sep);
      added++;
    }
    return added;
  };
  for (const [stack2, box] of satBoxes) {
    for (let i = 0; i < n; i++) {
      if (body(i).holder !== stack2 && distance(sat[i] ?? NONE, box) < 2 * gap) guard(stack2, i);
    }
  }
  const solve = (axis) => {
    const vars = bodies.map((_, i) => new Variable(goal[axis][i] ?? 0, isFixed(i) ? FIXED_WEIGHT : 1));
    const held = [...constraints[axis]].flatMap(([k, sep]) => {
      const [left, right] = [vars[Math.floor(k / n)], vars[k % n]];
      return left === void 0 || right === void 0 ? [] : [new Constraint(left, right, sep)];
    });
    new Solver(vars, held).solve();
    for (const [i, v] of vars.entries()) now[axis][i] = v.position();
  };
  const settle = () => {
    for (let round = 0; round < ROUNDS; round++) {
      solve("x");
      solve("y");
      const boxes = bodies.map((b, i) => ({ x: now.x[i] ?? b.x, y: now.y[i] ?? b.y, w: b.w, h: b.h }));
      let added = 0;
      for (const [i, j] of closePairs(boxes, gap + 2 * STACK_PADDING)) {
        if (isFixed(i) && isFixed(j)) continue;
        const close = AXES.every((axis2) => Math.abs((now[axis2][i] ?? 0) - (now[axis2][j] ?? 0)) < need(i, j, axis2) - SLACK);
        if (!close) continue;
        const { axis, sep } = separation(i, j);
        if (kept2(axis, i, j) >= sep - SLACK) continue;
        keep(axis, i, j, sep);
        added++;
      }
      for (const [stack2, of] of members) {
        const box = boxOf(of, (i) => boxes[i] ?? NONE);
        for (const [i, b] of boxes.entries()) {
          if (body(i).holder !== stack2 && overlaps(b, box)) added += guard(stack2, i);
        }
      }
      if (added === 0) break;
    }
  };
  for (let pass = 0; pass <= smoothing; pass++) {
    if (pass > 0) {
      const moves2 = { x: now.x.map((x, i) => x - body(i).x), y: now.y.map((y, i) => y - body(i).y) };
      for (const [i, around] of near.entries()) {
        if (isFixed(i) || around.length === 0) continue;
        for (const axis of AXES) {
          const mean = around.reduce((sum, j) => sum + (moves2[axis][j] ?? 0), 0) / around.length;
          goal[axis][i] = at2(axis, i) + ((moves2[axis][i] ?? 0) + mean) / 2;
        }
      }
    }
    settle();
  }
  return bodies.map((b, i) => ({ x: now.x[i] ?? b.x, y: now.y[i] ?? b.y }));
}
var AXES = ["x", "y"];
var NONE = { x: 0, y: 0, w: 0, h: 0 };
function ranks(values) {
  const order = values.map((_, i) => i).sort((i, j) => (values[i] ?? 0) - (values[j] ?? 0) || i - j);
  const rank = new Array(values.length).fill(0);
  for (const [r, i] of order.entries()) rank[i] = r;
  return rank;
}

// srcts/room/room.ts
var SIGMA = 3;
var LEAST = 0.5;
function closeUp(canvas, stack2, gap) {
  const full = expandedBox(canvas, stack2);
  if (full === void 0) return { positions: {}, points: {} };
  const small = stackBoxAt(full);
  const nodes = canvasNodes(canvas).filter((node) => node.stack !== stack2);
  const spread = Math.max(gap, SIGMA * Math.max(full.w - small.w, full.h - small.h) / 2);
  const targets = nodes.map(({ box }) => {
    const [vx, vy] = [box.x - full.x, box.y - full.y];
    const length = Math.hypot(vx, vy);
    if (length === 0) return box;
    const [ux, uy] = [vx / length, vy / length];
    const edge = edgeAlong(full, ux, uy);
    const share = Math.exp(-(Math.max(0, length - edge) ** 2) / (2 * spread ** 2));
    const by = (edge - edgeAlong(small, ux, uy)) * share;
    return { x: box.x - ux * by, y: box.y - uy * by };
  });
  const bodies = [...nodes.map((node) => bodyOf(node)), fixedBox(small, "none")];
  return changesOf(canvas, nodes, project(bodies, [...targets, small], gap));
}
function clearBox(canvas, stack2, gap) {
  const full = expandedBox(canvas, stack2);
  if (full === void 0) return { positions: {}, points: {} };
  const nodes = canvasNodes(canvas).filter((node) => node.stack !== stack2);
  const bodies = [...nodes.map((node) => bodyOf(node)), fixedBox(full, "inside")];
  return changesOf(canvas, nodes, project(bodies, bodies, gap));
}
function makeRoom(canvas, added, moved, gap) {
  const nodes = canvasNodes(canvas);
  const push = (node) => {
    if (node.kind === "stack") return added.stacks.has(node.id) ? "all" : void 0;
    if (added.blocks.has(node.id)) return "all";
    return moved.has(node.id) ? "none" : void 0;
  };
  const bodies = nodes.map((node) => bodyOf(node, push(node)));
  return changesOf(canvas, nodes, project(bodies, bodies, gap), (i) => bodies[i]?.fixed !== void 0);
}
function bodyOf(node, fixed) {
  const holder = node.kind === "block" ? node.stack : null;
  return { ...node.box, holder, ...fixed === void 0 ? {} : { fixed } };
}
function fixedBox(box, push) {
  return { ...box, holder: null, fixed: push };
}
function changesOf(canvas, nodes, places, skip) {
  const positions = {};
  const points2 = {};
  for (const [i, node] of nodes.entries()) {
    const place = places[i];
    if (place === void 0 || skip?.(i) === true) continue;
    const [dx, dy] = [place.x - node.box.x, place.y - node.box.y];
    if (Math.hypot(dx, dy) < LEAST) continue;
    const changes = nodeChanges(canvas, node, shifted(node.box, dx, dy));
    Object.assign(positions, changes.positions);
    Object.assign(points2, changes.points);
  }
  return { positions, points: points2 };
}
function edgeAlong(box, ux, uy) {
  const across = Math.abs(ux) > 1e-9 ? box.w / 2 / Math.abs(ux) : Infinity;
  const down = Math.abs(uy) > 1e-9 ? box.h / 2 / Math.abs(uy) : Infinity;
  return Math.min(across, down);
}

// srcts/placement/ways.ts
function axisOf(direction) {
  return direction === "TB" ? "y" : "x";
}
function wayOf(canvas, links, direction, gap) {
  const main = axisOf(direction);
  const offsets2 = links.flatMap((link) => {
    const [from, to] = [canvas.positions[link.from], canvas.positions[link.to]];
    const [a, b] = [boxOfBlock(canvas, link.from), boxOfBlock(canvas, link.to)];
    if (from === void 0 || to === void 0 || a === void 0 || b === void 0) return [];
    const rank = (main === "y" ? a.h + b.h : a.w + b.w) / 2 + gap;
    return [{ x: to.x - from.x, y: to.y - from.y, rank }];
  });
  if (offsets2.length === 0) return { axis: main, sign: 1 };
  const mean = (of) => offsets2.reduce((sum, offset) => sum + of(offset), 0) / offsets2.length;
  const along = { x: mean((offset) => offset.x), y: mean((offset) => offset.y) };
  const axis = Math.abs(along[main]) < mean((offset) => offset.rank) / 2 ? main === "y" ? "x" : "y" : main;
  return { axis, sign: along[axis] < 0 ? -1 : 1 };
}

// srcts/placement/start.ts
function blockShape(name) {
  return { w: blockWidth(name), h: BLOCK_HEIGHT };
}
var STACK_SHAPE = { w: STACK_WIDTH, h: STACK_HEIGHT };
function startPoints(canvas, added, layout) {
  const gap = gapOf(layout.spacing);
  const positions = {};
  const points2 = {};
  let current = canvas;
  const placed2 = [];
  for (const block of added.blocks) {
    const box = boxOfBlock(canvas, block);
    if (box !== void 0) placed2.push(box);
  }
  for (const stack2 of added.stacks) {
    const point = canvas.points[stack2];
    if (point !== void 0) placed2.push(stackBoxAt(point));
  }
  const start2 = (box) => {
    const free = offPlaced(box, placed2, layout.direction, gap);
    placed2.push(free);
    return { x: free.x, y: free.y };
  };
  for (const block of linkOrder(canvas.board, added.blocks)) {
    if (canvas.positions[block] !== void 0) continue;
    const shape = blockShape(canvas.board.blocks[block]?.name ?? "");
    const point = start2(startBox(current, block, shape, layout, gap));
    positions[block] = point;
    current = changed(current, { positions: { [block]: point }, points: {} });
  }
  for (const stack2 of Object.keys(canvas.board.stacks)) {
    if (!added.stacks.has(stack2) || canvas.points[stack2] !== void 0) continue;
    const point = start2(firstRank(current, STACK_SHAPE, layout, gap));
    points2[stack2] = point;
    current = changed(current, { positions: {}, points: { [stack2]: point } });
  }
  return { positions, points: points2 };
}
function startBox(canvas, block, shape, layout, gap) {
  const links = Object.values(canvas.board.links);
  const has = (id) => canvas.positions[id] !== void 0 && id !== block;
  const sources = unique(links.flatMap((link) => link.to === block && has(link.from) ? [link.from] : []));
  const targets = unique(links.flatMap((link) => link.from === block && has(link.to) ? [link.to] : []));
  const way = (of) => wayOf(canvas, of, layout.direction, gap);
  const [source] = sources;
  const [target] = targets;
  if (sources.length === 1 && targets.length === 1 && source !== void 0 && target !== void 0) {
    return between(canvas, source, target, shape);
  }
  if (sources.length > 0) {
    const fed = links.filter((link) => sources.includes(link.from) && has(link.to));
    if (fed.length > 0) return pastLast(canvas, fed.map((link) => link.to), way(fed), shape, gap);
    const into = links.filter((link) => sources.includes(link.to) && has(link.from));
    return rankPast(canvas, sources, way(into), 1, shape, gap);
  }
  if (targets.length > 0) {
    const feeding = links.filter((link) => targets.includes(link.to) && has(link.from));
    if (feeding.length > 0) return pastLast(canvas, feeding.map((link) => link.from), way(feeding), shape, gap);
    const out = links.filter((link) => targets.includes(link.from) && has(link.to));
    return rankPast(canvas, targets, way(out), -1, shape, gap);
  }
  return firstRank(canvas, shape, layout, gap);
}
function between(canvas, from, to, shape) {
  const [a, b] = [boxOfBlock(canvas, from), boxOfBlock(canvas, to)];
  if (a === void 0 || b === void 0) return { x: 0, y: 0, w: shape.w, h: shape.h };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: shape.w, h: shape.h };
}
function pastLast(canvas, blocks, way, shape, gap) {
  const boxes = unique(blocks).flatMap((block) => boxOfBlock(canvas, block) ?? []);
  if (way.axis === "y") {
    const last3 = lastBy(boxes, (box) => box.x + box.w / 2);
    return { x: last3.x + last3.w / 2 + gap + shape.w / 2, y: last3.y, w: shape.w, h: shape.h };
  }
  const last2 = lastBy(boxes, (box) => box.y + box.h / 2);
  return { x: last2.x, y: last2.y + last2.h / 2 + gap + shape.h / 2, w: shape.w, h: shape.h };
}
function rankPast(canvas, blocks, way, against, shape, gap) {
  const span = bounds(blocks.flatMap((block) => boxOfBlock(canvas, block) ?? [])) ?? { x: 0, y: 0, w: shape.w, h: shape.h };
  const ahead = way.sign * against > 0;
  if (way.axis === "y") {
    const y = ahead ? span.y + span.h / 2 + gap + shape.h / 2 : span.y - span.h / 2 - gap - shape.h / 2;
    return { x: span.x, y, w: shape.w, h: shape.h };
  }
  const x = ahead ? span.x + span.w / 2 + gap + shape.w / 2 : span.x - span.w / 2 - gap - shape.w / 2;
  return { x, y: span.y, w: shape.w, h: shape.h };
}
function firstRank(canvas, shape, layout, gap) {
  const boxes = canvasNodes(canvas).map((node) => node.box);
  const [first] = boxes;
  if (first === void 0) return { x: 0, y: 0, w: shape.w, h: shape.h };
  if (layout.direction === "TB") {
    const top = Math.min(...boxes.map((box) => box.y));
    const last3 = lastBy(boxes.filter((box) => box.y - top < gap / 2), (box) => box.x + box.w / 2);
    return { x: last3.x + last3.w / 2 + gap + shape.w / 2, y: top, w: shape.w, h: shape.h };
  }
  const left = Math.min(...boxes.map((box) => box.x));
  const last2 = lastBy(boxes.filter((box) => box.x - left < gap / 2), (box) => box.y + box.h / 2);
  return { x: left, y: last2.y + last2.h / 2 + gap + shape.h / 2, w: shape.w, h: shape.h };
}
function offPlaced(box, placed2, direction, gap) {
  let moved = box;
  for (let tries = 0; tries <= placed2.length; tries++) {
    const hit = placed2.find((other) => overlaps(moved, other, gap));
    if (hit === void 0) return moved;
    moved = direction === "TB" ? { ...moved, x: hit.x + hit.w / 2 + gap + moved.w / 2 } : { ...moved, y: hit.y + hit.h / 2 + gap + moved.h / 2 };
  }
  return moved;
}
function linkOrder(board, blocks) {
  const order = Object.keys(board.blocks).filter((block) => blocks.has(block));
  const reads = /* @__PURE__ */ new Map();
  for (const link of Object.values(board.links)) {
    if (link.from === link.to || !blocks.has(link.from) || !blocks.has(link.to)) continue;
    reads.set(link.to, [...reads.get(link.to) ?? [], link.from]);
  }
  const done = /* @__PURE__ */ new Set();
  const ordered = [];
  while (ordered.length < order.length) {
    const left = order.filter((block) => !done.has(block));
    const next = left.find((block) => (reads.get(block) ?? []).every((from) => done.has(from))) ?? left[0];
    if (next === void 0) break;
    done.add(next);
    ordered.push(next);
  }
  return ordered;
}
function lastBy(boxes, measure) {
  let last2;
  for (const box of boxes) if (last2 === void 0 || measure(box) > measure(last2)) last2 = box;
  return last2 ?? { x: 0, y: 0, w: 0, h: 0 };
}
function unique(items) {
  return [...new Set(items)];
}

// srcts/placement/place.ts
function placeAdded(canvas, added, moved, layout, placement = layout.placement) {
  const gap = gapOf(layout.spacing);
  const starts = startPoints(canvas, added, layout);
  const started = changed(canvas, starts);
  const fit = placement === "beside" ? beside(started, added, gap) : makeRoom(started, added, moved, gap);
  return snapChanges(canvas, merged(starts, fit), layout);
}

// srcts/actions/paste.ts
var COPY = " (copy)";
function pasteBatch(board, read, point, mint) {
  const blocks = renamed(Object.keys(read.blocks), board.blocks, mint);
  const stacks = renamed(Object.keys(read.stacks), board.stacks, mint);
  const pastedLinks = Object.entries(read.links).filter(([, link]) => blocks.has(link.from) && blocks.has(link.to));
  const links = renamed(
    pastedLinks.map(([id]) => id),
    board.links,
    mint
  );
  const batch = [];
  for (const [id, block] of Object.entries(read.blocks)) {
    batch.push({
      id: "blockr.core-add_block",
      args: { registry_id: block.registry_id, id: newId(blocks, id), name: block.name, state: block.state }
    });
  }
  for (const [id, stack2] of Object.entries(read.stacks)) {
    batch.push({
      id: "blockr.core-add_stack",
      args: {
        id: newId(stacks, id),
        name: `${stack2.name}${COPY}`,
        blocks: stack2.blocks.flatMap((block) => blocks.get(block) ?? []),
        color: stack2.color
      }
    });
  }
  for (const [id, link] of pastedLinks) {
    batch.push({
      id: "blockr.core-add_link",
      args: {
        id: newId(links, id),
        from: newId(blocks, link.from),
        to: newId(blocks, link.to),
        ...link.input === "" ? {} : { input: link.input }
      }
    });
  }
  const moved = positionsOf(board, read, blocks, stacks, point);
  if (moved !== void 0) batch.push({ id: "blockr.graph-change_position", args: moved });
  return batch;
}
function renamed(ids, collection, mint) {
  const minted = /* @__PURE__ */ new Map();
  const taken = /* @__PURE__ */ new Set();
  for (const id of ids) {
    const next = mint((candidate) => Object.hasOwn(collection, candidate) || taken.has(candidate));
    taken.add(next);
    minted.set(id, next);
  }
  return minted;
}
function newId(ids, id) {
  const minted = ids.get(id);
  if (minted === void 0) throw new Error(`The paste minted no id for "${id}".`);
  return minted;
}
function positionsOf(board, read, blocks, stacks, point) {
  const state = graphState(read);
  if (state === void 0) return void 0;
  const positions = Object.entries(state.positions).flatMap(([id, at2]) => {
    const pasted = blocks.get(id);
    return pasted === void 0 ? [] : [[pasted, at2]];
  });
  const points2 = Object.entries(state.stacks).flatMap(([id, entry]) => {
    const pasted = stacks.get(id);
    return pasted === void 0 || !isPoint(entry) || (read.stacks[id]?.blocks.length ?? 0) > 0 ? [] : [[pasted, entry]];
  });
  const box = bounds([...positions, ...points2].map(([, at2]) => ({ x: at2.x, y: at2.y, w: 0, h: 0 })));
  if (box === void 0) return void 0;
  let dx = point === void 0 ? 0 : point.x - box.x;
  let dy = point === void 0 ? 0 : point.y - box.y;
  const onto = graphState(board);
  if (onto !== void 0) {
    const free = freeOffset(canvasOf(board, onto), shownBoxes(shiftedCanvas(canvasOf(read, state), dx, dy)), onto.layout);
    dx += free.x;
    dy += free.y;
  }
  const moved = (entries) => Object.fromEntries(entries.map(([id, at2]) => [id, { x: at2.x + dx, y: at2.y + dy }]));
  return { positions: moved(positions), stacks: moved(points2) };
}
function shiftedCanvas(canvas, dx, dy) {
  const by = (points2) => Object.fromEntries(Object.entries(points2).map(([id, at2]) => [id, { x: at2.x + dx, y: at2.y + dy }]));
  return { ...canvas, positions: by(canvas.positions), points: by(canvas.points) };
}

// srcts/actions/actions.ts
var COPY2 = "blockr.graph-copy_action";
var CUT = "blockr.graph-cut_action";
var PASTE = "blockr.graph-paste_action";
var LAYOUT = "blockr.graph-layout_action";
var graphBoardActions = [
  {
    id: COPY2,
    label: "Copy",
    icon: COPY_ICON,
    on: ["block", "stack", "selection"],
    category: "clipboard",
    offers: (board, target) => copies(board, target),
    run(_board, target, core) {
      copy(target, core);
      return void 0;
    }
  },
  {
    id: CUT,
    label: "Cut",
    icon: CUT_ICON,
    on: ["block", "stack", "selection"],
    category: "clipboard",
    offers: (board, target, lock) => !lock.board && copies(board, target),
    run(_board, target, core) {
      const { blocks, stacks } = copy(target, core);
      return [
        ...blocks.map((id) => ({ id: "blockr.core-remove_block", args: { id } })),
        ...stacks.map((id) => ({ id: "blockr.core-remove_stack", args: { id } }))
      ];
    }
  },
  {
    id: PASTE,
    label: "Paste",
    icon: PASTE_ICON,
    on: ["board"],
    category: "clipboard",
    offers: (_board, _target, lock) => !lock.board,
    async run(_board, _target, core) {
      const text = await readClipboard(document);
      if (text === void 0) return void 0;
      let read;
      try {
        read = await core.store.read(text);
      } catch {
        return void 0;
      }
      const batch = pasteBatch(core.store.board(), read.board, notedPoint(), (taken) => core.mintId(taken));
      return batch.length === 0 ? void 0 : batch;
    }
  },
  {
    id: LAYOUT,
    label: "Layout",
    icon: LAYOUT_ICON,
    on: ["board"],
    category: "edit",
    quick: (board, _target, core) => layoutLevel((graphState(board) ?? defaultState).layout, core)
  }
];
function copy(target, core) {
  const board = core.store.board();
  const copied = copiedOf(board, target);
  if (copied.blocks.length + copied.stacks.length > 0) {
    void writeClipboard(document, JSON.stringify(copiedBoard(core.store.jsonBoard(), copied)));
  }
  return copied;
}

// srcts/layout/layout.ts
function layOut(dagre, canvas, settings) {
  const { board } = canvas;
  const gap = gapOf(settings.spacing);
  const graph = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  graph.setGraph({ rankdir: settings.direction, nodesep: gap, ranksep: gap, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));
  const folded = new Set(
    [...canvas.collapsed].filter(
      (stack2) => (board.stacks[stack2]?.blocks ?? []).every((block) => canvas.positions[block] !== void 0)
    )
  );
  const held = stackOf(board);
  const nodeOf = (block) => {
    const stack2 = held.get(block);
    return stack2 !== void 0 && folded.has(stack2) ? stackNode(stack2) : blockNode(block);
  };
  for (const [id, stack2] of Object.entries(board.stacks)) {
    const one = folded.has(id) || stack2.blocks.length === 0;
    graph.setNode(stackNode(id), one ? { width: STACK_WIDTH, height: STACK_HEIGHT } : { width: 0, height: 0 });
  }
  for (const [id, block] of Object.entries(board.blocks)) {
    const stack2 = held.get(id);
    if (stack2 !== void 0 && folded.has(stack2)) continue;
    graph.setNode(blockNode(id), { width: blockWidth(block.name), height: BLOCK_HEIGHT });
    if (stack2 !== void 0) graph.setParent(blockNode(id), stackNode(stack2));
  }
  for (const [id, link] of Object.entries(board.links)) {
    const [from, to] = [nodeOf(link.from), nodeOf(link.to)];
    if (from !== to && graph.hasNode(from) && graph.hasNode(to)) graph.setEdge(from, to, {}, id);
  }
  dagre.layout(graph);
  const positions = {};
  const points2 = {};
  for (const id of Object.keys(board.blocks)) {
    if (nodeOf(id) !== blockNode(id)) continue;
    const node = graph.node(blockNode(id));
    positions[id] = { x: node.x ?? 0, y: node.y ?? 0 };
  }
  for (const [id, stack2] of Object.entries(board.stacks)) {
    const node = graph.node(stackNode(id));
    if (stack2.blocks.length === 0) {
      points2[id] = { x: node.x ?? 0, y: node.y ?? 0 };
      continue;
    }
    const box = folded.has(id) ? expandedBox(canvas, id) : void 0;
    if (box === void 0) continue;
    const [dx, dy] = [(node.x ?? 0) - box.x, (node.y ?? 0) - box.y];
    for (const block of stack2.blocks) {
      const point = canvas.positions[block];
      if (point !== void 0) positions[block] = { x: point.x + dx, y: point.y + dy };
    }
  }
  return { positions, points: points2 };
}
function blockNode(block) {
  return `block:${block}`;
}
function stackNode(stack2) {
  return `stack:${stack2}`;
}

// srcts/layout/load.ts
var loading;
function loadDagre() {
  loading ??= import("./dagre-474da1ab.js").catch((error) => {
    loading = void 0;
    throw error;
  });
  return loading;
}

// srcts/patches/patches.ts
function at(plugin, ...segments) {
  return pointer(["plugins", plugin, ...segments]);
}
function changePatches(state, changes, plugin) {
  const set = (part, id, value) => ({
    op: Object.hasOwn(state[part], id) ? "replace" : "add",
    path: at(plugin, part, id),
    value
  });
  return [
    ...Object.entries(changes.positions).map(([id, point]) => set("positions", id, point)),
    ...Object.entries(changes.points).map(([id, point]) => set("stacks", id, point))
  ];
}
function entryPatches(state, entries, plugin) {
  return Object.entries(entries).flatMap(([id, entry]) => {
    const has = Object.hasOwn(state.stacks, id);
    if (entry === null) return has ? [{ op: "remove", path: at(plugin, "stacks", id) }] : [];
    return [{ op: has ? "replace" : "add", path: at(plugin, "stacks", id), value: entry }];
  });
}
function unmovedPatches(state, blocks, stacks, plugin, except = /* @__PURE__ */ new Set()) {
  const [gone, goneStacks] = [[...blocks], [...stacks]];
  return Object.entries(state.stacks).flatMap(([id, entry]) => {
    if (!isCollapse(entry) || except.has(id)) return [];
    const drop = (part, ids) => ids.filter((other) => Object.hasOwn(entry.moved[part], other)).map((other) => ({ op: "remove", path: at(plugin, "stacks", id, "moved", part, other) }));
    return [...drop("positions", gone), ...drop("stacks", goneStacks)];
  });
}

// srcts/commands/common.ts
function command(definition) {
  return definition;
}
function passes(failures, context) {
  if (failures.length > 0) throw context.refusal(failures);
  return true;
}
function stateFailures(board) {
  return graphState(board) === void 0 ? ["The board holds no state of the DAG, so the app does not run it."] : [];
}

// srcts/commands/schemas.ts
function object(properties, required = []) {
  const used = Object.keys(DEFINITIONS).filter((name) => JSON.stringify(properties).includes(`"#/$defs/${name}"`));
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    ...used.length === 0 ? {} : { $defs: Object.fromEntries(used.map((name) => [name, DEFINITIONS[name] ?? {}])) }
  };
}
var DEFINITIONS = JSON.parse(
  JSON.stringify(graph_schema_default.definitions).replaceAll('"#/definitions/', '"#/$defs/')
);
function points(description) {
  return { type: "object", additionalProperties: { $ref: "#/$defs/Point" }, description };
}
function setting(name, description) {
  const layout = DEFINITIONS.Layout;
  const properties = isObject(layout) ? layout.properties : void 0;
  const property = isObject(properties) ? properties[name] : void 0;
  return { ...isObject(property) ? property : {}, description };
}
var stack = { type: "string", description: "The id of a stack of the board." };

// srcts/commands/layout.ts
var layoutCommands = [
  command({
    id: "blockr.graph-relayout",
    label: "Lay out again",
    description: "Lays the whole board out again, every block and every stack that holds no block, with the direction and the spacing given, which the DAG keeps from then on, or with those it holds where they are left out. It moves every block, so run it before placing blocks by hand, never after.",
    args: object({
      direction: setting("direction", "The way that the board runs: TB from top to bottom, or LR from left to right."),
      spacing: setting("spacing", "The gaps between blocks and between ranks: 50 px when compact, 70 px when normal and 100 px when loose.")
    }),
    preflight: (board, _args, context) => passes(stateFailures(board), context),
    async prepare(board, { direction, spacing }) {
      const state = graphState(board);
      const settings = {
        direction: direction ?? state?.layout.direction ?? "TB",
        spacing: spacing ?? state?.layout.spacing ?? "normal"
      };
      const dagre = await loadDagre();
      const changes = state === void 0 ? { positions: {}, points: {} } : layOut(dagre, canvasOf(board, state), settings);
      return { ...settings, changes };
    },
    run(board, { direction, spacing, changes }) {
      const state = graphState(board);
      if (state === void 0) return [];
      const layout = { ...state.layout, direction, spacing };
      const kept2 = {
        positions: Object.fromEntries(Object.entries(changes.positions).filter(([id]) => Object.hasOwn(board.blocks, id))),
        points: Object.fromEntries(Object.entries(changes.points).filter(([id]) => board.stacks[id]?.blocks.length === 0))
      };
      const snapped2 = snapChanges(canvasOf(board, state), kept2, layout);
      return { patches: [...changePatches(state, snapped2, GRAPH), ...settingPatches(state, { direction, spacing }), ...emptied(state)] };
    }
  }),
  command({
    id: "blockr.graph-set_placement",
    label: "Set placement",
    description: "Sets how the DAG places the blocks that later edits add: repulsion keeps a new block where it starts and moves the blocks around it out of its way, and beside moves the new block on to the nearest free spot and moves no other block. It moves no block itself.",
    args: object(
      { placement: setting("placement", "How the DAG places the blocks that later edits add.") },
      ["placement"]
    ),
    undo: false,
    preflight: (board, _args, context) => passes(stateFailures(board), context),
    run(board, { placement }) {
      const state = graphState(board);
      return state === void 0 ? [] : { patches: settingPatches(state, { placement }) };
    }
  }),
  command({
    id: "blockr.graph-set_snap",
    label: "Set snapping",
    description: "Sets whether the DAG snaps every position that it sets to a multiple of the snap size, and the snap size, in pixels of the canvas. It moves no block itself: the next move or layout snaps.",
    args: object({
      snap: setting("snap", "Whether the DAG snaps the positions that it sets."),
      snap_size: setting("snap_size", "The size that positions snap to, in pixels of the canvas.")
    }),
    undo: false,
    preflight: (board, _args, context) => passes(stateFailures(board), context),
    run(board, { snap, snap_size }) {
      const state = graphState(board);
      return state === void 0 ? [] : { patches: settingPatches(state, { snap, snap_size }) };
    }
  })
];
function settingPatches(state, settings) {
  const names = Object.keys(settings);
  return names.flatMap((name) => {
    const value = settings[name];
    return value === void 0 || state.layout[name] === value ? [] : [{ op: "replace", path: at(GRAPH, "layout", name), value }];
  });
}
function emptied(state) {
  return Object.entries(state.stacks).flatMap(([id, entry]) => {
    if (!isCollapse(entry)) return [];
    const { positions, stacks } = entry.moved;
    if (Object.keys(positions).length === 0 && Object.keys(stacks).length === 0) return [];
    return [{ op: "replace", path: at(GRAPH, "stacks", id, "moved"), value: { positions: {}, stacks: {} } }];
  });
}

// srcts/commands/positions.ts
var positionCommands = [
  command({
    id: "blockr.graph-change_position",
    label: "Move blocks",
    description: "Moves blocks, and stacks that hold no block, to the positions given, as a drag on the canvas does. A block's position is the centre of its node, which holds its mark and its name below it. A stack that holds blocks has no position of its own, since its box fits its blocks, so move its blocks instead. A position given for a block that the same batch adds is where the DAG starts to place it, after the command that adds it. Every block and stack left out stays where it is.",
    args: object({
      positions: points("The new positions of blocks, by the id of each block."),
      stacks: points("The new positions of stacks that hold no block, by the id of each stack.")
    }),
    preflight(board, { positions = {}, stacks = {} }, context) {
      const lacking = Object.keys(positions).filter((block) => !Object.hasOwn(board.blocks, block));
      const absent = Object.keys(stacks).filter((stack2) => !Object.hasOwn(board.stacks, stack2));
      const holding = Object.keys(stacks).filter((stack2) => (board.stacks[stack2]?.blocks.length ?? 0) > 0);
      return passes(
        [
          ...stateFailures(board),
          ...lacking.map((block) => `The board holds no block "${block}".`),
          ...absent.map((stack2) => `The board holds no stack "${stack2}".`),
          ...holding.map((stack2) => `The stack "${stack2}" holds blocks, so its box fits them and it takes no position.`)
        ],
        context
      );
    },
    run(board, { positions = {}, stacks = {} }) {
      const state = graphState(board);
      if (state === void 0) return [];
      const round = (point) => state.layout.snap ? snapPoint(point, state.layout.snap_size) : point;
      const rounded = (points2) => Object.fromEntries(Object.entries(points2).map(([id, point]) => [id, round(point)]));
      const changes = { positions: rounded(positions), points: rounded(stacks) };
      return {
        patches: [
          ...changePatches(state, changes, GRAPH),
          ...unmovedPatches(state, Object.keys(positions), Object.keys(stacks), GRAPH)
        ]
      };
    }
  })
];

// srcts/collapse/collapse.ts
var STILL = 0.5;
function collapses(board, state) {
  return Object.entries(state.stacks).flatMap(
    ([stack2, entry]) => isCollapse(entry) && (board.stacks[stack2]?.blocks.length ?? 0) > 0 ? [[stack2, entry]] : []
  ).sort(([, a], [, b]) => a.collapsed - b.collapsed);
}
function collapse(board, state, stack2) {
  const made = collapses(board, state);
  const place = Math.max(0, ...made.map(([, entry]) => entry.collapsed)) + 1;
  const { changes, moved } = closingUp(canvasOf(board, state), stack2, state.layout);
  return { changes, entries: { [stack2]: { collapsed: place, moved } } };
}
function expand(board, state, stack2) {
  const made = collapses(board, state);
  const own = made.find(([id]) => id === stack2)?.[1];
  const start2 = canvasOf(board, state);
  if (own === void 0) return { changes: { positions: {}, points: {} }, entries: {} };
  const earlier = made.filter(([, entry]) => entry.collapsed < own.collapsed).map(([id]) => id);
  const later = made.filter(([, entry]) => entry.collapsed > own.collapsed);
  let canvas = start2;
  for (const [, entry] of [...later].reverse()) canvas = undone(canvas, entry.moved);
  canvas = { ...undone(canvas, own.moved), collapsed: new Set(earlier) };
  const gap = gapOf(state.layout.spacing);
  canvas = changed(canvas, snapChanges(canvas, clearBox(canvas, stack2, gap), state.layout));
  const entries = { [stack2]: null };
  for (const [id, entry] of later) {
    const { changes, moved } = closingUp(canvas, id, state.layout);
    canvas = { ...changed(canvas, changes), collapsed: /* @__PURE__ */ new Set([...canvas.collapsed, id]) };
    entries[id] = { collapsed: entry.collapsed, moved };
  }
  return { changes: difference(start2, canvas), entries };
}
function closingUp(canvas, stack2, layout) {
  const changes = snapChanges(canvas, closeUp(canvas, stack2, gapOf(layout.spacing)), layout);
  return { changes, moved: { positions: moves(canvas.positions, changes.positions), stacks: moves(canvas.points, changes.points) } };
}
function undone(canvas, moved) {
  const back = (now, made) => Object.fromEntries(
    Object.entries(made).flatMap(([id, move]) => {
      const point = now[id];
      const still = point !== void 0 && Math.hypot(point.x - move.to.x, point.y - move.to.y) < STILL;
      return still ? [[id, move.from]] : [];
    })
  );
  return changed(canvas, { positions: back(canvas.positions, moved.positions), points: back(canvas.points, moved.stacks) });
}
function moves(from, to) {
  return Object.fromEntries(
    Object.entries(to).flatMap(([id, point]) => {
      const was = from[id];
      return was === void 0 || was.x === point.x && was.y === point.y ? [] : [[id, { from: was, to: point }]];
    })
  );
}
function difference(first, second) {
  const changes = (from, to, ids) => Object.fromEntries(
    ids.flatMap((id) => {
      const [was, now] = [from[id], to[id]];
      return now === void 0 || was?.x === now.x && was.y === now.y ? [] : [[id, now]];
    })
  );
  const blocks = Object.keys(first.board.blocks);
  return {
    positions: changes(first.positions, second.positions, blocks),
    points: changes(first.points, second.points, Object.keys(first.points))
  };
}

// srcts/commands/stacks.ts
var stackCommands = [
  command({
    id: "blockr.graph-collapse_stack",
    label: "Collapse or expand stack",
    description: "Collapses a stack, which then shows as a small box that holds its name and the number of its blocks, while the blocks around it close up on it, or expands a collapsed stack, putting back the blocks that its collapse moved. A stack that holds no block cannot collapse.",
    args: object(
      {
        stack,
        collapsed: { type: "boolean", description: "True to collapse the stack, false to expand it." }
      },
      ["stack", "collapsed"]
    ),
    preflight(board, { stack: stack2 }, context) {
      const held = board.stacks[stack2];
      return passes(
        [
          ...stateFailures(board),
          ...held === void 0 ? [`The board holds no stack "${stack2}".`] : [],
          ...held?.blocks.length === 0 ? [`The stack "${stack2}" holds no block, so it shows as a collapsed stack does already.`] : []
        ],
        context
      );
    },
    run(board, { stack: stack2, collapsed }) {
      const state = graphState(board);
      const entry = state?.stacks[stack2];
      if (state === void 0 || (entry !== void 0 && isCollapse(entry)) === collapsed) return [];
      const folded = collapsed ? collapse(board, state, stack2) : expand(board, state, stack2);
      return { patches: [...changePatches(state, folded.changes, GRAPH), ...entryPatches(state, folded.entries, GRAPH)] };
    }
  })
];

// srcts/commands/index.ts
var graphCommands = [...positionCommands, ...layoutCommands, ...stackCommands];

// srcts/plugin/after-step.ts
function afterStep(board, before, plugin) {
  const state = graphState(board, plugin);
  if (state === void 0) return [];
  const prior = graphState(before, plugin);
  const added = {
    blocks: new Set(Object.keys(board.blocks).filter((block) => !Object.hasOwn(before.blocks, block))),
    stacks: new Set(
      Object.entries(board.stacks).filter(([id, stack2]) => stack2.blocks.length === 0 && !Object.hasOwn(before.stacks, id)).map(([id]) => id)
    )
  };
  const moved = new Set(
    Object.keys(board.blocks).filter((block) => !added.blocks.has(block) && !samePoint(prior?.positions[block], state.positions[block]))
  );
  const placed2 = added.blocks.size + added.stacks.size === 0 ? { positions: {}, points: {} } : placeAdded(canvasOf(board, state), added, moved, state.layout);
  const entries = {};
  const emptied2 = /* @__PURE__ */ new Set();
  for (const [id, stack2] of Object.entries(board.stacks)) {
    const was = before.stacks[id];
    const entry = state.stacks[id];
    if (stack2.blocks.length === 0 && was !== void 0 && was.blocks.length > 0) {
      emptied2.add(id);
      const box = prior === void 0 ? void 0 : expandedBox(canvasOf(before, prior), id);
      if (box !== void 0) entries[id] = state.layout.snap ? snapPoint(box, state.layout.snap_size) : { x: box.x, y: box.y };
    } else if (stack2.blocks.length > 0 && entry !== void 0 && !isCollapse(entry)) {
      entries[id] = null;
    }
  }
  const pushed = (ids, of) => [...ids].filter((id) => !of.has(id));
  return [
    ...changePatches(state, placed2, plugin),
    ...unmovedPatches(
      state,
      pushed(Object.keys(placed2.positions), added.blocks),
      pushed(Object.keys(placed2.points), added.stacks),
      plugin,
      emptied2
    ),
    ...entryPatches(state, entries, plugin)
  ];
}
function samePoint(a, b) {
  return a === b || a !== void 0 && a.x === b?.x && a.y === b.y;
}

// srcts/plugin/start.ts
var PACKAGE = "blockr.graph";
function starting(board, plugin, dagre) {
  const state = graphState(board, plugin);
  if (state === void 0) return { patches: [], dropped: [] };
  const { kept: kept2, patches, dropped } = fitted(board, state, plugin);
  const canvas = canvasOf(board, kept2);
  const lacking = {
    blocks: new Set(Object.keys(board.blocks).filter((block) => kept2.positions[block] === void 0)),
    stacks: new Set(
      Object.entries(board.stacks).filter(([id, stack2]) => stack2.blocks.length === 0 && canvas.points[id] === void 0).map(([id]) => id)
    )
  };
  if (lacking.blocks.size + lacking.stacks.size === 0) return { patches, dropped };
  const none = Object.keys(kept2.positions).length === 0 && Object.keys(canvas.points).length === 0;
  if (none && dagre === void 0) return "layout";
  const changes = none && dagre !== void 0 ? snapChanges(canvas, layOut(dagre, canvas, kept2.layout), kept2.layout) : placeAdded(canvas, lacking, /* @__PURE__ */ new Set(), kept2.layout, "beside");
  return { patches: [...patches, ...changePatches(state, changes, plugin)], dropped };
}
function fitted(board, state, plugin) {
  const patches = [];
  const dropped = [];
  const drop = (path, what) => {
    patches.push({ op: "remove", path });
    dropped.push(what);
  };
  const positions = Object.fromEntries(Object.entries(state.positions).filter(([block]) => Object.hasOwn(board.blocks, block)));
  for (const block of Object.keys(state.positions)) {
    if (!Object.hasOwn(positions, block)) drop(at(plugin, "positions", block), `the position of the block "${block}", which the board lacks`);
  }
  const stacks = {};
  for (const [id, entry] of Object.entries(state.stacks)) {
    const stack2 = board.stacks[id];
    if (stack2 === void 0) {
      drop(at(plugin, "stacks", id), `the entry of the stack "${id}", which the board lacks`);
    } else if (!isCollapse(entry)) {
      if (stack2.blocks.length === 0) stacks[id] = entry;
      else drop(at(plugin, "stacks", id), `the position of the stack "${id}", which holds blocks`);
    } else if (stack2.blocks.length === 0) {
      dropped.push(`the collapse of the stack "${id}", which holds no block`);
    } else {
      const moved = (part, holds2, kind) => Object.fromEntries(
        Object.entries(entry.moved[part]).filter(([other]) => {
          if (holds2(other)) return true;
          drop(at(plugin, "stacks", id, "moved", part, other), `what the collapse of the stack "${id}" moved of the ${kind} "${other}", which the board lacks`);
          return false;
        })
      );
      stacks[id] = {
        collapsed: entry.collapsed,
        moved: {
          positions: moved("positions", (other) => Object.hasOwn(board.blocks, other), "block"),
          stacks: moved("stacks", (other) => Object.hasOwn(board.stacks, other), "stack")
        }
      };
    }
  }
  return { kept: { ...state, positions, stacks }, patches, dropped };
}
function start({ core, plugin, signal }) {
  const first = starting(core.store.board(), plugin);
  if (first !== "layout") {
    take(core, plugin, first);
    return void 0;
  }
  loadDagre().then((dagre) => {
    if (signal.aborted) return;
    const step = starting(core.store.board(), plugin, dagre);
    if (step !== "layout") take(core, plugin, step);
  }).catch((error) => {
    if (signal.aborted) return;
    const why = error instanceof Error ? error.message : String(error);
    core.log(PACKAGE).error(`The DAG could not lay the board out as it opened: ${why}`);
  });
  return void 0;
}
function take(core, plugin, step) {
  if (step.patches.length > 0) core.store.apply({ patches: step.patches }, plugin, { undo: false });
  if (step.dropped.length === 0) return;
  const message = `The DAG dropped what its state held that does not fit the board: ${listing(step.dropped)}.`;
  core.notifications.notify(plugin, { severity: "warning", code: "graph_state_dropped", message });
  core.log(PACKAGE).warn(message);
}
function listing(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}

// srcts/plugin/update.ts
function update(delta, board, plugin) {
  const removed = (rm, add) => (rm ?? []).filter((id) => add === void 0 || !Object.hasOwn(add, id));
  const blocks = removed(delta.blocks?.rm, delta.blocks?.add);
  const stacks = removed(delta.stacks?.rm, delta.stacks?.add);
  if (blocks.length === 0 && stacks.length === 0) return [];
  const stored = board.plugins[plugin];
  const state = stored === void 0 ? void 0 : patched(stored, delta.patches ?? [], plugin);
  if (!isGraphState(state)) return [];
  const remove = (part, id) => ({ op: "remove", path: at(plugin, part, id) });
  return [
    ...blocks.filter((block) => Object.hasOwn(state.positions, block)).map((block) => remove("positions", block)),
    ...stacks.filter((stack2) => Object.hasOwn(state.stacks, stack2)).map((stack2) => remove("stacks", stack2)),
    ...unmovedPatches(state, blocks, stacks, plugin, new Set(stacks))
  ];
}

// srcts/ui/module.tsx
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

// srcts/ui/graph.tsx
import { useBoard as useBoard4 } from "@blockr/core/react";
import { useCallback as useCallback4, useEffect as useEffect5, useLayoutEffect as useLayoutEffect2, useMemo as useMemo5, useRef as useRef6, useState as useState4 } from "react";

// srcts/flow/index.ts
import {
  BaseEdge,
  getBezierPath,
  getViewportForBounds,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow
} from "./xyflow-82a19db7.js";

// srcts/ui/actions.ts
import { useEffect, useMemo, useRef } from "react";

// srcts/ui/added.ts
function startAt(after, deltas, point) {
  const blocks = /* @__PURE__ */ new Set();
  const stacks = /* @__PURE__ */ new Set();
  for (const delta of deltas) {
    for (const id of Object.keys(delta.blocks?.add ?? {})) if (Object.hasOwn(after.blocks, id)) blocks.add(id);
    for (const id of Object.keys(delta.stacks?.add ?? {})) if (after.stacks[id]?.blocks.length === 0) stacks.add(id);
  }
  const state = graphState(after);
  const placed2 = [...blocks].some((id) => state?.positions[id] !== void 0) || [...stacks].some((id) => state?.stacks[id] !== void 0);
  if (placed2) return [];
  const [first] = linkOrder(after, blocks);
  if (first !== void 0) {
    const at2 = freeAt(after, state, blockBox(point, after.blocks[first]?.name ?? ""));
    return [{ id: "blockr.graph-change_position", args: { positions: { [first]: at2 } } }];
  }
  const [stack2] = stacks;
  if (stack2 !== void 0) return [{ id: "blockr.graph-change_position", args: { stacks: { [stack2]: freeAt(after, state, stackBoxAt(point)) } } }];
  return [];
}
function freeAt(board, state, box) {
  const offset = state === void 0 ? { x: 0, y: 0 } : freeOffset(canvasOf(board, state), [box], state.layout);
  return { x: box.x + offset.x, y: box.y + offset.y };
}

// srcts/ui/actions.ts
function useGraphActions(parts) {
  const latest = useRef(parts);
  useEffect(() => {
    latest.current = parts;
  });
  return useMemo(
    () => ({
      menu(target, client) {
        graphActions(latest.current).menu(target, client);
      },
      trigger: (id, target, from) => graphActions(latest.current).trigger(id, target, from)
    }),
    []
  );
}
function graphActions({ core, element, toCanvas, refuse, panel }) {
  const extendAt = (point) => (deltas) => {
    let after;
    try {
      after = core.store.dryRun(deltas);
    } catch {
      return [];
    }
    return startAt(after, deltas, point);
  };
  const notifierAt = (client) => (notifications) => {
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
        ..."board" in target ? { extend: extendAt(point) } : {},
        notifier: notifierAt(client),
        ...advanced === void 0 ? {} : { advanced }
      });
    },
    async trigger(id, target, from) {
      const frame = element();
      const el = "button" in from ? from.button : frame;
      if (el === null || frame === null) return;
      const middle = middleOf(frame);
      const at2 = "drop" in from ? from.drop : { client: middle, canvas: toCanvas(middle) };
      notePoint(at2.canvas);
      const advanced = panel(target);
      const button = "button" in from ? from.button.getBoundingClientRect() : void 0;
      const anchor = "drop" in from ? new DOMRect(from.drop.client.x, from.drop.client.y, 0, 0) : "button" in from ? besideToolbar(from.button) : void 0;
      await core.boardActions.trigger(id, target, {
        el,
        ...anchor === void 0 ? {} : { anchor },
        ..."board" in target || "drop" in from ? { extend: extendAt(at2.canvas) } : {},
        notifier: notifierAt(button === void 0 ? at2.client : { x: button.right, y: button.top }),
        ...advanced === void 0 ? {} : { advanced }
      }).catch(() => void 0);
    }
  };
}
var MENU_OFFSET = 4;
var SIDE_GAP = 8;
function besideToolbar(button) {
  const rect = button.getBoundingClientRect();
  const toolbar = button.closest(".blockr-graph-toolbar")?.getBoundingClientRect() ?? rect;
  const inset = rect.left - toolbar.left;
  return new DOMRect(toolbar.right + SIDE_GAP, rect.top - inset - MENU_OFFSET, 0, 0);
}
function middleOf(el) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// srcts/ui/canvas.tsx
import { useBoard } from "@blockr/core/react";
import { useCallback, useEffect as useEffect2, useMemo as useMemo2, useRef as useRef2, useState, useSyncExternalStore } from "react";

// srcts/ui/context.ts
import { createContext, useContext } from "react";
var GraphContext = createContext(null);
function useGraph() {
  const graph = useContext(GraphContext);
  if (graph === null) throw new Error("A component of the DAG draws outside the DAG's root.");
  return graph;
}

// srcts/ui/ids.ts
function blockNode2(block) {
  return `b:${block}`;
}
function stackNode2(stack2) {
  return `s:${stack2}`;
}
function linkEdge(link) {
  return `l:${link}`;
}
function objectOf(id) {
  const rest = id.slice(2);
  if (id.startsWith("b:")) return { block: rest };
  if (id.startsWith("s:")) return { stack: rest };
  if (id.startsWith("l:")) return { link: rest };
  return void 0;
}
function idOf(object2) {
  if ("block" in object2) return blockNode2(object2.block);
  if ("stack" in object2) return stackNode2(object2.stack);
  if ("link" in object2) return linkEdge(object2.link);
  return void 0;
}

// srcts/ui/elements.ts
var HANDLE = 8;
var HANDLE_STEP = 12;
var DOT_REACH = 8;
var GROWN = HANDLE * 1.5 / 2;
var DOT_ROOM = DOT_REACH + GROWN;
var NEXT = "next";
var DOTS = "...";
function elementsOf(drawing) {
  const { canvas, registry, layout, selected, hovered, locked, spread } = drawing;
  const { board } = canvas;
  const held = stackOf(board);
  const boxes = /* @__PURE__ */ new Map();
  for (const stack2 of Object.keys(board.stacks)) {
    const box = shownBox(canvas, stack2);
    if (box !== void 0) boxes.set(stack2, whole(box));
  }
  const shown = (block) => {
    const point = canvas.positions[block];
    if (point === void 0 || board.blocks[block] === void 0) return void 0;
    const stack2 = held.get(block);
    if (stack2 === void 0 || !canvas.collapsed.has(stack2)) return { node: blockNode2(block), centre: point };
    const box = boxes.get(stack2);
    return box === void 0 ? void 0 : { node: stackNode2(stack2), centre: { x: box.x, y: box.y } };
  };
  const links = [];
  for (const [id, link] of Object.entries(board.links)) {
    const from = shown(link.from);
    const to = shown(link.to);
    if (from === void 0 || to === void 0 || from.node === to.node) continue;
    links.push({ id, from, to, out: sideTowards(from.centre, to.centre), in: sideTowards(to.centre, from.centre) });
  }
  const byId = new Map(links.map((link) => [link.id, link]));
  const stackNodes = [];
  for (const [id, stack2] of Object.entries(board.stacks)) {
    const box = boxes.get(id);
    if (box === void 0) continue;
    const shows = stack2.blocks.length === 0 ? "empty" : canvas.collapsed.has(id) ? "collapsed" : "expanded";
    const handles = shows === "collapsed" ? stackHandles(box, links, stackNode2(id)) : [];
    stackNodes.push({
      id: stackNode2(id),
      type: "stack",
      position: { x: box.x, y: box.y },
      width: box.w,
      height: box.h,
      measured: { width: box.w, height: box.h },
      handles: handles.map(nodeHandle),
      selected: selected.has(stackNode2(id)),
      data: { kind: "stack", stack: id, name: stack2.name, color: stack2.color, count: stack2.blocks.length, shows, handles }
    });
  }
  const nodes = [];
  for (const [id, block] of Object.entries(board.blocks)) {
    const point = canvas.positions[id];
    const stack2 = held.get(id);
    if (point === void 0 || stack2 !== void 0 && canvas.collapsed.has(stack2)) continue;
    const entry = registry[block.registry_id];
    const width = blockWidth(block.name);
    const spreading = spread?.node === blockNode2(id) ? spread.side : null;
    const handles = blockHandles({ board, id, entry, width, layout, links, byId, locked, spreading });
    const parent = stack2 === void 0 ? void 0 : boxes.get(stack2);
    nodes.push({
      id: blockNode2(id),
      type: "block",
      position: parent === void 0 ? point : { x: point.x - (parent.x - parent.w / 2), y: point.y - (parent.y - parent.h / 2) },
      ...parent === void 0 || stack2 === void 0 ? {} : { parentId: stackNode2(stack2) },
      width,
      height: BLOCK_HEIGHT,
      measured: { width, height: BLOCK_HEIGHT },
      handles: handles.map(nodeHandle),
      selected: selected.has(blockNode2(id)),
      data: { kind: "block", block: id, name: block.name, entry, handles }
    });
  }
  nodes.push(...stackNodes);
  const edges = links.map((link) => {
    const { input } = board.links[link.id] ?? { input: "" };
    const target = link.to.node.startsWith("b:") ? inputHandle(board, link.id) : `in-${link.in}`;
    return {
      id: linkEdge(link.id),
      type: "link",
      source: link.from.node,
      target: link.to.node,
      sourceHandle: `out-${link.out}`,
      targetHandle: target,
      selected: selected.has(linkEdge(link.id)),
      ...hovered === link.id ? { className: "blockr-graph-hovered" } : {},
      data: { link: link.id, label: input === "" ? placeLabel(board, link.id) : input }
    };
  });
  return { nodes, edges };
}
function whole(box) {
  return { ...box, w: Math.ceil(box.w), h: Math.ceil(box.h) };
}
function sideTowards(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}
function idleSide(layout, type) {
  if (layout.direction === "TB") return type === "target" ? "top" : "bottom";
  return type === "target" ? "left" : "right";
}
function isVariadic(entry) {
  return entry?.inputs.length === 1 && entry.inputs[0] === DOTS;
}
function inputHandle(board, link) {
  return `in:${board.links[link]?.input ?? ""}#${link}`;
}
function placeLabel(board, link) {
  const to = board.links[link]?.to;
  const into = Object.entries(board.links).filter(([, other]) => other.to === to);
  return `Input ${String(into.findIndex(([id]) => id === link) + 1)}`;
}
function blockHandles({ board, id, entry, width, layout, links, byId, locked, spreading }) {
  const into = Object.entries(board.links).filter(([, link]) => link.to === id);
  const name = (block) => board.blocks[block]?.name ?? block;
  const wanted = [];
  if (isVariadic(entry)) {
    for (const [i, [link, { from, input }]] of into.entries()) {
      const label = input === "" ? `Input ${String(i + 1)}` : input;
      wanted.push({
        id: inputHandle(board, link),
        type: "target",
        side: byId.get(link)?.in ?? idleSide(layout, "target"),
        name: label,
        label: `${label}, from ${name(from)}`,
        link,
        connectable: !locked
      });
    }
    wanted.push({
      id: NEXT,
      type: "target",
      side: idleSide(layout, "target"),
      name: "Next input",
      label: "Next input",
      input: "",
      connectable: !locked
    });
  } else {
    const inputs = [...entry?.inputs ?? []];
    for (const [, link] of into) if (!inputs.includes(link.input)) inputs.push(link.input);
    for (const input of inputs) {
      const feeding = into.find(([, link]) => link.input === input);
      wanted.push({
        id: feeding === void 0 ? `in:${input}` : inputHandle(board, feeding[0]),
        type: "target",
        side: (feeding === void 0 ? void 0 : byId.get(feeding[0])?.in) ?? idleSide(layout, "target"),
        name: input,
        label: feeding === void 0 ? input : `${input}, from ${name(feeding[1].from)}`,
        ...feeding === void 0 ? {} : { link: feeding[0] },
        input,
        connectable: !locked
      });
    }
  }
  const sides = new Set(links.filter((link) => link.from.node === blockNode2(id)).map((link) => link.out));
  if (sides.size === 0) sides.add(idleSide(layout, "source"));
  for (const side of SIDES) {
    if (sides.has(side)) wanted.push({ id: `out-${side}`, type: "source", side, name: "Result", label: "Result", connectable: !locked });
  }
  const markLeft = (width - MARK) / 2;
  const [first, last2] = [HANDLE / 2, MARK - HANDLE / 2];
  const lines = {
    top: { x: width / 2, y: 0, along: "x", lo: markLeft + first, hi: markLeft + last2 },
    bottom: { x: width / 2, y: BLOCK_HEIGHT, along: "x", lo: markLeft + first, hi: markLeft + last2 },
    left: { x: markLeft, y: MARK / 2, along: "y", lo: first, hi: last2 },
    right: { x: markLeft + MARK, y: MARK / 2, along: "y", lo: first, hi: MARK - DOT_ROOM, most: MARK - DOT_ROOM }
  };
  return placed(wanted, lines, spreading);
}
function stackHandles(box, links, node) {
  const wanted = [];
  for (const side of SIDES) {
    if (links.some((link) => link.to.node === node && link.in === side)) {
      wanted.push({ id: `in-${side}`, type: "target", side, name: "Links in", label: "Links into the stack", connectable: false });
    }
    if (links.some((link) => link.from.node === node && link.out === side)) {
      wanted.push({ id: `out-${side}`, type: "source", side, name: "Links out", label: "Links out of the stack", connectable: false });
    }
  }
  const [first, w, h] = [HANDLE / 2, box.w, box.h];
  const lines = {
    top: { x: w / 2, y: 0, along: "x", lo: first, hi: w - first },
    bottom: { x: w / 2, y: h, along: "x", lo: first, hi: w - first },
    left: { x: 0, y: h / 2, along: "y", lo: first, hi: h - first },
    right: { x: w, y: h / 2, along: "y", lo: first, hi: h - first }
  };
  return placed(wanted, lines, null);
}
var SIDES = ["top", "right", "bottom", "left"];
function placed(wanted, lines, spreading) {
  const out = [];
  for (const side of SIDES) {
    const handles = wanted.filter((handle) => handle.side === side);
    const line = lines[side];
    const { at: at2, crowded } = middles(handles.length, line, spreading === side);
    for (const [i, handle] of handles.entries()) {
      const along = at2[i] ?? 0;
      const x = line.along === "x" ? along : line.x;
      const y = line.along === "y" ? along : line.y;
      out.push({ ...handle, crowded, x: x - HANDLE / 2, y: y - HANDLE / 2 });
    }
  }
  return out;
}
function middles(n, line, spreading) {
  const middle = line.along === "x" ? line.x : line.y;
  const full = Array.from({ length: n }, (_, i) => middle + (i - (n - 1) / 2) * HANDLE_STEP);
  const [first, last2] = [full[0] ?? middle, full.at(-1) ?? middle];
  const crowded = (n - 1) * HANDLE_STEP > line.hi - line.lo;
  if (!crowded) {
    const shift = first < line.lo ? line.lo - first : last2 > line.hi ? line.hi - last2 : 0;
    return { at: full.map((at2) => at2 + shift), crowded };
  }
  if (spreading) {
    const back = line.most === void 0 ? 0 : Math.max(0, last2 - line.most);
    return { at: full.map((at2) => at2 - back), crowded };
  }
  const step = (line.hi - line.lo) / (n - 1);
  return { at: Array.from({ length: n }, (_, i) => line.lo + i * step), crowded };
}
var POSITIONS = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left
};
function nodeHandle(handle) {
  return { id: handle.id, type: handle.type, position: POSITIONS[handle.side], x: handle.x, y: handle.y, width: HANDLE, height: HANDLE };
}
function positionOf(side) {
  return POSITIONS[side];
}

// srcts/ui/link.tsx
import { memo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var ARROW = 8;
var OUTWARD = {
  [Position.Top]: [0, -1],
  [Position.Right]: [1, 0],
  [Position.Bottom]: [0, 1],
  [Position.Left]: [-1, 0]
};
var LinkView = memo(
  DrawnLink,
  (a, b) => a.sourceX === b.sourceX && a.sourceY === b.sourceY && a.targetX === b.targetX && a.targetY === b.targetY && a.sourcePosition === b.sourcePosition && a.targetPosition === b.targetPosition && a.data?.label === b.data?.label
);
function DrawnLink({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data
}) {
  const [ox, oy] = OUTWARD[targetPosition];
  const [baseX, baseY] = [targetX + ox * ARROW, targetY + oy * ARROW];
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX: baseX,
    targetY: baseY,
    targetPosition
  });
  const [px, py] = [-oy * (ARROW / 2), ox * (ARROW / 2)];
  const arrow = `M${String(targetX)},${String(targetY)} L${String(baseX + px)},${String(baseY + py)} L${String(baseX - px)},${String(baseY - py)} Z`;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      BaseEdge,
      {
        id,
        path,
        labelX,
        labelY,
        label: data?.label,
        labelShowBg: true,
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        interactionWidth: 16
      }
    ),
    /* @__PURE__ */ jsx("path", { className: "blockr-graph-arrow", d: arrow })
  ] });
}

// srcts/ui/links.ts
function linkDrop(nodes, { source, target, targetHandle }) {
  const from = objectOf(source);
  const to = objectOf(target);
  const node = nodes.find((each) => each.id === target);
  if (from === void 0 || to === void 0 || !("block" in from) || !("block" in to) || node?.data.kind !== "block") return void 0;
  const handle = node.data.handles.find((each) => each.id === targetHandle);
  if (handle === void 0) return void 0;
  if (handle.input === void 0) return { taken: takenPlace(handle.link ?? "", handle.name, to.block) };
  return { add: { from: from.block, to: to.block, ...handle.input === "" ? {} : { input: handle.input } } };
}
function takenPlace(link, place, block) {
  return `The link "${link}" feeds the place "${place}" of block "${block}" already.`;
}
function canvasDrop(event, nodes, from, handle, canvas) {
  const client = clientOf(event);
  if (client === void 0 || handle === null || canvas === null) return void 0;
  const hit = document.elementFromPoint(client.x, client.y);
  if (hit === null || !canvas.contains(hit) || hit.closest(".react-flow__node") !== null) return void 0;
  const object2 = objectOf(from);
  const node = nodes.find((each) => each.id === from);
  if (object2 === void 0 || !("block" in object2) || node?.data.kind !== "block") return void 0;
  if (handle.type === "source") return { role: "append_block_role", target: { block: object2.block }, client };
  const input = node.data.handles.find((each) => each.id === handle.id)?.input;
  return input === void 0 ? void 0 : { role: "prepend_block_role", target: { block: object2.block, input }, client };
}
function clientOf(event) {
  if ("changedTouches" in event) {
    const touch = event.changedTouches[0];
    return touch === void 0 ? void 0 : { x: touch.clientX, y: touch.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

// srcts/ui/moves.ts
var NO_MOVES = { positions: {}, points: {} };
function canvasNode(canvas, node) {
  const object2 = objectOf(node);
  if (object2 === void 0) return void 0;
  if ("block" in object2) {
    const box2 = boxOfBlock(canvas, object2.block);
    return box2 === void 0 ? void 0 : { kind: "block", id: object2.block, box: box2, stack: stackOf(canvas.board).get(object2.block) ?? null };
  }
  if (!("stack" in object2)) return void 0;
  const box = shownBox(canvas, object2.stack);
  return box === void 0 ? void 0 : { kind: "stack", id: object2.stack, box, stack: object2.stack };
}
function centreOf(canvas, node) {
  const box = canvasNode(canvas, node)?.box;
  return box === void 0 ? void 0 : { x: box.x, y: box.y };
}
function movedBy(canvas, nodes, dx, dy, layout) {
  let changes = NO_MOVES;
  for (const id of nodes) {
    const node = canvasNode(canvas, id);
    if (node !== void 0) changes = merged(changes, nodeChanges(canvas, node, shifted(node.box, dx, dy)));
  }
  return layout.snap ? snapped(changes, layout.snap_size) : changes;
}
function snapped(changes, size) {
  const round = (points2) => Object.fromEntries(Object.entries(points2).map(([id, point]) => [id, snapPoint(point, size)]));
  return { positions: round(changes.positions), points: round(changes.points) };
}
function dragMoves(start2, nodes, from, to, layout) {
  return movedBy(start2, nodes, to.x - from.x, to.y - from.y, layout);
}
function keyMoves(canvas, moved, layout) {
  const step = (by) => Math.abs(by) < 1 ? 0 : Math.sign(by) * layout.snap_size;
  let changes = NO_MOVES;
  for (const [node, to] of moved) {
    const from = centreOf(canvas, node);
    if (from === void 0) continue;
    let [dx, dy] = [to.x - from.x, to.y - from.y];
    if (layout.snap) [dx, dy] = [step(dx), step(dy)];
    changes = merged(changes, movedBy(canvas, [node], dx, dy, layout));
  }
  return changes;
}
function joins(start2, moves2, nodes) {
  const held = stackOf(start2.board);
  const boxes = [];
  for (const stack2 of Object.keys(start2.board.stacks)) {
    const box = shownBox(start2, stack2);
    if (box !== void 0) boxes.push([stack2, box]);
  }
  const joined = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const object2 = objectOf(node);
    if (object2 === void 0 || !("block" in object2)) continue;
    const point = moves2.positions[object2.block];
    if (point === void 0) continue;
    const own = held.get(object2.block);
    const holding = boxes.filter(([stack2, box]) => stack2 !== own && contains(box, point)).sort(([, a], [, b]) => a.w * a.h - b.w * b.h);
    const [first] = holding;
    if (first !== void 0) joined.set(object2.block, first[0]);
  }
  return joined;
}
function contains(box, point) {
  return Math.abs(point.x - box.x) <= box.w / 2 && Math.abs(point.y - box.y) <= box.h / 2;
}
function movesBatch(canvas, moves2, joined = /* @__PURE__ */ new Map()) {
  const positions = movedOnly(canvas.positions, moves2.positions);
  const stacks = movedOnly(canvas.points, moves2.points);
  const batch = [];
  for (const [stack2, blocks] of joiningBlocks(canvas.board, joined)) {
    batch.push({ id: "blockr.core-change_stack", args: { id: stack2, blocks } });
  }
  if (Object.keys(positions).length > 0 || Object.keys(stacks).length > 0) {
    batch.push({ id: "blockr.graph-change_position", args: { positions, stacks } });
  }
  return batch;
}
function movedOnly(from, moved) {
  const out = {};
  for (const [id, point] of Object.entries(moved)) {
    const was = from[id];
    if (was?.x !== point.x || was.y !== point.y) out[id] = { x: point.x, y: point.y };
  }
  return out;
}
function joiningBlocks(board, joined) {
  const stacks = /* @__PURE__ */ new Map();
  for (const block of Object.keys(board.blocks)) {
    const stack2 = joined.get(block);
    if (stack2 === void 0) continue;
    stacks.set(stack2, [...stacks.get(stack2) ?? board.stacks[stack2]?.blocks ?? [], block]);
  }
  return stacks;
}

// srcts/ui/nodes.tsx
import { Button, useNotified, useStatus } from "@blockr/core/react";
import { memo as memo2 } from "react";

// srcts/ui/status-dot.ts
var DOTS2 = {
  stale: { ring: false, tooltip: "Inputs changed since this block last ran" },
  waiting: { ring: true, tooltip: "Waiting for a data input" },
  invalid: { ring: false, tooltip: "Set this block's inputs" },
  failed: { ring: false, tooltip: "Evaluation failed" },
  ready: { ring: false, tooltip: "Up to date" },
  unevaluated: { ring: true, tooltip: "Not evaluated yet" }
};
function statusDot(status, notifications) {
  if (status === void 0) return null;
  const reads = status.status !== "stale" && notifications.some(isOutputError) ? "failed" : status.status;
  return { status: reads, ...DOTS2[reads] };
}
function isOutputError({ severity, source }) {
  if (severity !== "error") return false;
  if (source.kind === "r") return source.request.type === "output";
  return source.kind === "core" && source.code === "output_unanswered";
}

// srcts/ui/tip.tsx
import { Focusable, Tooltip, TooltipTrigger } from "@blockr/core/react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var DELAY = 600;
function Tip({ label, children }) {
  return /* @__PURE__ */ jsxs2(TooltipTrigger, { delay: DELAY, closeDelay: 0, children: [
    /* @__PURE__ */ jsx2(Focusable, { children }),
    /* @__PURE__ */ jsx2(Tooltip, { placement: "top", children: label })
  ] });
}

// srcts/ui/nodes.tsx
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var UNCATEGORIZED = "uncategorized";
function categoryOf(entry) {
  return entry === void 0 || entry.category === "" ? UNCATEGORIZED : entry.category;
}
var BlockNodeView = memo2(DrawnBlock, sameNode);
var StackNodeView = memo2(DrawnStack, sameNode);
function sameNode(a, b) {
  return a.selected === b.selected && sameValue(a.data, b.data);
}
function sameValue(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) || Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => sameValue(a[key], b[key]));
}
function DrawnBlock({ id, data, selected }) {
  const { core } = useGraph();
  const status = useStatus(core, data.block);
  const notified = useNotified(core, { block: data.block });
  const dot = statusDot(status, notified);
  return /* @__PURE__ */ jsxs3("div", { className: "blockr-graph-block", "data-selected": selected ? "" : void 0, children: [
    /* @__PURE__ */ jsxs3("span", { className: "blockr-graph-mark-frame", children: [
      /* @__PURE__ */ jsx3(
        "span",
        {
          className: "blockr-graph-mark",
          "data-category": categoryOf(data.entry),
          "aria-hidden": "true",
          dangerouslySetInnerHTML: { __html: data.entry?.icon ?? "" }
        }
      ),
      dot === null ? null : /* @__PURE__ */ jsx3(Dot, { dot })
    ] }),
    /* @__PURE__ */ jsx3("span", { className: "blockr-graph-name", children: data.name }),
    data.handles.map((handle) => /* @__PURE__ */ jsx3(GraphHandle, { node: id, handle }, handle.id))
  ] });
}
function Dot({ dot }) {
  return /* @__PURE__ */ jsx3(Tip, { label: dot.tooltip, children: /* @__PURE__ */ jsx3(
    "span",
    {
      className: "blockr-graph-dot",
      "data-status": dot.status,
      "data-ring": dot.ring ? "" : void 0,
      role: "img",
      "aria-label": dot.tooltip
    }
  ) });
}
function GraphHandle({ node, handle }) {
  const { enter, leave, actions } = useGraph();
  const style = { left: handle.x, top: handle.y, width: HANDLE, height: HANDLE };
  const object2 = objectOf(node);
  const target = object2 !== void 0 && "block" in object2 ? handleTarget(object2.block, handle) : void 0;
  return /* @__PURE__ */ jsx3(Tip, { label: handle.label, children: /* @__PURE__ */ jsx3(
    Handle,
    {
      id: handle.id,
      type: handle.type,
      position: positionOf(handle.side),
      isConnectable: handle.connectable,
      className: "blockr-graph-handle",
      style,
      "aria-label": handle.label,
      "data-crowded": handle.crowded ? "" : void 0,
      onPointerEnter: () => {
        enter({ node, side: handle.side, ...handle.link === void 0 ? {} : { link: handle.link }, crowded: handle.crowded });
      },
      onPointerLeave: leave,
      ...target === void 0 ? {} : {
        onContextMenu: (event) => {
          event.preventDefault();
          event.stopPropagation();
          actions.menu(target, { x: event.clientX, y: event.clientY });
        }
      }
    }
  ) });
}
function handleTarget(block, handle) {
  if (handle.type === "source") return void 0;
  if (handle.link !== void 0) return { link: handle.link };
  return handle.input === void 0 ? void 0 : { block, input: handle.input };
}
function DrawnStack({ data, selected }) {
  const { core } = useGraph();
  const color = data.color ?? "var(--bc-color-border-default)";
  const count = `${String(data.count)} ${data.count === 1 ? "block" : "blocks"}`;
  const collapse2 = data.shows === "empty" ? null : /* @__PURE__ */ jsx3(
    Button,
    {
      variant: "quiet",
      className: "blockr-graph-collapse nodrag",
      "aria-label": data.shows === "collapsed" ? `Expand ${data.name}` : `Collapse ${data.name}`,
      onPress: () => {
        void core.commands.run("blockr.graph-collapse_stack", { stack: data.stack, collapsed: data.shows !== "collapsed" });
      },
      children: /* @__PURE__ */ jsx3(Chevron, { collapsed: data.shows === "collapsed" })
    }
  );
  return /* @__PURE__ */ jsx3(
    "div",
    {
      className: "blockr-graph-stack",
      "data-shows": data.shows,
      "data-selected": selected ? "" : void 0,
      style: { "--blockr-graph-stack-color": color },
      children: data.shows === "expanded" ? /* @__PURE__ */ jsxs3(Fragment2, { children: [
        /* @__PURE__ */ jsx3("span", { className: "blockr-graph-stack-name", children: data.name }),
        collapse2
      ] }) : /* @__PURE__ */ jsxs3(Fragment2, { children: [
        /* @__PURE__ */ jsxs3("span", { className: "blockr-graph-stack-title", children: [
          /* @__PURE__ */ jsx3("span", { className: "blockr-graph-stack-label", children: data.name }),
          /* @__PURE__ */ jsx3("span", { className: "blockr-graph-stack-count", children: count })
        ] }),
        collapse2,
        data.handles.map((handle) => /* @__PURE__ */ jsx3(
          Handle,
          {
            id: handle.id,
            type: handle.type,
            position: positionOf(handle.side),
            isConnectable: false,
            className: "blockr-graph-handle blockr-graph-stack-handle",
            style: { left: handle.x, top: handle.y, width: HANDLE, height: HANDLE }
          },
          handle.id
        ))
      ] })
    }
  );
}
function Chevron({ collapsed }) {
  return /* @__PURE__ */ jsx3("svg", { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": "true", "data-collapsed": collapsed ? "" : void 0, children: /* @__PURE__ */ jsx3("path", { d: "M3 4.5 L6 7.5 L9 4.5", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }) });
}

// srcts/ui/selection.ts
function selectedIds(objects) {
  return new Set(objects.flatMap((object2) => idOf(object2) ?? []));
}
function selectionAfter(current, drawn, changes, rectangle) {
  const additive = changes.every((change) => change.selected);
  const ids = /* @__PURE__ */ new Map();
  for (const object2 of current) {
    const id = idOf(object2);
    const kept2 = id !== void 0 && drawn.has(id) ? true : additive;
    if (kept2) ids.set(id ?? `other:${JSON.stringify(object2)}`, object2);
  }
  for (const { id, selected } of changes) {
    const object2 = objectOf(id);
    if (object2 === void 0) continue;
    if (selected) ids.set(id, object2);
    else ids.delete(id);
  }
  if (rectangle !== void 0) {
    for (const edge of rectangle.edges) {
      if (ids.has(edge.id) && !(ids.has(edge.source) && ids.has(edge.target))) ids.delete(edge.id);
    }
  }
  return [...ids.values()];
}
function sameSelection(a, b) {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map((object2) => JSON.stringify(object2)));
  return b.every((object2) => keys.has(JSON.stringify(object2)));
}
function menuTarget(object2, selection) {
  const key = JSON.stringify(object2);
  return selection.length > 1 && selection.some((each) => JSON.stringify(each) === key) ? { selection } : object2;
}
function shownBlock(objects) {
  const [only] = objects;
  return objects.length === 1 && only !== void 0 && "block" in only ? only.block : void 0;
}

// srcts/ui/view.ts
var views = /* @__PURE__ */ new Map();
function savedView(board) {
  return views.get(board);
}
function saveView(board, view) {
  views.set(board, { x: view.x, y: view.y, zoom: view.zoom });
}
var DURATION = 200;
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 2;
var FIT_ZOOM = 1;
var FIT_PADDING = { top: "36px", right: "24px", bottom: "24px", left: "60px" };
var STACK_NAME = 20;
function fittedView(canvas, size) {
  const boxes = canvasNodes(canvas).map((node) => node.box);
  for (const stack2 of Object.keys(canvas.board.stacks)) {
    const box2 = shownBox(canvas, stack2);
    if (box2 !== void 0) boxes.push({ ...box2, y: box2.y - STACK_NAME / 2, h: box2.h + STACK_NAME });
  }
  const box = bounds(boxes);
  if (box === void 0 || size.width === 0 || size.height === 0) return void 0;
  const rect = { x: box.x - box.w / 2, y: box.y - box.h / 2, width: box.w, height: box.h };
  return getViewportForBounds(rect, size.width, size.height, MIN_ZOOM, FIT_ZOOM, FIT_PADDING);
}

// srcts/ui/canvas.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
var NODE_TYPES = { block: BlockNodeView, stack: StackNodeView };
var EDGE_TYPES = { link: LinkView };
var ORIGIN = [0.5, 0.5];
var PAUSE = 500;
function Canvas({ hovered, spread, size, onRefusal }) {
  const { core, plugin, actions } = useGraph();
  const board = useBoard(core);
  const selection = useSyncExternalStore(
    useCallback((notify) => core.selection.subscribe(notify), [core]),
    () => core.selection.get()
  );
  const flow = useReactFlow();
  const state = graphState(board, plugin) ?? defaultState;
  const { layout } = state;
  const locked = core.lock.board;
  const registry = core.blockRegistry();
  const [moves2, setMovesState] = useState(NO_MOVES);
  const movesRef = useRef2(NO_MOVES);
  const setMoves = useCallback((next) => {
    movesRef.current = next;
    setMovesState(next);
  }, []);
  const base = useMemo2(() => canvasOf(board, state), [board, state]);
  const canvas = useMemo2(() => changed(base, moves2), [base, moves2]);
  const selected = useMemo2(() => selectedIds(selection), [selection]);
  const { nodes, edges } = useMemo2(
    () => elementsOf({ canvas, registry, layout, selected, hovered, locked, spread }),
    [canvas, registry, layout, selected, hovered, locked, spread]
  );
  const drawn = useRef2({ nodes, edges });
  useEffect2(() => {
    drawn.current = { nodes, edges };
  }, [nodes, edges]);
  const current = useCallback(() => {
    const now = core.store.board();
    return canvasOf(now, graphState(now, plugin) ?? defaultState);
  }, [core, plugin]);
  const keyTimer = useRef2(void 0);
  const runMoves = useCallback(
    async (batch) => {
      clearTimeout(keyTimer.current);
      try {
        if (batch.length > 0) await core.commands.run(batch);
      } catch {
      } finally {
        setMoves(NO_MOVES);
      }
    },
    [core, setMoves]
  );
  const drag = useRef2(null);
  const root = useRef2(null);
  const runKeys = useCallback(() => {
    clearTimeout(keyTimer.current);
    if (drag.current !== null || movesRef.current === NO_MOVES) return;
    void runMoves(movesBatch(current(), movesRef.current));
  }, [current, runMoves]);
  useEffect2(
    () => () => {
      clearTimeout(keyTimer.current);
    },
    []
  );
  const centre = useCallback(
    (id, position) => {
      const parentId = flow.getInternalNode(id)?.parentId;
      const parent = parentId === void 0 ? void 0 : flow.getInternalNode(parentId);
      const offset = parent?.internals.positionAbsolute ?? { x: 0, y: 0 };
      return { x: position.x + offset.x, y: position.y + offset.y };
    },
    [flow]
  );
  const startDrag = useCallback(
    (lead, dragged) => {
      clearTimeout(keyTimer.current);
      const pending = movesRef.current;
      const start2 = changed(current(), pending);
      const from = /* @__PURE__ */ new Map();
      for (const { id } of dragged) {
        const point = centreOf(start2, id);
        if (point !== void 0) from.set(id, point);
      }
      const first = lead ?? dragged[0]?.id;
      drag.current = first === void 0 ? null : { canvas: start2, pending, from, lead: first };
    },
    [current]
  );
  const endDrag = useCallback(() => {
    const ended = drag.current;
    drag.current = null;
    if (ended === null) return;
    const now = movesRef.current;
    const joined = locked ? /* @__PURE__ */ new Map() : joins(ended.canvas, now, ended.from.keys());
    void runMoves(movesBatch(current(), now, joined));
  }, [current, locked, runMoves]);
  const selects = useRef2([]);
  const clicked = useRef2(null);
  const flushing = useRef2(false);
  const rectangle = useRef2(null);
  const flushSelects = useCallback(() => {
    flushing.current = false;
    const changes = selects.current;
    const click = clicked.current;
    const box = rectangle.current;
    selects.current = [];
    clicked.current = null;
    if (box === "ended") rectangle.current = null;
    const before = core.selection.get();
    const ids = /* @__PURE__ */ new Set([...drawn.current.nodes.map((node) => node.id), ...drawn.current.edges.map((edge) => edge.id)]);
    const after = changes.length === 0 ? before : selectionAfter(before, ids, changes, box === "drawing" ? { edges: drawn.current.edges } : void 0);
    const changedSelection = !sameSelection(before, after);
    if (changedSelection) core.selection.set(after);
    if (box === "drawing") return;
    const block = shownBlock(after);
    if (block !== void 0 && (changedSelection || box === "ended" || click === blockNode2(block))) {
      core.show({ block }).catch(() => void 0);
    }
  }, [core]);
  const scheduleSelects = useCallback(() => {
    if (flushing.current) return;
    flushing.current = true;
    queueMicrotask(flushSelects);
  }, [flushSelects]);
  const onNodesChange = useCallback(
    (changes) => {
      const moved = /* @__PURE__ */ new Map();
      const selecting = [];
      for (const change of changes.toArray()) {
        if (change.type === "position" && change.position !== void 0) moved.set(change.id, centre(change.id, change.position));
        if (change.type === "select") selecting.push({ id: change.id, selected: change.selected });
      }
      const dragging = drag.current;
      if (moved.size > 0 && dragging !== null) {
        const lead = [dragging.lead, ...dragging.from.keys()].find((id) => moved.has(id));
        const from = lead === void 0 ? void 0 : dragging.from.get(lead);
        const to = lead === void 0 ? void 0 : moved.get(lead);
        if (from !== void 0 && to !== void 0) {
          setMoves(merged(dragging.pending, dragMoves(dragging.canvas, dragging.from.keys(), from, to, layout)));
        }
      } else if (moved.size > 0) {
        const now = movesRef.current;
        setMoves(merged(now, keyMoves(changed(current(), now), moved, layout)));
        clearTimeout(keyTimer.current);
        keyTimer.current = setTimeout(runKeys, PAUSE);
      }
      if (selecting.length > 0) {
        selects.current.push(...selecting);
        scheduleSelects();
      }
    },
    [centre, current, layout, runKeys, scheduleSelects, setMoves]
  );
  const onEdgesChange = useCallback(
    (changes) => {
      const selecting = changes.toArray().flatMap((change) => change.type === "select" ? [{ id: change.id, selected: change.selected }] : []);
      if (selecting.length === 0) return;
      selects.current.push(...selecting);
      scheduleSelects();
    },
    [scheduleSelects]
  );
  const onConnectEnd = useCallback(
    (event, connection) => {
      if (connection.fromNode === null) return;
      const { fromNode, fromHandle, toNode, toHandle, pointer: pointer2, isValid } = connection;
      if (toNode === null) {
        const dropped2 = canvasDrop(event, drawn.current.nodes, fromNode.id, fromHandle, root.current);
        if (dropped2 !== void 0) {
          void actions.trigger(dropped2.role, dropped2.target, { drop: { client: dropped2.client, canvas: connection.to } });
        }
        return;
      }
      if (toHandle === null || isValid !== true) return;
      const dropped = fromHandle.type === "source" ? { source: fromNode.id, target: toNode.id, targetHandle: toHandle.id ?? "" } : { source: toNode.id, target: fromNode.id, targetHandle: fromHandle.id ?? "" };
      const drop = linkDrop(drawn.current.nodes, dropped);
      if (drop === void 0) return;
      const refuse = (message) => {
        onRefusal({ x: pointer2.x, y: pointer2.y, message });
      };
      if ("taken" in drop) {
        refuse(drop.taken);
        return;
      }
      core.commands.run("blockr.core-add_link", drop.add, "user", {
        notifier: (notifications) => {
          refuse(notifications.map((notification) => notification.message).join("\n"));
        }
      }).catch(() => void 0);
    },
    [actions, core, onRefusal]
  );
  const view = savedView(board.id);
  const fitted2 = useRef2(view !== void 0);
  const hasBlocks = Object.keys(board.blocks).length > 0;
  useEffect2(() => {
    if (fitted2.current || size.width === 0 || size.height === 0) return;
    if (!hasBlocks) {
      fitted2.current = true;
      void flow.setViewport({ x: size.width / 2, y: size.height / 2, zoom: 1 });
    } else if (nodes.length > 0) {
      const fit = fittedView(base, size);
      if (fit === void 0) return;
      fitted2.current = true;
      void flow.setViewport(fit);
    }
  }, [base, flow, hasBlocks, nodes.length, size]);
  useEffect2(
    () => onFit(() => {
      const fit = fittedView(current(), size);
      if (fit !== void 0) void flow.setViewport(fit, { duration: DURATION });
    }),
    [current, flow, size]
  );
  const menuOf = useCallback(
    (event, object2) => {
      event.preventDefault();
      if (object2 === void 0) return;
      actions.menu(menuTarget(object2, core.selection.get()), { x: event.clientX, y: event.clientY });
    },
    [actions, core]
  );
  return /* @__PURE__ */ jsx4(
    ReactFlow,
    {
      ref: root,
      nodes,
      edges,
      nodeTypes: NODE_TYPES,
      edgeTypes: EDGE_TYPES,
      nodeOrigin: ORIGIN,
      defaultViewport: view ?? DEFAULT_VIEW,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      onNodesChange,
      onEdgesChange,
      onNodeDragStart: (_event, node, dragged) => {
        startDrag(node.id, dragged);
      },
      onNodeDragStop: endDrag,
      onSelectionDragStart: (_event, dragged) => {
        startDrag(void 0, dragged);
      },
      onSelectionDragStop: endDrag,
      onNodeClick: (_event, node) => {
        clicked.current = node.id;
        scheduleSelects();
      },
      onNodeDoubleClick: (_event, node) => {
        if (node.data.kind !== "stack" || node.data.shows === "empty") return;
        core.commands.run("blockr.graph-collapse_stack", { stack: node.data.stack, collapsed: node.data.shows === "expanded" }).catch(() => void 0);
      },
      onPaneClick: () => {
        if (core.selection.get().length > 0) core.selection.set([]);
      },
      onNodeContextMenu: (event, node) => {
        menuOf(event, node.data.kind === "block" ? { block: node.data.block } : { stack: node.data.stack });
      },
      onEdgeContextMenu: (event, edge) => {
        menuOf(event, objectOf(edge.id));
      },
      onPaneContextMenu: (event) => {
        event.preventDefault();
        actions.menu({ board: true }, { x: event.clientX, y: event.clientY });
      },
      onSelectionContextMenu: (event) => {
        event.preventDefault();
        const selection2 = core.selection.get();
        if (selection2.length > 0) actions.menu({ selection: selection2 }, { x: event.clientX, y: event.clientY });
      },
      onSelectionStart: () => {
        rectangle.current = "drawing";
      },
      onSelectionEnd: () => {
        rectangle.current = "ended";
        scheduleSelects();
      },
      onConnectEnd,
      onMoveEnd: (_event, moved) => {
        saveView(board.id, moved);
      },
      onBlur: runKeys,
      nodesConnectable: !locked,
      selectNodesOnDrag: false,
      edgesFocusable: false,
      edgesReconnectable: false,
      deleteKeyCode: null
    }
  );
}
var DEFAULT_VIEW = { x: 0, y: 0, zoom: 1 };

// srcts/ui/keys.ts
var OWN_KEYS = "input, textarea, select, [contenteditable]:not([contenteditable='false']), .blockr-graph-panel, .blockr-graph-search";
function keyAction(pressed, selection, text) {
  const { target } = pressed;
  if (target instanceof Element && target.closest(OWN_KEYS) !== null) return void 0;
  if (target instanceof HTMLElement && target.isContentEditable) return void 0;
  const mod = pressed.metaKey || pressed.ctrlKey;
  if (pressed.altKey || pressed.shiftKey) return void 0;
  const chosen = selection.length === 0 ? void 0 : { selection };
  if (pressed.key === "Backspace" && !mod) return chosen === void 0 ? void 0 : { id: "remove_selected_role", target: chosen };
  if (!mod) return void 0;
  switch (pressed.key.toLowerCase()) {
    case "c":
      return text || chosen === void 0 ? void 0 : { id: COPY2, target: chosen };
    case "x":
      return text || chosen === void 0 ? void 0 : { id: CUT, target: chosen };
    case "v":
      return { id: PASTE, target: { board: true } };
    default:
      return void 0;
  }
}

// srcts/ui/panel.tsx
import { Button as Button2, ToggleButton } from "@blockr/core/react";
import { useCallback as useCallback2, useEffect as useEffect3, useLayoutEffect, useMemo as useMemo3, useRef as useRef3, useState as useState2 } from "react";

// srcts/ui/panel-place.ts
var PANEL_WIDTH = 420;
var LEAST_HEIGHT = 400;
var MARGIN = 10;
function hasRoom(frame) {
  return frame.width >= PANEL_WIDTH && frame.height >= LEAST_HEIGHT;
}
function revealPan(object2, height) {
  if (object2.top < MARGIN || object2.height > height - 2 * MARGIN) return MARGIN - object2.top;
  const bottom = object2.top + object2.height;
  return bottom > height - MARGIN ? height - MARGIN - bottom : 0;
}

// srcts/ui/panel.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function usePanel({ core, element, stage, pan }) {
  const [shown, setShown] = useState2(null);
  const shownRef = useRef3(null);
  const [pinned, setPinned] = useState2(false);
  const pinnedRef = useRef3(false);
  const section = useRef3(null);
  const parts = useRef3({ core, element, stage, pan });
  useEffect3(() => {
    parts.current = { core, element, stage, pan };
  }, [core, element, stage, pan]);
  const show = useCallback2((next) => {
    const held = section.current;
    if (next === null && held?.contains(held.ownerDocument.activeElement) === true) {
      parts.current.element()?.focus({ preventScroll: true });
    }
    shownRef.current = next;
    setShown(next);
    if (next === null) {
      pinnedRef.current = false;
      setPinned(false);
    }
  }, []);
  const reveal = useCallback2(() => {
    const current = shownRef.current;
    const { core: api2, element: frameOf, stage: stageOf, pan: by } = parts.current;
    const [frame, canvas] = [frameOf(), stageOf()];
    if (current === null || frame === null || canvas === null || "board" in current.target) return;
    const box = objectBox(frame, api2.store.board(), current.target);
    const y = box === void 0 ? 0 : revealPan(box, canvas.getBoundingClientRect().height);
    if (y !== 0) by({ x: 0, y });
  }, []);
  useLayoutEffect(() => {
    if (shown !== null) reveal();
  }, [shown, reveal]);
  const mountOn = useCallback2(
    (current, target) => {
      show({ ...current, target, mounts: current.mounts + 1, focus: false });
    },
    [show]
  );
  const place = useMemo3(
    () => (args) => {
      show({ args, target: args.target, mounts: (shownRef.current?.mounts ?? 0) + 1, focus: true });
      return (deltas) => {
        const current = shownRef.current;
        if (current?.args !== args) return;
        const { core: api2 } = parts.current;
        if (!pinnedRef.current) {
          show(null);
          return;
        }
        const next = addedTarget(api2, args.id, deltas) ?? current.target;
        if (!holds(api2.store.board(), next)) show(null);
        else mountOn(current, next);
      };
    },
    [mountOn, show]
  );
  const close = useCallback2(() => {
    const current = shownRef.current;
    if (current === null) return;
    current.args.close();
    show(null);
  }, [show]);
  const dismiss = useCallback2(() => {
    if (shownRef.current === null || pinnedRef.current) return false;
    close();
    return true;
  }, [close]);
  useEffect3(
    () => core.selection.subscribe((objects) => {
      const current = shownRef.current;
      const [only] = objects;
      if (current === null || !pinnedRef.current || objects.length !== 1 || only === void 0) return;
      if (sameTarget(only, current.target) || !offers(core, only, current.args.id)) return;
      mountOn(current, only);
    }),
    [core, mountOn]
  );
  const advanced = useCallback2(
    (target) => {
      const el = element();
      const box = el === null ? void 0 : objectBox(el, core.store.board(), target);
      return el !== null && box !== void 0 && hasRoom(el.getBoundingClientRect()) ? place : void 0;
    },
    [core, element, place]
  );
  const view = shown === null ? null : /* @__PURE__ */ jsx5(
    PanelView,
    {
      section,
      shown,
      pinned,
      onPin: (next) => {
        pinnedRef.current = next;
        setPinned(next);
      },
      onClose: close,
      onResize: reveal
    }
  );
  return { advanced, dismiss, view };
}
function PanelView({
  section,
  shown,
  pinned,
  onPin,
  onClose,
  onResize
}) {
  const { args, target, mounts, focus } = shown;
  useLayoutEffect(() => {
    const el = section.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => {
      onResize();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [section, onResize]);
  useEffect3(() => {
    const el = section.current;
    if (!focus || el === null) return;
    const frame = requestAnimationFrame(() => {
      if (!el.contains(el.ownerDocument.activeElement)) el.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [section, focus, mounts]);
  return /* @__PURE__ */ jsxs4(
    "section",
    {
      ref: section,
      className: "blockr-graph-panel",
      "aria-label": args.title,
      tabIndex: -1,
      onKeyDown: (event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        onClose();
      },
      children: [
        /* @__PURE__ */ jsxs4("header", { className: "blockr-graph-panel-header", children: [
          /* @__PURE__ */ jsx5("h2", { className: "blockr-graph-panel-title", children: args.title }),
          /* @__PURE__ */ jsx5(ToggleButton, { className: "blockr-graph-panel-control", "aria-label": "Pin", isSelected: pinned, onChange: onPin, children: /* @__PURE__ */ jsx5("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true", className: "blockr-graph-icon", children: /* @__PURE__ */ jsx5("path", { d: "M6 2.5 H10 M7 2.5 V6.5 L5 9 H11 L9 6.5 V2.5 M8 9 V13.5" }) }) }),
          /* @__PURE__ */ jsx5(Button2, { variant: "quiet", className: "blockr-graph-panel-control", "aria-label": "Close", onPress: onClose, children: /* @__PURE__ */ jsx5("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true", className: "blockr-graph-icon", children: /* @__PURE__ */ jsx5("path", { d: "M4 4 L12 12 M12 4 L4 12" }) }) })
        ] }),
        /* @__PURE__ */ jsx5(PanelBody, { args, target }, mounts)
      ]
    }
  );
}
function PanelBody({ args, target }) {
  const body = useRef3(null);
  useLayoutEffect(() => {
    const el = body.current;
    if (el === null) return;
    const unmount = args.mount(el, target);
    return () => {
      queueMicrotask(unmount);
    };
  }, [args, target]);
  return /* @__PURE__ */ jsx5("div", { ref: body, className: "blockr-graph-panel-body" });
}
function objectBox(el, board, target) {
  const frame = el.getBoundingClientRect();
  const relative = (rects2) => {
    if (rects2.length === 0) return void 0;
    const left = Math.min(...rects2.map((rect) => rect.left));
    const top = Math.min(...rects2.map((rect) => rect.top));
    const right = Math.max(...rects2.map((rect) => rect.right));
    const bottom = Math.max(...rects2.map((rect) => rect.bottom));
    return { left: left - frame.left, top: top - frame.top, width: right - left, height: bottom - top };
  };
  if ("board" in target) {
    const toolbar = el.querySelector(".blockr-graph-toolbar");
    return toolbar === null ? void 0 : relative([toolbar.getBoundingClientRect()]);
  }
  const objects = "selection" in target ? target.selection : ["input" in target ? { block: target.block } : target];
  const stacks = stackOf(board);
  const rects = objects.flatMap((object2) => {
    const drawn = drawnOf(el, object2, stacks);
    return drawn === null ? [] : [drawn.getBoundingClientRect()];
  });
  return relative(rects);
}
function drawnOf(el, object2, stacks) {
  const id = idOf(object2);
  if (id === void 0) return null;
  const found = el.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"], .react-flow__edge[data-id="${CSS.escape(id)}"]`);
  if (found !== null || !("block" in object2)) return found;
  const stack2 = stacks.get(object2.block);
  return stack2 === void 0 ? null : el.querySelector(`.react-flow__node[data-id="${CSS.escape(stackNode2(stack2))}"]`);
}
function addedTarget(core, action, deltas) {
  if (deltas === void 0) return void 0;
  const added = deltas.flatMap((delta) => [
    ...Object.keys(delta.blocks?.add ?? {}).map((block) => ({ block })),
    ...Object.keys(delta.links?.add ?? {}).map((link) => ({ link })),
    ...Object.keys(delta.stacks?.add ?? {}).map((stack2) => ({ stack: stack2 }))
  ]);
  const offered = added.filter((object2) => offers(core, object2, action));
  return offered.length === 1 ? offered[0] : void 0;
}
function offers(core, target, action) {
  return core.boardActions.on(target).some((each) => each.id === action);
}
function holds(board, target) {
  if ("board" in target) return true;
  const objects = "selection" in target ? target.selection : [target];
  return objects.every((object2) => {
    if ("block" in object2) return Object.hasOwn(board.blocks, object2.block);
    if ("link" in object2) return Object.hasOwn(board.links, object2.link);
    if ("stack" in object2) return Object.hasOwn(board.stacks, object2.stack);
    return true;
  });
}
function sameTarget(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// srcts/ui/search.tsx
import { SearchField, Tree, TreeItem, useBoard as useBoard2 } from "@blockr/core/react";
import { useEffect as useEffect4, useMemo as useMemo4, useRef as useRef4, useState as useState3 } from "react";

// srcts/ui/outline.ts
function outlineOf(board) {
  const held = stackOf(board);
  const row = (block) => ({ block, name: board.blocks[block]?.name ?? block, stack: held.get(block) ?? null });
  const stacks = Object.entries(board.stacks).map(([stack2, { name, blocks }]) => ({
    stack: stack2,
    name,
    blocks: linkOrder(board, new Set(blocks.filter((block) => held.get(block) === stack2))).map(row)
  }));
  const loose = linkOrder(board, new Set(Object.keys(board.blocks).filter((block) => !held.has(block)))).map(row);
  return { stacks, loose };
}
function matching(outline, query) {
  const wanted = query.trim().toLowerCase();
  const holds2 = (name, id) => name.toLowerCase().includes(wanted) || id.toLowerCase().includes(wanted);
  const blocks = [...outline.stacks.flatMap((stack2) => stack2.blocks), ...outline.loose];
  return {
    stacks: outline.stacks.filter((stack2) => holds2(stack2.name, stack2.stack)),
    blocks: blocks.filter((block) => holds2(block.name, block.block))
  };
}

// srcts/ui/search.tsx
import { Fragment as Fragment3, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var DURATION2 = 300;
function SearchPanel({ onClose }) {
  const { core, plugin } = useGraph();
  const board = useBoard2(core);
  const flow = useReactFlow();
  const [query, setQuery] = useState3("");
  const outline = useMemo4(() => outlineOf(board), [board]);
  const found = useMemo4(() => matching(outline, query), [outline, query]);
  const [expanded, setExpanded] = useState3(() => {
    const { collapsed } = canvasOf(board, graphState(board, plugin) ?? defaultState);
    return new Set(outline.stacks.filter(({ stack: stack2 }) => !collapsed.has(stack2)).map(({ stack: stack2 }) => stackNode2(stack2)));
  });
  const panel = useRef4(null);
  useEffect4(() => {
    const away = (event) => {
      const target = event.target;
      if (!(target instanceof Node) || panel.current?.contains(target) === true) return;
      if (target instanceof Element && target.closest(".blockr-graph-toolbar") !== null) return;
      onClose();
    };
    document.addEventListener("pointerdown", away, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
    };
  }, [onClose]);
  const pick = async (key) => {
    const object2 = objectOf(key);
    if (object2 === void 0) return;
    onClose();
    const before = core.store.board();
    const stack2 = "block" in object2 ? outline.stacks.find(({ blocks }) => blocks.some(({ block }) => block === object2.block)) : void 0;
    const state = graphState(before, plugin) ?? defaultState;
    if (stack2 !== void 0 && canvasOf(before, state).collapsed.has(stack2.stack)) {
      await core.commands.run("blockr.graph-collapse_stack", { stack: stack2.stack, collapsed: false }).catch(() => void 0);
    }
    const now = core.store.board();
    const centre = centreOf(canvasOf(now, graphState(now, plugin) ?? defaultState), key);
    if (centre !== void 0) await flow.setCenter(centre.x, centre.y, { zoom: flow.getZoom(), duration: DURATION2 });
    const picked = [object2];
    core.selection.set(picked);
    if ("block" in object2) core.show({ block: object2.block }).catch(() => void 0);
  };
  const searching = query.trim() !== "";
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      ref: panel,
      className: "blockr-graph-search",
      role: "dialog",
      "aria-label": "Search blocks",
      onKeyDown: (event) => {
        if (event.key === "Escape") onClose();
      },
      children: [
        /* @__PURE__ */ jsx6(SearchField, { "aria-label": "Search blocks and stacks", placeholder: "Search blocks and stacks", value: query, onChange: setQuery, autoFocus: true }),
        searching ? found.stacks.length + found.blocks.length === 0 ? /* @__PURE__ */ jsx6("p", { className: "blockr-graph-search-none", children: "No block or stack matches." }) : /* @__PURE__ */ jsxs5(Tree, { "aria-label": "Matches", className: "blockr-graph-outline", onAction: (key) => void pick(String(key)), children: [
          found.stacks.map(({ stack: stack2, name, blocks }) => /* @__PURE__ */ jsx6(TreeItem, { id: stackNode2(stack2), title: `${name} (${String(blocks.length)})` }, stackNode2(stack2))),
          found.blocks.map(({ block, name }) => /* @__PURE__ */ jsx6(TreeItem, { id: blockNode2(block), title: name }, blockNode2(block)))
        ] }) : /* @__PURE__ */ jsxs5(Fragment3, { children: [
          /* @__PURE__ */ jsx6("h3", { className: "blockr-graph-search-heading", children: "Board contents" }),
          outline.stacks.length + outline.loose.length === 0 ? /* @__PURE__ */ jsx6("p", { className: "blockr-graph-search-none", children: "The board holds no block." }) : /* @__PURE__ */ jsxs5(
            Tree,
            {
              "aria-label": "Board contents",
              className: "blockr-graph-outline",
              expandedKeys: expanded,
              onExpandedChange: setExpanded,
              onAction: (key) => void pick(String(key)),
              children: [
                outline.stacks.map(({ stack: stack2, name, blocks }) => /* @__PURE__ */ jsx6(TreeItem, { id: stackNode2(stack2), title: `${name} (${String(blocks.length)})`, children: blocks.map(({ block, name: title }) => /* @__PURE__ */ jsx6(TreeItem, { id: blockNode2(block), title }, blockNode2(block))) }, stackNode2(stack2))),
                outline.loose.map(({ block, name }) => /* @__PURE__ */ jsx6(TreeItem, { id: blockNode2(block), title: name }, blockNode2(block)))
              ]
            }
          )
        ] })
      ]
    }
  );
}

// srcts/ui/toolbar.tsx
import { Button as Button3, Menu, MenuItem, MenuTrigger, Separator, Toolbar, Tooltip as Tooltip2, TooltipTrigger as TooltipTrigger2, useBoard as useBoard3 } from "@blockr/core/react";
import { useCallback as useCallback3, useRef as useRef5, useSyncExternalStore as useSyncExternalStore2 } from "react";

// srcts/ui/tools.ts
var BIN = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 9h6.6l.7-9"/></svg>';
var BOARD_TOOLS = [
  {
    kind: "add",
    label: "Add to the board",
    actions: [{ role: "add_block_role" }, { role: "add_link_role" }, { role: "add_stack_role" }]
  },
  { kind: "button", action: { id: PASTE } },
  { kind: "button", action: { id: LAYOUT } }
];
var SELECTION_TOOLS = [
  { kind: "add", label: "Add the selection to a stack", actions: [{ role: "add_stack_role" }, { role: "add_to_stack_role" }] },
  { kind: "button", action: { id: COPY2 } },
  { kind: "button", action: { id: CUT } },
  { kind: "button", action: { role: "remove_selected_role" }, icon: BIN }
];
function shownTools(tools, offered) {
  const find = (listed) => offered.find((action) => "role" in listed ? action.role === listed.role : action.id === listed.id);
  return tools.flatMap((tool) => {
    if (tool.kind === "add") {
      const actions = tool.actions.flatMap((listed) => find(listed) ?? []);
      return actions.length === 0 ? [] : [{ kind: "add", label: tool.label, actions }];
    }
    const action = find(tool.action);
    if (action === void 0) return [];
    return [{ kind: "button", action, icon: action.icon === void 0 || action.icon === "" ? tool.icon ?? "" : action.icon }];
  });
}

// srcts/ui/toolbar.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var DELAY2 = 600;
function Controls({ searching, onSearch, size }) {
  const { core, plugin } = useGraph();
  const board = useBoard3(core);
  const selection = useSyncExternalStore2(
    useCallback3((notify) => core.selection.subscribe(notify), [core]),
    () => core.selection.get()
  );
  const flow = useReactFlow();
  const fit = () => {
    const view = fittedView(canvasOf(board, graphState(board, plugin) ?? defaultState), size);
    if (view !== void 0) void flow.setViewport(view, { duration: DURATION });
  };
  const onBoard = { board: true };
  const onSelection = { selection };
  const boardTools = shownTools(BOARD_TOOLS, core.boardActions.on(onBoard));
  const selectionTools = selection.length === 0 ? [] : shownTools(SELECTION_TOOLS, core.boardActions.on(onSelection));
  return /* @__PURE__ */ jsxs6(Toolbar, { orientation: "vertical", "aria-label": "Workflow tools", className: "blockr-graph-toolbar", children: [
    /* @__PURE__ */ jsxs6(Control, { label: "Search blocks", onPress: onSearch, pressed: searching, children: [
      /* @__PURE__ */ jsx7("path", { d: "M11 11 L14.5 14.5" }),
      /* @__PURE__ */ jsx7("circle", { cx: 7, cy: 7, r: 4.5 })
    ] }),
    /* @__PURE__ */ jsx7(Control, { label: "Zoom in", onPress: () => void flow.zoomIn({ duration: DURATION }), children: /* @__PURE__ */ jsx7("path", { d: "M8 3 V13 M3 8 H13" }) }),
    /* @__PURE__ */ jsx7(Control, { label: "Zoom out", onPress: () => void flow.zoomOut({ duration: DURATION }), children: /* @__PURE__ */ jsx7("path", { d: "M3 8 H13" }) }),
    /* @__PURE__ */ jsx7(Control, { label: "Fit the view", onPress: fit, children: /* @__PURE__ */ jsx7("path", { d: "M2 6 V2 H6 M10 2 H14 V6 M14 10 V14 H10 M6 14 H2 V10" }) }),
    boardTools.length === 0 ? null : /* @__PURE__ */ jsx7(Separator, { orientation: "horizontal", className: "blockr-graph-separator" }),
    boardTools.map((tool) => /* @__PURE__ */ jsx7(ToolView, { tool, target: onBoard }, `board:${keyOf(tool)}`)),
    selectionTools.length === 0 ? null : /* @__PURE__ */ jsx7(Separator, { orientation: "horizontal", className: "blockr-graph-separator" }),
    selectionTools.map((tool) => /* @__PURE__ */ jsx7(ToolView, { tool, target: onSelection }, `selection:${keyOf(tool)}`))
  ] });
}
function Control({ label, onPress, pressed, children }) {
  return /* @__PURE__ */ jsxs6(TooltipTrigger2, { delay: DELAY2, children: [
    /* @__PURE__ */ jsx7(
      Button3,
      {
        variant: "quiet",
        className: "blockr-graph-control",
        "aria-label": label,
        ...pressed === void 0 ? {} : { "aria-expanded": pressed },
        onPress,
        children: /* @__PURE__ */ jsx7("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true", className: "blockr-graph-icon", children })
      }
    ),
    /* @__PURE__ */ jsx7(Tooltip2, { placement: "right", children: label })
  ] });
}
function keyOf(tool) {
  return tool.kind === "add" ? "add" : tool.action.id;
}
function ToolView({ tool, target }) {
  return tool.kind === "add" ? /* @__PURE__ */ jsx7(AddButton, { label: tool.label, actions: tool.actions, target }) : /* @__PURE__ */ jsx7(ActionButton, { action: tool.action, icon: tool.icon, target });
}
function ActionButton({ action, icon, target }) {
  const { actions } = useGraph();
  return /* @__PURE__ */ jsxs6(TooltipTrigger2, { delay: DELAY2, children: [
    /* @__PURE__ */ jsx7(
      Button3,
      {
        variant: "quiet",
        className: "blockr-graph-control",
        "aria-label": action.label,
        onPress: (event) => {
          if (event.target instanceof HTMLElement) void actions.trigger(action.id, target, { button: event.target });
        },
        children: /* @__PURE__ */ jsx7("span", { className: "blockr-graph-action-icon", "aria-hidden": "true", dangerouslySetInnerHTML: { __html: icon } })
      }
    ),
    /* @__PURE__ */ jsx7(Tooltip2, { placement: "right", children: action.label })
  ] });
}
function AddButton({ label, actions, target }) {
  const { actions: graph } = useGraph();
  const button = useRef5(null);
  return /* @__PURE__ */ jsxs6(MenuTrigger, { placement: "right top", children: [
    /* @__PURE__ */ jsxs6(TooltipTrigger2, { delay: DELAY2, children: [
      /* @__PURE__ */ jsx7(Button3, { ref: button, variant: "quiet", className: "blockr-graph-control", "aria-label": label, children: /* @__PURE__ */ jsx7("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true", className: "blockr-graph-icon", children: /* @__PURE__ */ jsx7("path", { d: "M8 3 V13 M3 8 H13" }) }) }),
      /* @__PURE__ */ jsx7(Tooltip2, { placement: "right", children: label })
    ] }),
    /* @__PURE__ */ jsx7(
      Menu,
      {
        "aria-label": label,
        className: "blockr-graph-add-menu",
        onAction: (key) => {
          const picked = actions.find((action) => action.id === key);
          const el = button.current;
          if (picked !== void 0 && el !== null) void graph.trigger(picked.id, target, { button: el });
        },
        children: actions.map((action) => /* @__PURE__ */ jsx7(MenuItem, { id: action.id, children: action.label }, action.id))
      }
    )
  ] });
}

// srcts/ui/graph.tsx
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var REFUSAL = 8e3;
var FOLD = 250;
function noSelection(doc) {
  const refuse = (event) => {
    event.preventDefault();
  };
  const end = () => {
    doc.removeEventListener("selectstart", refuse, true);
    doc.removeEventListener("pointerup", end, true);
    doc.removeEventListener("pointercancel", end, true);
  };
  doc.addEventListener("selectstart", refuse, true);
  doc.addEventListener("pointerup", end, true);
  doc.addEventListener("pointercancel", end, true);
}
function GraphRoot({ core, plugin }) {
  return /* @__PURE__ */ jsx8(ReactFlowProvider, { children: /* @__PURE__ */ jsx8(GraphFrame, { core, plugin }) });
}
function GraphFrame({ core, plugin }) {
  const flow = useReactFlow();
  const [hovered, setHovered] = useState4(null);
  const [spread, setSpread] = useState4(null);
  const fold = useRef6(void 0);
  useEffect5(
    () => () => {
      clearTimeout(fold.current);
    },
    []
  );
  const element = useRef6(null);
  const elementOf = useCallback4(() => element.current, []);
  const stage = useRef6(null);
  const stageOf = useCallback4(() => stage.current, []);
  const [refusal, setRefusal] = useState4(null);
  const refuse = useCallback4((client, message) => {
    const box = element.current?.getBoundingClientRect();
    setRefusal({ x: client.x - (box?.left ?? 0), y: client.y - (box?.top ?? 0), message });
  }, []);
  useEffect5(() => {
    if (refusal === null) return;
    const timer = setTimeout(() => {
      setRefusal(null);
    }, REFUSAL);
    return () => {
      clearTimeout(timer);
    };
  }, [refusal]);
  const pan = useCallback4(
    (by) => {
      const { x, y, zoom } = flow.getViewport();
      void flow.setViewport({ x: x + by.x, y: y + by.y, zoom }, { duration: DURATION });
    },
    [flow]
  );
  const panel = usePanel({ core, element: elementOf, stage: stageOf, pan });
  const actions = useGraphActions({
    core,
    element: elementOf,
    toCanvas: (client) => flow.screenToFlowPosition(client),
    refuse,
    panel: panel.advanced
  });
  const graph = useMemo5(
    () => ({
      core,
      plugin,
      enter: ({ node, side, link, crowded }) => {
        setHovered(link ?? null);
        clearTimeout(fold.current);
        setSpread((was) => !crowded ? was : was?.node === node && was.side === side ? was : { node, side });
      },
      leave: () => {
        setHovered(null);
        clearTimeout(fold.current);
        fold.current = setTimeout(() => {
          setSpread(null);
        }, FOLD);
      },
      actions
    }),
    [actions, core, plugin]
  );
  const board = useBoard4(core);
  const empty = Object.keys(board.blocks).length === 0;
  const [own, setOwn] = useState4(false);
  const [size, setSize] = useState4({ width: 0, height: 0 });
  useLayoutEffect2(() => {
    const [el, canvas] = [element.current, stage.current];
    if (el === null || canvas === null) return;
    let decided = false;
    const measure = () => {
      if (el.getClientRects().length === 0) return;
      if (!decided) {
        decided = true;
        if (el.getBoundingClientRect().height === 0) {
          setOwn(true);
          return;
        }
      }
      const { width, height } = canvas.getBoundingClientRect();
      setSize((was) => was.width === width && was.height === height ? was : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(canvas);
    measure();
    return () => {
      observer.disconnect();
    };
  }, []);
  const [searching, setSearching] = useState4(false);
  const closeSearch = useCallback4(() => {
    setSearching(false);
  }, []);
  return /* @__PURE__ */ jsx8(GraphContext, { value: graph, children: /* @__PURE__ */ jsxs7(
    "div",
    {
      ref: element,
      className: "blockr-graph",
      "data-height": own ? "own" : void 0,
      tabIndex: -1,
      onPointerDown: (event) => {
        setRefusal(null);
        const el = element.current;
        const target = event.target;
        if (el === null || !(target instanceof Element)) return;
        if (target.closest(".react-flow") !== null) noSelection(el.ownerDocument);
        if (target.closest(".react-flow__pane") === null) return;
        const node = target.closest(".react-flow__node");
        (node ?? el).focus({ preventScroll: true });
      },
      onKeyDown: (event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Escape" && panel.dismiss()) {
          event.preventDefault();
          return;
        }
        const text = event.currentTarget.ownerDocument.getSelection()?.toString() ?? "";
        const action = keyAction(event, core.selection.get(), text !== "");
        if (action === void 0) return;
        event.preventDefault();
        void actions.trigger(action.id, action.target, { key: true });
      },
      children: [
        /* @__PURE__ */ jsxs7("div", { ref: stage, className: "blockr-graph-stage", children: [
          /* @__PURE__ */ jsx8(Canvas, { hovered, spread, size, onRefusal: setRefusal }, board.id),
          /* @__PURE__ */ jsxs7("div", { className: "blockr-graph-tools", children: [
            /* @__PURE__ */ jsx8(
              Controls,
              {
                size,
                searching,
                onSearch: () => {
                  setSearching((open) => !open);
                }
              }
            ),
            searching ? /* @__PURE__ */ jsx8(SearchPanel, { onClose: closeSearch }) : null
          ] }),
          empty ? /* @__PURE__ */ jsx8("p", { className: "blockr-graph-empty", children: core.lock.board ? "No blocks yet." : "No blocks yet. Right-click to add one." }) : null,
          refusal === null ? null : /* @__PURE__ */ jsx8("div", { className: "blockr-graph-refusal", role: "alert", style: { left: refusal.x, top: refusal.y }, children: refusal.message })
        ] }),
        panel.view
      ]
    }
  ) });
}

// srcts/ui/module.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
var ui = {
  render({ el, core, plugin }) {
    const root = createRoot(el);
    flushSync(() => {
      root.render(/* @__PURE__ */ jsx9(GraphRoot, { core, plugin }));
    });
    return () => {
      root.unmount();
    };
  }
};

// srcts/modules/graph/index.ts
var api = 1;
var graph_default = {
  state: { schema: graph_schema_default, default: defaultState },
  update,
  afterStep,
  start,
  commands: graphCommands,
  boardActions: graphBoardActions,
  ui
};
export {
  api,
  graph_default as default
};
