// @ts-check
const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

/** @type {import("child_process").ChildProcess | null} */
let serverProcess = null;

const SERVER_PORT = 8765;
const WEB_DEV_URL = "http://localhost:5173";

// ---------------------------------------------------------------------------
// Paths — dev vs packaged
// ---------------------------------------------------------------------------

function getPaths() {
  if (app.isPackaged) {
    // electron-builder copies extraResources into process.resourcesPath
    const serverDir = path.join(process.resourcesPath, "server");
    const webDir = path.join(process.resourcesPath, "web");
    const python =
      process.platform === "win32"
        ? path.join(serverDir, ".venv", "Scripts", "python.exe")
        : path.join(serverDir, ".venv", "bin", "python");
    return { serverDir, webDir, python };
  }

  // Dev mode — use sibling apps
  const serverDir = path.resolve(__dirname, "../../server");
  const webDir = null; // use Vite dev server instead
  return { serverDir, webDir, python: "uv" };
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

function startServer() {
  const { serverDir, python } = getPaths();

  // In dev: `uv run python -m labelit_server.main`
  // In prod: `.venv/Scripts/python -m labelit_server.main`
  const cmd = python;
  const args = app.isPackaged
    ? ["-m", "labelit_server.main"]
    : ["run", "python", "-m", "labelit_server.main"];

  console.log(`[server] Starting: ${cmd} ${args.join(" ")}`);
  console.log(`[server] cwd: ${serverDir}`);

  serverProcess = spawn(cmd, args, {
    cwd: serverDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  serverProcess.stdout?.on("data", (data) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on("data", (data) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  serverProcess.on("error", (err) => {
    console.error("[server] Failed to start:", err.message);
  });

  serverProcess.on("exit", (code) => {
    console.log(`[server] Exited with code ${code}`);
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    // On Windows, child_process.kill() sends SIGTERM which doesn't work
    // for Python subprocesses. Use taskkill for a clean shutdown.
    if (process.platform === "win32") {
      try {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], {
          stdio: "ignore",
        });
      } catch {
        serverProcess.kill();
      }
    } else {
      serverProcess.kill("SIGTERM");
    }
    serverProcess = null;
  }
}

// ---------------------------------------------------------------------------
// Wait for server to be ready
// ---------------------------------------------------------------------------

function waitForPort(port, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tryConnect() {
      const socket = new net.Socket();

      socket.once("connect", () => {
        socket.destroy();
        resolve(undefined);
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Server did not start within ${timeout}ms`));
        } else {
          setTimeout(tryConnect, 200);
        }
      });

      socket.connect(port, "127.0.0.1");
    }

    tryConnect();
  });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Labelit",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (!app.isPackaged) {
    // Dev: connect to Vite dev server
    await win.loadURL(WEB_DEV_URL);
    win.webContents.openDevTools({ mode: "right" });
  } else {
    // Prod: load from bundled web assets in resources
    const { webDir } = getPaths();
    await win.loadFile(path.join(webDir, "index.html"));
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  startServer();

  try {
    await waitForPort(SERVER_PORT);
    console.log("[desktop] Server is ready on port", SERVER_PORT);
  } catch (err) {
    console.error("[desktop] Server failed to start:", err);
  }

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopServer();
});
