test_that("the default layout runs from top to bottom with normal gaps", {

  expect_identical(
    graph_layout(),
    structure(
      list(
        direction = "TB",
        spacing = "normal",
        placement = "repulsion",
        snap = FALSE,
        snap_size = 20
      ),
      class = "graph_layout"
    )
  )
})

test_that("the layout holds each setting given", {

  layout <- graph_layout(
    direction = "LR",
    spacing = "loose",
    placement = "beside",
    snap = TRUE,
    snap_size = 25L
  )

  expect_identical(
    unclass(layout),
    list(
      direction = "LR",
      spacing = "loose",
      placement = "beside",
      snap = TRUE,
      snap_size = 25L
    )
  )
})

test_that("the layout refuses a direction, spacing or placement it lacks", {

  expect_error(graph_layout(direction = "BT"))
  expect_error(graph_layout(spacing = "tight"))
  expect_error(graph_layout(placement = "grid"))
})

test_that("the layout refuses snapping that is no flag", {

  for (snap in list(NA, "yes", c(TRUE, FALSE), 1)) {
    expect_error(graph_layout(snap = snap), class = "graph_layout_invalid")
  }
})

test_that("the layout refuses a snap size that is no number above 0", {

  for (size in list(0, -5, NA_real_, Inf, "20", c(10, 20))) {
    expect_error(
      graph_layout(snap_size = size),
      class = "graph_layout_invalid"
    )
  }
})
