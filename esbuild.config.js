#!/usr/bin/env node

import esbuildServe from "esbuild-serve";
import serve from "create-serve";
import chokidar from "chokidar";

esbuildServe(
  {
    logLevel: "info",
    entryPoints: ["controllers/application.ts"],
    bundle: true,
    sourcemap: true,
    outfile: "build/application.js",
  },
  {
    root: ".",
    port: 2020,
  }
);

chokidar.watch(["index.html", "build"]).on("change", () => {
  serve.update();
});
