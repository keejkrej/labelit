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
run("npx turbo run build --filter=@labelit/web --force");

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

// Copy cellpose package into the bundle
console.log("  Copying cellpose workspace member...");
const cellposeSrc = path.join(ROOT, "cellpose");
const cellposeBundle = path.join(serverBundle, "cellpose");
// Skip unnecessary folders
copyDirSync(cellposeSrc, cellposeBundle, new Set(["__pycache__", ".ruff_cache", ".pytest_cache", ".git", "models", "docs", "tests", "dist"]));

// Replace dependencies in bundled cellpose's pyproject.toml with core deps only
const cellposeTomlPath = path.join(cellposeBundle, "pyproject.toml");
if (fs.existsSync(cellposeTomlPath)) {
  let cellposeToml = fs.readFileSync(cellposeTomlPath, "utf-8");
  const coreDeps = `dependencies = [
    "numpy",
    "scipy",
    "natsort",
    "tifffile",
    "tqdm",
    "torch",
    "torchvision",
    "opencv-python-headless",
    "fastremap",
    "imagecodecs",
    "roifile",
    "fill-voids",
    "segment_anything"
]`;
  // Match dependencies = [...] and replace it entirely
  cellposeToml = cellposeToml.replace(/dependencies\s*=\s*\[[\s\S]*?\]/, coreDeps);
  fs.writeFileSync(cellposeTomlPath, cellposeToml);
}

// Copy and rewrite pyproject.toml so uv sync can find the local cellpose
console.log("  Rewriting pyproject.toml to use local cellpose...");
const serverTomlPath = path.join(serverBundle, "pyproject.toml");
let serverToml = fs.readFileSync(path.join(SERVER_SRC, "pyproject.toml"), "utf-8");
serverToml = serverToml.replace(
  'cellpose = { workspace = true }',
  'cellpose = { path = "./cellpose" }'
);
fs.writeFileSync(serverTomlPath, serverToml);

// Copy .python-version so uv uses the right interpreter
const pyVersionFile = path.join(ROOT, ".python-version");
if (fs.existsSync(pyVersionFile)) {
  fs.copyFileSync(pyVersionFile, path.join(serverBundle, ".python-version"));
}

// Create venv + install deps in one shot
run(`uv sync`, serverBundle);

console.log("  ✓ Server + .venv → bundle/server\n");
console.log("✅ Bundle ready.\n");
