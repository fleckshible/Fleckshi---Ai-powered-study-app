const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld(
  'fleckshiDesktop',
  Object.freeze({
    isDesktop: true,
    platform: process.platform
  })
);
