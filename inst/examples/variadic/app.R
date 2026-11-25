library(blockr.core)
library(blockr.dock)
library(blockr.graph)

# Nine blocks in two stacks, where the rbind blocks e and g each bind two
# results, through a link to each of their inputs 1 and 2.
# The board gives the DAG no positions, so the DAG lays the whole board out as
# it opens.
# The one view of the dock shows the DAG beside the panels of the blocks.
serve(
  new_board(
    blocks = c(
      a = new_dataset_block("iris"),
      b = new_head_block(n = 10),
      c = new_subset_block(),
      d = new_head_block(n = 5),
      e = new_rbind_block(),
      f = new_subset_block(),
      g = new_rbind_block(),
      h = new_head_block(n = 3),
      i = new_scatter_block(x = "Sepal.Length", y = "Sepal.Width")
    ),
    links = c(
      new_link(from = "a", to = "b", input = "data"),
      new_link(from = "b", to = "c", input = "data"),
      new_link(from = "c", to = "d", input = "data"),
      new_link(from = "b", to = "f", input = "data"),
      new_link(from = "d", to = "e", input = "1"),
      new_link(from = "f", to = "e", input = "2"),
      new_link(from = "e", to = "g", input = "1"),
      new_link(from = "f", to = "g", input = "2"),
      new_link(from = "g", to = "h", input = "data"),
      new_link(from = "h", to = "i", input = "data")
    ),
    stacks = c(
      stack1 = new_stack(c("b", "c", "d")),
      stack2 = new_stack(c("f", "g"))
    ),
    plugins = list(
      new_dock_plugin(
        views = list(
          main = dock_view(
            dock_grid(
              plg("dag"),
              panels("a", "b", "c", "d", "e", "f", "g", "h", "i"),
              sizes = c(0.6, 0.4)
            )
          )
        )
      ),
      dag = new_graph_plugin()
    )
  )
)
