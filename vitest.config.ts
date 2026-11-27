import { defineConfig } from "vitest/config";

// The tests run on happy-dom. They import blockr.core's CoreApi for tests
// from @blockr/core, which `npm test` installs first, and React from the
// package's own node_modules.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["srcts/**/*.test.{ts,tsx}"],
    // A test fails where it prints an error or a warning that it does not set
    // off on purpose, through blockr.ui's setup.
    setupFiles: ["@blockr/ui/stubs/setup"],
    // The typescript job of blockr.ci uploads coverage/lcov.info to Codecov.
    // The lcov reporter writes that file, and an HTML report beside it in
    // coverage/lcov-report.
    // Istanbul measures the coverage, as it does in blockr.core.
    // Istanbul counts the code of the sources in srcts alone.
    // V8 counts all the code that runs, that of node_modules included.
    // That makes the tests slower under V8.
    // The coverage counts every source under srcts/, so that a file that no
    // test imports counts as uncovered.
    // Vitest leaves out the test files by itself.
    // The `exclude` option leaves out the build, which runs in Node as
    // `npm run build`. The typescript job of blockr.ci runs it and fails where
    // it leaves inst/ other than committed.
    coverage: {
      enabled: true,
      provider: "istanbul",
      reporter: ["text", "lcov"],
      include: ["srcts/**/*.{ts,tsx}"],
      exclude: ["srcts/build/**"],
    },
  },
});
