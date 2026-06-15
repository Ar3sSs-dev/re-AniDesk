const { app, BrowserWindow, ipcMain, net, autoUpdater, dialog, protocol } = require('electron')
const path = require('node:path')
const crypto = require('crypto');
const o = require('openurl');
const serve = require('electron-serve').default;
const loadURL = serve({ directory: './public' });
const fs = require('fs');
const rpc = require("@xhayper/discord-rpc");
const { initialize, trackEvent } = require("./aptabase/main");
const { SibnetParser } = require('anixartjs');
const { initDownloader } = require('./downloader');
/**
 * @type {BrowserWindow}
 */
let mainWindow;

protocol.registerSchemesAsPrivileged([
  { scheme: 'anidesk-cache', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } },
  { scheme: 'anidesk-offline', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

const server = 'https://update.electronjs.org'
const feed = `${server}/theDesConnet/AniDesk/${process.platform}-${process.arch}/${app.getVersion()}`
const UserAgent = "AnixartApp/9.0 BETA 3-25021818 (Android 9; SDK 28; x86_64; ROG ASUS AI2201_B; ru)";
const rpcClientId = '1372649290438148137';
const SettingsPath = path.join(app.getPath("userData"), "settings.json");
const NotificationsPath = path.join(app.getPath("userData"), "notifications.json");
const DefaultSettings = {
  AutoUpdate: true,
  EnableAnalytics: true,
  EnableRPC: false,
  EnableDevTools: false
};

const ImageCachePath = path.join(app.getPath("userData"), "image_cache");
if (!fs.existsSync(ImageCachePath)) {
  fs.mkdirSync(ImageCachePath, { recursive: true });
}

async function cleanupCache() {
  try {
    const files = await fs.promises.readdir(ImageCachePath);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const file of files) {
      try {
        const filePath = path.join(ImageCachePath, file);
        const stats = await fs.promises.stat(filePath);
        if (now - stats.mtimeMs > thirtyDaysMs) {
          await fs.promises.unlink(filePath);
        }
      } catch (fileErr) {
        console.error(`Cache cleanup: skip ${file}:`, fileErr.message);
      }
    }
  } catch (e) {
    console.error("Cache cleanup error:", e);
  }
}
// Запускаем асинхронно, не блокируя основной процесс
cleanupCache().catch(e => console.error("Cache cleanup failed:", e));

const discordRpcClient = new rpc.Client({
  clientId: rpcClientId,
  transport: 'ipc'
})

discordRpcClient.on('ready', () => {
  console.log("[RPC] Hooked!");
});

let SettingsFirst = DefaultSettings;
try {
  if (fs.existsSync(SettingsPath)) {
    SettingsFirst = JSON.parse(fs.readFileSync(SettingsPath));
  }
} catch (e) {
  console.error("Failed to parse settings.json, using defaults:", e.message);
}

if (SettingsFirst.AutoUpdate) {
  autoUpdater.on("checking-for-update", () => {
    console.log("checking-for-update");
  });

  autoUpdater.on("update-available", () => {
    console.log("update-available");
  });

  autoUpdater.on("update-not-available", () => {
    console.log("update-not-available");
  });

  autoUpdater.on('error', (message) => {
    console.error('There was a problem updating the application')
    console.error(message)
  })

  autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
    const dialogOpts = {
      type: 'info',
      buttons: ['Перезапустить', 'Позже'],
      title: 'Обновление AniDesk',
      message: process.platform === 'win32' ? releaseNotes : releaseName,
      detail:
        'Новая версия была скачана, перезапустите приложение для установки.'
    }

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.setFeedURL(feed);
  autoUpdater.checkForUpdates();
}

if (require('electron-squirrel-startup')) app.quit();

const isFirstInstance = app.requestSingleInstanceLock();

if (!isFirstInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

if (SettingsFirst.EnableRPC) discordRpcClient.login().catch(console.error);

if (SettingsFirst.EnableAnalytics) {
  initialize("A-EU-5850138901");
  trackEvent("app_started");
}

function isDev() {
  return !app.isPackaged;
}

function UpsertKeyValue(obj, keyToChange, value) {
  const keyToChangeLower = keyToChange.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === keyToChangeLower) {
      if (value === null) delete obj[key];
      else obj[key] = value;
      return;
    }
  }

  if (value !== null) obj[keyToChange] = value;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    titleBarStyle: 'hidden',
    width: 1417,
    height: 910,
    minHeight: 720,
    minWidth: 1280,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      devTools: SettingsFirst.EnableDevTools
    },
    icon: "./public/assets/icons/anidesk-icon.png",
    show: false,
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:8080/');
  } else {
    loadURL(mainWindow);
  }

  mainWindow.on('closed', function () {
    mainWindow = null
  });

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show()
  });

  initDownloader(mainWindow);

  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const { url, resourceType } = details;
      
      try {
        if (url.startsWith('http') && resourceType === 'image') {
          const host = new URL(url).host;
          const isBlockedDomain = host.includes('kinopoisk') || 
                                  host.includes('yandex') || 
                                  host.includes('anixart') || 
                                  host.includes('shikimori') ||
                                  host.includes('anixmirai') ||
                                  host.includes('vk.com');
                                  
          if (isBlockedDomain) {
            const hexUrl = Buffer.from(url).toString('hex');
            return callback({ redirectURL: `anidesk-cache://${hexUrl}` });
          }
        }
      } catch (e) {
        console.error("Proxy error:", e);
      }
      
      callback({});
    }
  );

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      const { url, requestHeaders } = details;
      const host = new URL(url).host;

      UpsertKeyValue(requestHeaders, 'Referer', null);
      UpsertKeyValue(requestHeaders, 'Access-Control-Allow-Origin', ['*']);

      if (host == "video.sibnet.ru") {
        UpsertKeyValue(requestHeaders, 'Referer', url);
      }

      if (host !== "kodikplayer.com" && host !== "video.sibnet.ru") {
        UpsertKeyValue(requestHeaders, 'sec-ch-ua-platform', "Android");
        UpsertKeyValue(requestHeaders, 'sec-ch-ua-mobile', "?1");
        UpsertKeyValue(requestHeaders, 'sec-ch-ua', "AnixartApp");
        UpsertKeyValue(requestHeaders, 'User-Agent', UserAgent)
      };
      callback({ requestHeaders });
    },
  );

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders, resourceType } = details;
    UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Origin', ['*']);
    UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Headers', ['*']);

    if (resourceType === 'image') {
      UpsertKeyValue(responseHeaders, 'Cache-Control', ['public, max-age=31536000, immutable']);
    }

    callback({
      responseHeaders,
    });
  });
}

