#!/usr/bin/env node
/**
 * Script `prepare` do npm. Roda automaticamente em tres cenarios:
 *
 *   1. `npm install` na pasta do projeto (clone classico)
 *   2. `npm install -g github:user/repo` (instalacao direto do GitHub)
 *   3. Antes de `npm publish`
 *
 * Comportamento: faz build (tsup) apenas se `dist/` ainda nao existir.
 * Isso evita rebuilds desnecessarios em dev (onde voce ja tem `dist/`)
 * e garante que instalacoes vindas do GitHub gerem o bundle (ja que o
 * `dist/` esta no `.gitignore`).
 *
 * Para evitar dependencia do `npm.cmd` ou shell, chamamos o tsup
 * diretamente via Node + caminho resolvido pelo Node module loader.
 *
 * Falha silenciosa: se o build der erro, registra mas nao quebra o
 * `npm install` inteiro.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distCli = resolve(projectRoot, "dist", "cli.js");

if (existsSync(distCli)) {
  process.exit(0);
}

if (process.env.CI === "true" || process.env.RINGLY_SKIP_PREPARE === "1") {
  process.exit(0);
}

const require = createRequire(import.meta.url);
let tsupBin;
try {
  const pkgPath = require.resolve("tsup/package.json");
  const pkgDir = dirname(pkgPath);
  const pkg = require("tsup/package.json");
  const binSpec = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.tsup;
  if (!binSpec) {
    console.error("[ringly:prepare] tsup package has no `bin` entry");
    process.exit(0);
  }
  tsupBin = resolve(pkgDir, binSpec);
} catch (err) {
  console.error("[ringly:prepare] tsup not installed; skipping build:", err?.message ?? err);
  process.exit(0);
}

const result = spawnSync(process.execPath, [tsupBin], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("[ringly:prepare] build failed with status:", result.status);
}

process.exit(0);
