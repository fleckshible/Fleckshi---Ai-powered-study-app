import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isPackOnly = process.argv.includes('--pack');
const outDir = process.env.FLECKSHI_DESKTOP_OUT || 'dist-desktop';
const resolvedOutDir = path.resolve(outDir);
const unpackedDir = path.join(resolvedOutDir, 'win-unpacked');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function findRunningFleckshiProcesses() {
  if (process.platform !== 'win32') return [];
  try {
    const raw = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-Process -Name "Fleckshi","electron" -ErrorAction SilentlyContinue | Select-Object Name, Id, Path | ConvertTo-Json -Compress'
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter((p) => p && (p.Name || p.Id));
  } catch {
    return [];
  }
}

function checkAndCleanPreviousOutput(targetDir) {
  if (!fs.existsSync(targetDir)) return;
  const probeExe = path.join(targetDir, 'Fleckshi.exe');
  const probeTarget = fs.existsSync(probeExe) ? probeExe : targetDir;
  const tempCheck = `${targetDir}.clean-check-${Date.now()}`;

  try {
    // Test exclusive access by renaming before deleting; never force-delete locked files
    fs.renameSync(targetDir, tempCheck);
    fs.rmSync(tempCheck, { recursive: true, force: false });
  } catch (err) {
    if (err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')) {
      console.error(`\n[desktop:build] Output directory is locked (${err.code}): ${probeTarget}`);
      console.error('Likely causes on Windows:');
      console.error('  1. An instance of Fleckshi.exe or Electron is still running.');
      console.error('  2. OneDrive sync or Windows Defender is currently scanning files in this folder.');
      console.error('\nRecovery steps:');
      console.error('  - Close any open Fleckshi windows and wait a few seconds for OneDrive/Defender to release handles.');
      console.error('  - Or build to a different output folder: $env:FLECKSHI_DESKTOP_OUT="build-out"; npm run desktop:build');
      process.exit(1);
    }
    throw err;
  }
}

function runStep(cmd, args, label) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (res.status !== 0) {
    console.error(`\n[desktop:build] Step failed (${label}) with exit code ${res.status ?? 1}.`);
    process.exit(res.status ?? 1);
  }
}

const running = findRunningFleckshiProcesses().filter(
  (p) => !p.Path || p.Path.toLowerCase().includes(resolvedOutDir.toLowerCase()) || p.Name === 'Fleckshi'
);
if (running.length) {
  console.error('\n[desktop:build] Cannot package while Fleckshi is running:');
  for (const p of running) {
    console.error(`  - ${p.Name} (PID ${p.Id})${p.Path ? `: ${p.Path}` : ''}`);
  }
  console.error('Close the running Fleckshi window(s) and retry `npm run desktop:build`.');
  process.exit(1);
}

checkAndCleanPreviousOutput(unpackedDir);

runStep(npmCmd, ['run', 'build'], 'vite build');

if (isPackOnly) {
  runStep(
    npxCmd,
    ['electron-builder', '--win', '--x64', '--dir', `--config.directories.output=${outDir}`],
    'electron-builder --dir'
  );
} else {
  runStep(
    npxCmd,
    ['electron-builder', '--win', 'nsis', '--x64', `--config.directories.output=${outDir}`],
    'electron-builder nsis'
  );
  runStep(
    npxCmd,
    [
      'electron-builder',
      '--win',
      'portable',
      '--x64',
      '--prepackaged',
      path.join(outDir, 'win-unpacked'),
      `--config.directories.output=${outDir}`
    ],
    'electron-builder portable'
  );
}