app.on('ready', () => {
  // Map \u0434\u043b\u044f \u0434\u0435\u0434\u0443\u043f\u043b\u0438\u043a\u0430\u0446\u0438\u0438 \u043f\u0430\u0440\u0430\u043b\u043b\u0435\u043b\u044c\u043d\u044b\u0445 fetch-\u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432 \u043d\u0430 \u043e\u0434\u0438\u043d \u0444\u0430\u0439\u043b \u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u043a\u044d\u0448\u0430
  const cacheInFlight = new Map();

  protocol.handle('anidesk-cache', async (req) => {
    try {
      const hexUrl = req.url.replace('anidesk-cache://', '').replace(/\/$/, '');
      const originalUrl = Buffer.from(hexUrl, 'hex').toString('utf8');
      const hash = crypto.createHash('md5').update(originalUrl).digest('hex');
      const urlObj = new URL(originalUrl);
      const ext = path.extname(urlObj.pathname) || '.jpg';
      const filePath = path.join(ImageCachePath, `${hash}${ext}`);
      const normalizedPath = filePath.replace(/\\/g, '/');

      if (fs.existsSync(filePath)) {
        return net.fetch(`file:///${normalizedPath}`);
      } else {
        // \u0424\u0438\u043a\u0441 Stream Lock: \u0445\u0440\u0430\u043d\u0438\u043c Promise<Buffer>, \u0430 \u043d\u0435 Promise<Response>.
        // \u0415\u0441\u043b\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e <img> \u043e\u0434\u043d\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u044f\u0442 \u043e\u0434\u0438\u043d \u043f\u043e\u0441\u0442\u0435\u0440,
        // \u043a\u0430\u0436\u0434\u044b\u0439 \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442 \u0441\u0432\u043e\u0439 \u043d\u043e\u0432\u044b\u0439 Response \u0438\u0437 \u043e\u0434\u043d\u043e\u0433\u043e \u0438 \u0442\u043e\u0433\u043e \u0436\u0435 Buffer \u2014
        // \u0438\u043d\u0430\u0447\u0435 \u0432\u0442\u043e\u0440\u043e\u0439 \u0437\u0430\u043f\u0440\u043e\u0441 \u043f\u043e\u043b\u0443\u0447\u0438\u0442 TypeError: body stream already read
        if (!cacheInFlight.has(filePath)) {
          const fetchUrl = originalUrl.includes('anixmirai.com') ? `https://images.weserv.nl/?url=${originalUrl}&w=300&output=webp` : originalUrl;
          const bufferPromise = (async () => {
            const response = await net.fetch(fetchUrl, {
              headers: {
                'User-Agent': UserAgent,
                'Referer': 'https://anixart.tv/'
              }
            });
            if (!response.ok) return null;
            const buffer = await response.arrayBuffer();
            await fs.promises.writeFile(filePath, Buffer.from(buffer));
            return buffer;
          })();
          bufferPromise.finally(() => cacheInFlight.delete(filePath));
          cacheInFlight.set(filePath, bufferPromise);
        }
        const buffer = await cacheInFlight.get(filePath);
        if (!buffer) return new Response(null, { status: 502 });
        // \u041a\u0430\u0436\u0434\u044b\u0439 \u0437\u0430\u043f\u0440\u043e\u0441\u0438\u0432\u0448\u0438\u0439 \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442 \u0441\u0432\u0435\u0436\u0438\u0439 Response \u0438\u0437 \u043e\u0434\u043d\u043e\u0433\u043e Buffer
        return new Response(buffer, { headers: { 'Content-Type': 'image/jpeg' } });
      }
    } catch (e) {
      console.error("Cache protocol error:", e);
      return new Response(null, { status: 500 });
    }
  });

  protocol.handle('anidesk-offline', async (req) => {
    try {
      const hexPath = req.url.replace('anidesk-offline://', '').replace(/\/$/, '');
      const originalPath = Buffer.from(hexPath, 'hex').toString('utf8');
      const filePath = originalPath.replace(/\\/g, '/');

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;

      const rangeHeader = req.headers.get('range');

      if (rangeHeader) {
        // Parse Range: bytes=start-end или bytes=-suffix
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        let start, end;

        if (parts[0] === '') {
          // Формат bytes=-500 (последние N байт)
          const suffixLength = parseInt(parts[1], 10);
          start = Math.max(0, fileSize - suffixLength);
          end = fileSize - 1;
        } else {
          start = parseInt(parts[0], 10);
          end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        }

        const chunkSize = end - start + 1;

        const fileStream = require('fs').createReadStream(filePath, { start, end });
        const { Readable } = require('stream');
        const nodeReadable = Readable.toWeb(fileStream);

        return new Response(nodeReadable, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': 'video/mp4',
          },
        });
      } else {
        // Full file response
        const fileStream = require('fs').createReadStream(filePath);
        const { Readable } = require('stream');
        const nodeReadable = Readable.toWeb(fileStream);

        return new Response(nodeReadable, {
          status: 200,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': String(fileSize),
            'Content-Type': 'video/mp4',
          },
        });
      }
    } catch (e) {
      console.error("Offline protocol error:", e);
      return new Response(null, { status: 500 });
    }
  });

  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
});

