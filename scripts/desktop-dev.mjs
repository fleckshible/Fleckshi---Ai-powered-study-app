import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const DEV_PORT = 5173;
const DEV_URL = `http://localhost:${DEV_PORT}/`;
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronBin = path.resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
      } else {
        setTimeout(probe, 250);
      }
    };
    probe();
  });
}

const viteProc = spawn(npmCmd, ['run', 'dev', '--', '--port', String(DEV_PORT), '--strictPort'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

let electronProc = null;
const shutdown = (code = 0) => {
  try { electronProc?.kill(); } catch {}
  try { viteProc?.kill(); } catch {}
  process.exit(code);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
  await waitForServer(DEV_URL);
  electronProc = spawn(electronBin, ['.'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ELECTRON_START_URL: DEV_URL }
  });
  electronProc.on('exit', (code) => shutdown(code ?? 0));
} catch (err) {
  console.error(err);
  shutdown(1);
}
