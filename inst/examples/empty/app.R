library(blockr.core)
library(blockr.dock)
library(blockr.graph)

# An empty board, whose one view in the dock shows the DAG.
# The DAG says that the board holds no blocks yet.
# A right click on its canvas opens core's menu of the board, whose Add block
# adds a block where the user clicked.
serve(
  new_board(
    plugins = list(
      new_dock_plugin(views = list(main = dock_view(dock_grid(plg("dag"))))),
      dag = new_graph_plugin()
    ),
    id = "board"
  )
)