app.on('activate', function () {
  if (mainWindow === null) createWindow()
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
})

ipcMain.handle("analytics:trackEvent", (_, eventName, props) => {
  trackEvent(eventName, props);
})
ipcMain.handle("settings:get", async (_, key) => {
  try {
    let settings = DefaultSettings;
    if (fs.existsSync(SettingsPath)) {
      settings = JSON.parse(await fs.promises.readFile(SettingsPath, 'utf8'));
    }
    return settings?.[key] ?? null;
  } catch (e) {
    console.error('settings:get error:', e.message);
    return DefaultSettings?.[key] ?? null;
  }
})

ipcMain.handle("settings:set", async (_, key, value) => {
  try {
    let settings = { ...DefaultSettings };
    if (fs.existsSync(SettingsPath)) {
      settings = JSON.parse(await fs.promises.readFile(SettingsPath, 'utf8'));
    }
    settings[key] = value;
    await fs.promises.writeFile(SettingsPath, JSON.stringify(settings));
  } catch (e) {
    console.error('settings:set error:', e.message);
  }
})

ipcMain.handle("settings:getAll", async (_) => {
  try {
    if (fs.existsSync(SettingsPath)) {
      return JSON.parse(await fs.promises.readFile(SettingsPath, 'utf8'));
    }
    return { ...DefaultSettings };
  } catch (e) {
    console.error('settings:getAll error:', e.message);
    return { ...DefaultSettings };
  }
})

ipcMain.handle("notifications:get", (_) => {
  try {
    return fs.existsSync(NotificationsPath) ? JSON.parse(fs.readFileSync(NotificationsPath, 'utf8')) : [];
  } catch (e) {
    console.error('notifications:get error:', e.message);
    return [];
  }
})

ipcMain.handle("notifications:save", (_, data) => {
  try {
    fs.writeFileSync(NotificationsPath, JSON.stringify(data));
  } catch (e) {
    console.error('notifications:save error:', e.message);
  }
})

ipcMain.handle("window:minimize", (_) => {
  mainWindow.minimize();
});

ipcMain.handle("window:maximize", (_) => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("window:close", (_) => {
  mainWindow.close();
});

ipcMain.handle("window:getSize", (_) => {
  return mainWindow.getSize();
});

ipcMain.handle("window:enterFullScreen", (_) => {
  mainWindow.setFullScreen(true);
})

ipcMain.handle("window:leaveFullScreen", (_) => {
  mainWindow.setFullScreen(false);
})

ipcMain.handle("sibnet:parse", async (_, link) => {
  const res = await SibnetParser.getDirectLink(link);
  return res;
})

ipcMain.handle("winApi:openLink", (_, link) => {
  try {
    const parsed = new URL(link);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      o.open(link);
    } else {
      console.error('winApi:openLink blocked non-http/https URL:', link);
    }
  } catch (e) {
    console.error('winApi:openLink invalid URL:', link);
  }
});

ipcMain.handle("discordRPC:setActivity", (_, activity) => {
  if (SettingsFirst.EnableRPC) discordRpcClient.user?.setActivity(activity).then(() => console.log("[RPC] Activity set!")).catch(console.error);
  else console.log("[RPC] Disabled");
});

ipcMain.handle("prc:getVersions", (_) => {
  return {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    anidesk: app.getVersion(),
    node: process.versions.node
  };
})