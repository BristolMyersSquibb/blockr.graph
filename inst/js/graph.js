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
      description: "Where each block sits on the canvas, by the block's id. The canvas is no panel or view of the frontend. Set only the blocks to move: every other block keeps its position. Laying the board out again moves every block, so run blockr.graph-relayout before placing blocks by hand."
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

// srcts/state/state.ts
var defaultState = {
  positions: {},
  stacks: {},
  layout: { direction: "TB", spacing: "normal", placement: "repulsion", snap: false, snap_size: 20 }
};

// srcts/modules/graph/index.ts
var api = 1;
var graph_default = {
  state: { schema: graph_schema_default, default: defaultState }
};
export {
  api,
  graph_default as default
};
