# End-to-end tests of the examples that blockr.graph ports from blockr.dag,
# through shinytest2.
# Each example is blockr.dag's script, changed as the migration notes say,
# with a view of the dock that shows the DAG beside the panels of the blocks.
# So each test opens the example's app, which the dock draws, and checks that
# the DAG draws what the script gives.

test_that("the example graph opens with its blocks at their positions", {

  skip_if_not_installed("blockr.dock")

  app <- local_example_app("graph")
  wait_for_dag(app)

  expect_identical(app_nodes(app), c("b:a", "b:b"))
  expect_equal(app_position(app, "a"), c(x = 200, y = 150))
  expect_equal(app_position(app, "b"), c(x = 200, y = 350))
})

test_that("the example variadic opens laid out, with its stacks and links", {

  skip_if_not_installed("blockr.dock")

  app <- local_example_app("variadic")
  wait_for_dag(app)

  expect_identical(
    app_nodes(app),
    c(paste0("b:", letters[1:9]), "s:stack1", "s:stack2")
  )

  # The script gives no positions, so the DAG lays the whole board out as it
  # opens, and every block gets a position.
  expect_setequal(names(app_dag(app)[["positions"]]), letters[1:9])

  # Each rbind block binds two results.
  links <- app_links(app)
  expect_identical(nrow(links), 10L)
  expect_identical(sum(links$to == "e"), 2L)
  expect_identical(sum(links$to == "g"), 2L)
})

test_that("the example empty opens with the DAG's line for an empty board", {

  skip_if_not_installed("blockr.dock")

  app <- local_example_app("empty")

  app$wait_for_js(
    "document.querySelector('.blockr-graph-empty') !== null",
    timeout = 30 * 1000
  )

  expect_identical(
    app$get_js("document.querySelector('.blockr-graph-empty').textContent"),
    "No blocks yet. Right-click to add one."
  )
  expect_length(app_blocks(app), 0L)
})
