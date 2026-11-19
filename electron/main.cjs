const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.ELECTRON_START_URL || '';
const DIST_INDEX_PATH = path.join(__dirname, '..', 'dist', 'index.html');
const DIST_DIR_URL = pathToFileURL(path.join(__dirname, '..', 'dist') + path.sep).href;

app.setName('Fleckshi');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.fleckshi.app');
}

function isAllowedAppUrl(targetUrl) {
  if (!targetUrl) return false;
  if (targetUrl === 'about:blank' || targetUrl.startsWith('data:') || targetUrl.startsWith('blob:')) {
    return true;
  }
  if (DEV_URL && targetUrl.startsWith(DEV_URL)) {
    return true;
  }
  if (targetUrl.startsWith(DIST_DIR_URL)) {
    return true;
  }
  return false;
}

function openExternalSafe(targetUrl) {
  if (typeof targetUrl !== 'string') return;
  if (targetUrl.startsWith('https://') || targetUrl.startsWith('http://')) {
    shell.openExternal(targetUrl).catch(() => {});
  }
}

function createMainWindow() {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 620,
    title: 'Fleckshi — Your study space, guided.',
    backgroundColor: '#0B0F17',
    icon: path.join(__dirname, '..', 'build', iconFile),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedAppUrl(url)) {
      event.preventDefault();
      openExternalSafe(url);
    }
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(DIST_INDEX_PATH);
  }

  return win;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  let mainWindow = null;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
