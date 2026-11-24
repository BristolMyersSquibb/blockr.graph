library(blockr.core)
library(blockr.graph)

# A board with a stack of three blocks and a stack that holds no block, which
# the DAG draws under core's basic frontend, the one plugin beside it.
# The blocks start where the DAG's state puts them, from top to bottom: a
# chain of iris, head and bound on the left, and the stack Joins on the right,
# whose block joined merges bod and cw.
# The class's start places the stack Spare, which holds no block.

# The app runs core's basic frontend and the DAG, and no other plugin.
plugins <- available_plugins()
plugins <- plugins[plugins$id %in% c("basic_frontend_plugin", "graph_plugin"), ]

serve(
  new_board(
    blocks = c(
      iris = new_dataset_block("iris"),
      head = new_head_block(n = 10L),
      bound = new_rbind_block(),
      bod = new_dataset_block("BOD"),
      cw = new_dataset_block("ChickWeight"),
      joined = new_merge_block("Time")
    ),
    links = c(
      new_link("iris", "head", "data"),
      new_link("head", "bound", ""),
      new_link("bod", "joined", "x"),
      new_link("cw", "joined", "y")
    ),
    stacks = c(
      joins = new_stack(
        c("bod", "cw", "joined"),
        name = "Joins",
        color = "#66c2a5"
      ),
      spare = new_stack(name = "Spare")
    ),
    plugins = list(
      new_graph_plugin(
        positions = list(
          iris = list(x = 0, y = 0),
          head = list(x = 0, y = 150),
          bound = list(x = 0, y = 300),
          bod = list(x = 300, y = 0),
          cw = list(x = 450, y = 0),
          joined = list(x = 375, y = 150)
        )
      )
    ),
    id = "stacks"
  ),
  plugins = plugins
)
