#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "..", "dist");

const subcommand = process.argv[2];
const entry = subcommand === "hook" ? "hook.js" : "cli.js";

await import(pathToFileURL(resolve(distDir, entry)).href);
