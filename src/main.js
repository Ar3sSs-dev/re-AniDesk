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
/**
 * @type {BrowserWindow}
 */
let mainWindow;

protocol.registerSchemesAsPrivileged([
  { scheme: 'anidesk-cache', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
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

function cleanupCache() {
  try {
    const files = fs.readdirSync(ImageCachePath);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(ImageCachePath, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > thirtyDaysMs) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (e) {
    console.error("Cache cleanup error:", e);
  }
}
cleanupCache();

const discordRpcClient = new rpc.Client({
  clientId: rpcClientId,
  transport: 'ipc'
})

discordRpcClient.on('ready', () => {
  console.log("[RPC] Hooked!");
});

const SettingsFirst = fs.existsSync(SettingsPath) ? JSON.parse(fs.readFileSync(SettingsPath)) : DefaultSettings;

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
      obj[key] = value;
      return;
    }
  }

  obj[keyToChange] = value;
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
        const response = await net.fetch(originalUrl, {
          headers: {
            'User-Agent': UserAgent,
            'Referer': 'https://anixart.tv/'
          }
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          fs.writeFileSync(filePath, Buffer.from(buffer));
          return new Response(buffer, { headers: response.headers });
        }
        return new Response(null, { status: response.status });
      }
    } catch (e) {
      console.error("Cache protocol error:", e);
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
ipcMain.handle("settings:get", (_, key) => {
  const settings = fs.existsSync(SettingsPath) ? JSON.parse(fs.readFileSync(SettingsPath)) : DefaultSettings;

  return settings?.[key] ?? null;
})

ipcMain.handle("settings:set", (_, key, value) => {
  const settings = fs.existsSync(SettingsPath) ? JSON.parse(fs.readFileSync(SettingsPath)) : DefaultSettings;

  settings[key] = value;
  fs.writeFileSync(SettingsPath, JSON.stringify(settings));
})

ipcMain.handle("settings:getAll", (_) => {
  return fs.existsSync(SettingsPath) ? JSON.parse(fs.readFileSync(SettingsPath)) : DefaultSettings;
})

ipcMain.handle("notifications:get", (_) => {
  return fs.existsSync(NotificationsPath) ? JSON.parse(fs.readFileSync(NotificationsPath)) : [];
})

ipcMain.handle("notifications:save", (_, data) => {
  fs.writeFileSync(NotificationsPath, JSON.stringify(data));
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
  o.open(link);
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