library(blockr.core)
library(blockr.dock)
library(blockr.graph)

# Two linked blocks, which the DAG draws where its state puts them.
# A block's position is a point on the canvas, by the block's id, in pixels,
# with x to the right and y downwards.
# The one view of the dock shows the DAG beside the panels of the blocks.
positions <- list(
  a = list(x = 200, y = 150),
  b = list(x = 200, y = 350)
)

serve(
  new_board(
    blocks = c(
      a = new_dataset_block("iris"),
      b = new_head_block()
    ),
    links = list(from = "a", to = "b", input = "data"),
    plugins = list(
      new_dock_plugin(
        views = list(main = dock_view(dock_grid(plg("dag"), panels("a", "b"))))
      ),
      dag = new_graph_plugin(positions = positions)
    )
  )
)
