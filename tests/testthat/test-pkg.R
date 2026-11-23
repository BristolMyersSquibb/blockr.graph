# A placeholder, since testthat stops on a suite without a test file.
# The first tests of the package's code take its place.
test_that("the package loads", {
  expect_true(isNamespaceLoaded("blockr.graph"))
})
