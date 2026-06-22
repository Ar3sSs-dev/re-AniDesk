import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Manual mock in require.cache for CommonJS require('electron')
const mockPath = path.join(__dirname, 'temp_userdata');
const electronMock = {
  app: {
    getPath: (name) => mockPath
  },
  ipcMain: {
    handle: () => {}
  },
  shell: {
    openPath: () => {}
  }
};
require.cache[require.resolve('electron')] = {
  id: 'electron',
  filename: 'electron',
  loaded: true,
  exports: electronMock
};

// Import downloader after mock
const downloader = require('../src/downloader.js');

describe('Downloader Library Tests', () => {
  const tempUserdata = path.join(__dirname, 'temp_userdata');
  const libraryPath = path.join(tempUserdata, 'offline_library.json');

  beforeEach(() => {
    if (!fs.existsSync(tempUserdata)) {
      fs.mkdirSync(tempUserdata, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(libraryPath)) {
      try { fs.unlinkSync(libraryPath); } catch (_) {}
    }
    if (fs.existsSync(tempUserdata)) {
      try { fs.rmdirSync(tempUserdata); } catch (_) {}
    }
  });

  it('should return empty array if library does not exist', async () => {
    const lib = await downloader.getLibrary();
    expect(lib).toEqual([]);
  });

  it('should save and load library successfully', async () => {
    const testData = [{ id: 123, title: 'Test Anime', episodes: [] }];
    await downloader.saveLibrary(testData);
    
    // Check file exists
    expect(fs.existsSync(libraryPath)).toBe(true);

    const lib = await downloader.getLibrary();
    expect(lib).toEqual(testData);
  });
});
