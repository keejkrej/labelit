/**
 * Prepare the bundle/ directory for electron-builder.
 *
 * bundle/
 *   server/          — Python source + .venv (interpreter + deps)
 *   web/             — Vite production build
 *
 * Run automatically via prebuild / predist npm hooks.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const DESKTOP = path.resolve(__dirname, "..");
const BUNDLE = path.join(DESKTOP, "bundle");
const SERVER_SRC = path.join(ROOT, "apps/server");
const WEB_SRC = path.join(ROOT, "apps/web");

function run(cmd, cwd = ROOT) {
  console.log(`  > ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function copyDirSync(src, dest, skip = new Set(["__pycache__", ".ruff_cache", ".pytest_cache"])) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (skip.has(entry.name)) continue;
      copyDirSync(srcPath, destPath, skip);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── Clean ──────────────────────────────────────────────────────────────────
console.log("\n📦 Preparing desktop bundle...\n");

if (fs.existsSync(BUNDLE)) {
  fs.rmSync(BUNDLE, { recursive: true, force: true });
}
fs.mkdirSync(BUNDLE, { recursive: true });

// ── 1. Build web ───────────────────────────────────────────────────────────
console.log("⚡ Building web app...");
run("pnpm --filter @labelit/web build");

const webDist = path.join(WEB_SRC, "dist");
if (!fs.existsSync(webDist)) {
  throw new Error("Web build output not found at " + webDist);
}
copyDirSync(webDist, path.join(BUNDLE, "web"), new Set());
console.log("  ✓ Web assets → bundle/web\n");

// ── 2. Bundle server ──────────────────────────────────────────────────────
console.log("🐍 Preparing server bundle...");

const serverBundle = path.join(BUNDLE, "server");
fs.mkdirSync(serverBundle, { recursive: true });

// Copy server Python source
copyDirSync(path.join(SERVER_SRC, "labelit_server"), path.join(serverBundle, "labelit_server"));

// Copy pyproject.toml so uv sync can create the venv with deps
fs.copyFileSync(
  path.join(SERVER_SRC, "pyproject.toml"),
  path.join(serverBundle, "pyproject.toml")
);

// Copy .python-version so uv uses the right interpreter
const pyVersionFile = path.join(ROOT, ".python-version");
if (fs.existsSync(pyVersionFile)) {
  fs.copyFileSync(pyVersionFile, path.join(serverBundle, ".python-version"));
}

// Create venv + install deps in one shot
run(`uv sync`, serverBundle);

console.log("  ✓ Server + .venv → bundle/server\n");
console.log("✅ Bundle ready.\n");
