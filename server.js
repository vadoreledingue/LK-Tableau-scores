"use strict";

const { start } = require("./src/server");

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
