library(blockr.core)
library(blockr.graph)

# The blockr option `locked` turns on the board lock, which fixes the board's
# blocks, links and stacks.
# The DAG draws no link from a drag there, and drops no block into a stack,
# while a reader still moves blocks, selects them, searches the board and
# collapses its stack.

options(blockr.locked = TRUE)

# The app runs core's basic frontend and the DAG, and no other plugin.
plugins <- available_plugins()
plugins <- plugins[plugins$id %in% c("basic_frontend_plugin", "graph_plugin"), ]

serve(
  new_board(
    blocks = c(
      iris = new_dataset_block("iris"),
      head = new_head_block(n = 10L),
      bod = new_dataset_block("BOD"),
      cw = new_dataset_block("ChickWeight"),
      joined = new_merge_block("Time")
    ),
    links = c(
      new_link("iris", "head", "data"),
      new_link("bod", "joined", "x")
    ),
    stacks = c(
      joins = new_stack(c("bod", "cw", "joined"), name = "Joins")
    ),
    plugins = list(
      new_graph_plugin(
        positions = list(
          iris = list(x = 0, y = 0),
          head = list(x = 0, y = 150),
          bod = list(x = 300, y = 0),
          cw = list(x = 450, y = 0),
          joined = list(x = 375, y = 150)
        )
      )
    ),
    id = "locked"
  ),
  plugins = plugins
)
