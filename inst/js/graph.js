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
      description: "Where each block sits on the canvas, by the block's id: the centre of the block's mark. The canvas is no panel or view of the frontend. Set only the blocks to move: every other block keeps its position. Laying the board out again moves every block, so run blockr.graph-relayout before placing blocks by hand."
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
  return { x: point.x, y: point.y - MARK / 2 + BLOCK_HEIGHT / 2, w: blockWidth(name), h: BLOCK_HEIGHT };
}
function blockPoint(box) {
  return { x: box.x, y: box.y - BLOCK_HEIGHT / 2 + MARK / 2 };
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
  if (node.kind === "block") return { positions: { [node.id]: blockPoint(box) }, points: {} };
  if (!canvas.collapsed.has(node.id)) return { positions: {}, points: { [node.id]: { x: box.x, y: box.y } } };
  const [dx, dy] = [box.x - node.box.x, box.y - node.box.y];
  const positions = {};
  for (const block of canvas.board.stacks[node.id]?.blocks ?? []) {
    const point = canvas.positions[block];
    if (point !== void 0) positions[block] = { x: point.x + dx, y: point.y + dy };
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
    positions[id] = { x: node.x ?? 0, y: (node.y ?? 0) - node.height / 2 + MARK / 2 };
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
      const kept = {
        positions: Object.fromEntries(Object.entries(changes.positions).filter(([id]) => Object.hasOwn(board.blocks, id))),
        points: Object.fromEntries(Object.entries(changes.points).filter(([id]) => board.stacks[id]?.blocks.length === 0))
      };
      const snapped = snapChanges(canvasOf(board, state), kept, layout);
      return { patches: [...changePatches(state, snapped, GRAPH), ...settingPatches(state, { direction, spacing }), ...emptied(state)] };
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
    description: "Moves blocks, and stacks that hold no block, to the positions given, as a drag on the canvas does. A block's position is the centre of its mark. A stack that holds blocks has no position of its own, since its box fits its blocks, so move its blocks instead. A position given for a block that the same batch adds is where the DAG starts to place it, after the command that adds it. Every block and stack left out stays where it is.",
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
  const kept = (axis, i, j) => constraints[axis].get(key(axis, i, j)) ?? -Infinity;
  const keep = (axis, i, j, sep) => {
    constraints[axis].set(key(axis, i, j), Math.max(kept(axis, i, j), sep));
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
      if (kept(axis, i, j) >= sep - SLACK) continue;
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
        if (kept(axis, i, j) >= sep - SLACK) continue;
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

// srcts/placement/beside.ts
var RINGS = 40;
function beside(canvas, added, gap) {
  const nodes = canvasNodes(canvas);
  const isAdded = (node) => (node.kind === "block" ? added.blocks : added.stacks).has(node.id);
  const group = nodes.filter(isAdded);
  const others = nodes.filter((node) => !isAdded(node)).map((node) => node.box);
  const stacks = stackBoxes(canvas, nodes, isAdded);
  const fits = (dx, dy) => group.every((node) => {
    const box = shifted(node.box, dx, dy);
    return others.every((other) => !overlaps(box, other, gap)) && stacks.every(([stack2, other]) => stack2 === node.stack || !overlaps(box, other, gap));
  });
  for (const [dx, dy] of rings(gap)) {
    if (!fits(dx, dy)) continue;
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

// srcts/placement/ways.ts
function axisOf(direction) {
  return direction === "TB" ? "y" : "x";
}
function wayOf(canvas, links, direction, gap) {
  const main = axisOf(direction);
  const offsets = links.flatMap((link) => {
    const [from, to] = [canvas.positions[link.from], canvas.positions[link.to]];
    const [a, b] = [boxOfBlock(canvas, link.from), boxOfBlock(canvas, link.to)];
    if (from === void 0 || to === void 0 || a === void 0 || b === void 0) return [];
    const rank = (main === "y" ? a.h + b.h : a.w + b.w) / 2 + gap;
    return [{ x: to.x - from.x, y: to.y - from.y, rank }];
  });
  if (offsets.length === 0) return { axis: main, sign: 1 };
  const mean = (of) => offsets.reduce((sum, offset) => sum + of(offset), 0) / offsets.length;
  const along = { x: mean((offset) => offset.x), y: mean((offset) => offset.y) };
  const axis = Math.abs(along[main]) < mean((offset) => offset.rank) / 2 ? main === "y" ? "x" : "y" : main;
  return { axis, sign: along[axis] < 0 ? -1 : 1 };
}

// srcts/placement/start.ts
function blockShape(name) {
  return { w: blockWidth(name), h: BLOCK_HEIGHT, point: blockPoint, box: (point) => blockBox(point, name) };
}
var STACK_SHAPE = {
  w: STACK_WIDTH,
  h: STACK_HEIGHT,
  point: (box) => ({ x: box.x, y: box.y }),
  box: stackBoxAt
};
function startPoints(canvas, added, layout) {
  const gap = gapOf(layout.spacing);
  const positions = {};
  const points2 = {};
  let current = canvas;
  const placed = [];
  for (const block of added.blocks) {
    const box = boxOfBlock(canvas, block);
    if (box !== void 0) placed.push(box);
  }
  for (const stack2 of added.stacks) {
    const point = canvas.points[stack2];
    if (point !== void 0) placed.push(stackBoxAt(point));
  }
  const start2 = (shape, box) => {
    const free = offPlaced(box, placed, layout.direction, gap);
    placed.push(free);
    return shape.point(free);
  };
  for (const block of linkOrder(canvas.board, added.blocks)) {
    if (canvas.positions[block] !== void 0) continue;
    const shape = blockShape(canvas.board.blocks[block]?.name ?? "");
    const point = start2(shape, startBox(current, block, shape, layout, gap));
    positions[block] = point;
    current = changed(current, { positions: { [block]: point }, points: {} });
  }
  for (const stack2 of Object.keys(canvas.board.stacks)) {
    if (!added.stacks.has(stack2) || canvas.points[stack2] !== void 0) continue;
    const point = start2(STACK_SHAPE, firstRank(current, STACK_SHAPE, layout, gap));
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
  if (a === void 0 || b === void 0) return shape.box({ x: 0, y: 0 });
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: shape.w, h: shape.h };
}
function pastLast(canvas, blocks, way, shape, gap) {
  const boxes = unique(blocks).flatMap((block) => boxOfBlock(canvas, block) ?? []);
  if (way.axis === "y") {
    const last2 = lastBy(boxes, (box) => box.x + box.w / 2);
    return { x: last2.x + last2.w / 2 + gap + shape.w / 2, y: last2.y, w: shape.w, h: shape.h };
  }
  const last = lastBy(boxes, (box) => box.y + box.h / 2);
  return { x: last.x, y: last.y + last.h / 2 + gap + shape.h / 2, w: shape.w, h: shape.h };
}
function rankPast(canvas, blocks, way, against, shape, gap) {
  const span = bounds(blocks.flatMap((block) => boxOfBlock(canvas, block) ?? [])) ?? shape.box({ x: 0, y: 0 });
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
  if (first === void 0) return shape.box({ x: 0, y: 0 });
  if (layout.direction === "TB") {
    const top = Math.min(...boxes.map((box) => box.y));
    const last2 = lastBy(boxes.filter((box) => box.y - top < gap / 2), (box) => box.x + box.w / 2);
    return { x: last2.x + last2.w / 2 + gap + shape.w / 2, y: top, w: shape.w, h: shape.h };
  }
  const left = Math.min(...boxes.map((box) => box.x));
  const last = lastBy(boxes.filter((box) => box.x - left < gap / 2), (box) => box.y + box.h / 2);
  return { x: left, y: last.y + last.h / 2 + gap + shape.h / 2, w: shape.w, h: shape.h };
}
function offPlaced(box, placed, direction, gap) {
  let moved = box;
  for (let tries = 0; tries <= placed.length; tries++) {
    const hit = placed.find((other) => overlaps(moved, other, gap));
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
  let last;
  for (const box of boxes) if (last === void 0 || measure(box) > measure(last)) last = box;
  return last ?? { x: 0, y: 0, w: 0, h: 0 };
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
  const placed = added.blocks.size + added.stacks.size === 0 ? { positions: {}, points: {} } : placeAdded(canvasOf(board, state), added, moved, state.layout);
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
    ...changePatches(state, placed, plugin),
    ...unmovedPatches(
      state,
      pushed(Object.keys(placed.positions), added.blocks),
      pushed(Object.keys(placed.points), added.stacks),
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
  const { kept, patches, dropped } = fitted(board, state, plugin);
  const canvas = canvasOf(board, kept);
  const lacking = {
    blocks: new Set(Object.keys(board.blocks).filter((block) => kept.positions[block] === void 0)),
    stacks: new Set(
      Object.entries(board.stacks).filter(([id, stack2]) => stack2.blocks.length === 0 && canvas.points[id] === void 0).map(([id]) => id)
    )
  };
  if (lacking.blocks.size + lacking.stacks.size === 0) return { patches, dropped };
  const none = Object.keys(kept.positions).length === 0 && Object.keys(canvas.points).length === 0;
  if (none && dagre === void 0) return "layout";
  const changes = none && dagre !== void 0 ? snapChanges(canvas, layOut(dagre, canvas, kept.layout), kept.layout) : placeAdded(canvas, lacking, /* @__PURE__ */ new Set(), kept.layout, "beside");
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
      const moved = (part, holds, kind) => Object.fromEntries(
        Object.entries(entry.moved[part]).filter(([other]) => {
          if (holds(other)) return true;
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

// srcts/modules/graph/index.ts
var api = 1;
var graph_default = {
  state: { schema: graph_schema_default, default: defaultState },
  update,
  afterStep,
  start,
  commands: graphCommands
};
export {
  api,
  graph_default as default
};
