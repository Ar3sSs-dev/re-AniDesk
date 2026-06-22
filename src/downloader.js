const { ipcMain, app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// ── ffmpeg path fix (app.asar → app.asar.unpacked) ──────────────────────────
let ffmpegPath = ffmpegInstaller.path;
if (ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}
ffmpeg.setFfmpegPath(ffmpegPath);

// ── paths ────────────────────────────────────────────────────────────────────
const offlineLibraryPath = path.join(app.getPath("userData"), "offline_library.json");
const offlineStoragePath = path.join(app.getPath("userData"), "offline_storage");
const logFilePath       = path.join(app.getPath("userData"), "anidesk_downloads.log");

if (!fs.existsSync(offlineStoragePath)) {
    fs.mkdirSync(offlineStoragePath, { recursive: true });
}

// ── log helper ───────────────────────────────────────────────────────────────
function logDownload(tag, message) {
    const line = `[${new Date().toISOString()}] [${tag}] ${message}\n`;
    console.log(line.trim());
    try { fs.appendFileSync(logFilePath, line); } catch (_) {}
}

// ── library I/O ──────────────────────────────────────────────────────────────
let saveLock = Promise.resolve();

async function getLibrary() {
    if (!fs.existsSync(offlineLibraryPath)) return [];
    try {
        const data = await fs.promises.readFile(offlineLibraryPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        logDownload('LIBRARY', `Parse error: ${e.message}`);
        return [];
    }
}

function saveLibrary(lib) {
    saveLock = saveLock.then(async () => {
        const tmpPath = offlineLibraryPath + '.tmp';
        try {
            // Атомарная запись: сначала в .tmp, потом rename.
            // Если процесс упадёт во время записи — основной файл останется нетронутым.
            await fs.promises.writeFile(tmpPath, JSON.stringify(lib, null, 2));
            await fs.promises.rename(tmpPath, offlineLibraryPath);
        } catch (e) {
            logDownload('LIBRARY', `Write error: ${e.message}`);
            // Убираем .tmp если он остался
            await fs.promises.unlink(tmpPath).catch(() => {});
        }
    }).catch((e) => { logDownload('LIBRARY', 'Queue error: ' + e); });
    return saveLock;
}

// ── active downloads registry ────────────────────────────────────────────────
const activeDownloads = {};

function initDownloader(mainWindow) {

    ipcMain.handle("offline:getLibrary", () => getLibrary());

    ipcMain.handle("offline:openFolder", () => shell.openPath(offlineStoragePath));

    ipcMain.handle("offline:deleteEpisode", async (_, animeId, episodeId) => {
        const lib = await getLibrary();
        const animeIndex = lib.findIndex(a => a.id === animeId);
        if (animeIndex !== -1) {
            const anime = lib[animeIndex];
            const epIndex = anime.episodes.findIndex(e => e.id === episodeId);
            if (epIndex !== -1) {
                const ep = anime.episodes[epIndex];
                let fileDeleted = true;
                if (fs.existsSync(ep.filePath)) {
                    try {
                        await fs.promises.unlink(ep.filePath);
                    } catch (err) {
                        logDownload('LIBRARY', `Delete file error for ep ${episodeId}: ${err.message}`);
                        fileDeleted = false;
                    }
                }
                // Удаляем из библиотеки только если файл успешно удалён
                // (или его вообще не существует на диске)
                if (fileDeleted) {
                    anime.episodes.splice(epIndex, 1);
                    if (anime.episodes.length === 0) lib.splice(animeIndex, 1);
                    await saveLibrary(lib);
                    return true;
                }
                return false; // Файл занят — сообщаем UI об ошибке
            }
        }
        return false;
    });

    // ── queue ────────────────────────────────────────────────────────────────
    const MAX_CONCURRENT = 2;
    const downloadQueue  = [];
    let activeDownloadsCount = 0;

    function processQueue() {
        if (activeDownloadsCount >= MAX_CONCURRENT || downloadQueue.length === 0) return;

        const downloadId = downloadQueue.shift();
        if (!activeDownloads[downloadId]) {
            processQueue(); // was cancelled while in queue
            return;
        }

        activeDownloadsCount++;
        const item = activeDownloads[downloadId];
        item.percent = 0;

        logDownload('QUEUE', `Starting download: ${downloadId} | URL: ${item.url}`);

        let lastProgressTime = 0;
        let lastProgressPercent = 0;

        // ── helpers ──────────────────────────────────────────────────────────
        const sendProgress = (percent) => {
            const now = Date.now();
            if (percent < 0 || percent === 100 || percent === 0 || 
                now - lastProgressTime >= 500 || 
                Math.abs(percent - lastProgressPercent) >= 1) {
                
                lastProgressTime = now;
                lastProgressPercent = percent;

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('offline:progress', {
                        animeId:   item.animeMeta.id,
                        episodeId: item.episodeMeta.id,
                        percent
                    });
                }
            }
        };

        const sendError = (errorMsg) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('offline:error', {
                    animeId:   item.animeMeta.id,
                    episodeId: item.episodeMeta.id,
                    error:     errorMsg || 'Unknown error'
                });
            }
        };

        sendProgress(0);

        const finishDownload = () => {
            logDownload('FINISH', `Done: ${downloadId}`);
            // \u0424\u0438\u043a\u0441 Race Condition: \u0432\u0435\u0441\u044c \u0446\u0438\u043a\u043b \u0447\u0442\u0435\u043d\u0438\u0435→\u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435→\u0430\u0442\u043e\u043c\u0430\u0440\u043d\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c \u0432\u043d\u0443\u0442\u0440\u0438 saveLock.
            // \u0415\u0441\u043b\u0438 \u0434\u0432\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u044e\u0442\u0441\u044f \u043e\u0434\u043d\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e,
            // \u0432\u0442\u043e\u0440\u0430\u044f \u043d\u0435 \u0437\u0430\u0442\u0440\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0435\u0440\u0432\u043e\u0439.
            saveLock = saveLock.then(async () => {
                const lib = await getLibrary();
                let anime = lib.find(a => a.id === item.animeMeta.id);
                if (!anime) {
                    anime = {
                        id:       item.animeMeta.id,
                        title:    item.animeMeta.title,
                        image:    item.animeMeta.image,
                        episodes: []
                    };
                    lib.push(anime);
                }
                anime.episodes = anime.episodes.filter(e => e.id !== item.episodeMeta.id);
                anime.episodes.push({
                    id:       item.episodeMeta.id,
                    title:    item.episodeMeta.title,
                    filePath: item.filePath
                });
                const tmpPath = offlineLibraryPath + '.tmp';
                await fs.promises.writeFile(tmpPath, JSON.stringify(lib, null, 2));
                await fs.promises.rename(tmpPath, offlineLibraryPath);
            });

            delete activeDownloads[downloadId];
            sendProgress(100);
            activeDownloadsCount--;
            processQueue();
        };

        const failDownload = async (err, silent = false) => {
            silent = silent || item.cancelled;
            const msg = err ? err.message || String(err) : 'Cancelled';
            if (!silent) logDownload('ERROR', `Failed ${downloadId}: ${msg}`);
            else         logDownload('CANCEL', `Cancelled ${downloadId}`);

            // Фикс EBUSY на Windows: сначала закрываем WriteStream,
            // затем удаляем файл — иначе удаление открытого файла выбросит EPERM
            if (item.fileStream && !item.fileStream.closed) {
                await new Promise(resolve => item.fileStream.close(resolve));
            }
            if (fs.existsSync(item.filePath)) {
                try {
                    await fs.promises.unlink(item.filePath);
                } catch (unlinkErr) {
                    logDownload('ERROR', `Cleanup file error ${downloadId}: ${unlinkErr.message}`);
                }
            }
            delete activeDownloads[downloadId];
            
            if (silent) {
                sendProgress(-1);
            } else {
                sendError(msg);
            }
            
            activeDownloadsCount--;
            processQueue();
        };

        // ── headers ──────────────────────────────────────────────────────────
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        let referer = 'https://kodik.info/';
        try {
            const host = new URL(item.url).hostname;
            if (host.includes('sibnet.ru'))       referer = 'https://video.sibnet.ru/';
            else if (host.includes('libria') ||
                     host.includes('anilibria'))   referer = 'https://anilibria.tv/';
        } catch (_) {}

        logDownload('INFO', `Headers — UA: ${userAgent} | Referer: ${referer}`);

        // ── m3u8 via ffmpeg ──────────────────────────────────────────────────
        if (item.url.includes('.m3u8')) {
            logDownload('FFMPEG', `Using ffmpeg for HLS stream: ${item.url}`);
            logDownload('FFMPEG', `ffmpeg binary path: ${ffmpegPath}`);

            if (!fs.existsSync(ffmpegPath)) {
                logDownload('FFMPEG', `CRITICAL: ffmpeg binary NOT FOUND at path: ${ffmpegPath}`);
                failDownload(new Error(`ffmpeg not found at: ${ffmpegPath}`));
                return;
            }

            let duration = 0;
            const command = ffmpeg(item.url)
                .addInputOption('-user_agent', userAgent)
                .addInputOption('-referer', referer)
                .addInputOption('-timeout', '30000000')   // 30 s socket timeout
                .addInputOption('-reconnect', '1')
                .addInputOption('-reconnect_streamed', '1')
                .addInputOption('-reconnect_delay_max', '5')
                .outputOptions(['-c copy', '-bsf:a aac_adtstoasc', '-movflags +faststart'])
                .output(item.filePath)
                .on('start', (cmd) => {
                    logDownload('FFMPEG', `Spawned: ${cmd}`);
                })
                .on('codecData', data => {
                    logDownload('FFMPEG', `Codec data: ${JSON.stringify(data)}`);
                    if (data.duration) {
                        const parts = data.duration.split(':');
                        duration = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseFloat(parts[2]);
                        logDownload('FFMPEG', `Duration detected: ${duration}s`);
                    }
                })
                .on('progress', progress => {
                    logDownload('FFMPEG', `Progress: ${JSON.stringify(progress)}`);
                    if (duration > 0 && progress.timemark) {
                        const parts = progress.timemark.split(':');
                        const cur = (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseFloat(parts[2]);
                        const pct = Math.min((cur / duration) * 100, 99);
                        item.percent = pct;
                        sendProgress(pct);
                    }
                })
                .on('end', () => {
                    logDownload('FFMPEG', `Encoding finished for ${downloadId}`);
                    finishDownload();
                })
                .on('error', (err, stdout, stderr) => {
                    logDownload('FFMPEG', `Error: ${err.message}`);
                    logDownload('FFMPEG', `stderr: ${stderr || '(empty)'}`);
                    logDownload('FFMPEG', `stdout: ${stdout || '(empty)'}`);
                    if (err.message && err.message.includes('SIGKILL')) {
                        failDownload(null, true); // user-cancelled
                    } else {
                        failDownload(err);
                    }
                });

            command.run();
            item.command = command;

        // ── direct HTTP download ─────────────────────────────────────────────
        } else {
            logDownload('HTTP', `Direct download: ${item.url}`);

            let parsedOptions;
            try {
                parsedOptions = new URL(item.url);
            } catch (parseErr) {
                logDownload('HTTP', `URL parse failed: ${parseErr.message}`);
                failDownload(new Error(`Invalid URL: ${parseErr.message}`));
                return;
            }

            const reqOptions = {
                hostname: parsedOptions.hostname,
                path:     parsedOptions.pathname + parsedOptions.search,
                port:     parsedOptions.port || (parsedOptions.protocol === 'https:' ? 443 : 80),
                protocol: parsedOptions.protocol,
                headers: {
                    'User-Agent': userAgent,
                    'Referer':    referer,
                    'Accept':     '*/*'
                }
            };

            const protocol = parsedOptions.protocol === 'https:' ? https : http;

            const makeRequest = (url, redirectCount = 0) => {
                if (redirectCount > 5) {
                    failDownload(new Error('Too many redirects'));
                    return;
                }

                const reqOpts = (() => {
                    try {
                        const u = new URL(url);
                        return {
                            hostname: u.hostname,
                            path:     u.pathname + u.search,
                            port:     u.port || (u.protocol === 'https:' ? 443 : 80),
                            headers:  reqOptions.headers
                        };
                    } catch (_) { return null; }
                })();

                if (!reqOpts) { failDownload(new Error('Invalid redirect URL')); return; }

                const proto = url.startsWith('https') ? https : http;

                const request = proto.get({ ...reqOpts }, (response) => {
                    logDownload('HTTP', `Status: ${response.statusCode} for ${url}`);

                    // Follow redirects
                    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                        const loc = response.headers['location'];
                        if (loc) {
                            logDownload('HTTP', `Redirect → ${loc}`);
                            response.resume();
                            makeRequest(loc.startsWith('http') ? loc : `https://${parsedOptions.hostname}${loc}`, redirectCount + 1);
                            return;
                        }
                    }

                    if (response.statusCode !== 200) {
                        logDownload('HTTP', `Non-200 status: ${response.statusCode}`);
                        response.resume();
                        failDownload(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
                    let downloadedBytes = 0;

                    const file = fs.createWriteStream(item.filePath);
                    item.fileStream = file; // \u0424\u0438\u043a\u0441 EBUSY: \u0445\u0440\u0430\u043d\u0438\u043c \u0441\u0441\u044b\u043b\u043a\u0443 \u0434\u043b\u044f \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u044f \u043f\u0435\u0440\u0435\u0434 unlink

                    response.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        if (totalBytes > 0) {
                            const pct = Math.min((downloadedBytes / totalBytes) * 100, 99);
                            item.percent = pct;
                            sendProgress(pct);
                        }
                    });

                    response.on('error', (err) => {
                        logDownload('HTTP', `Response stream error: ${err.message}`);
                        file.destroy();
                        failDownload(err);
                    });

                    file.on('error', (err) => {
                        logDownload('HTTP', `File write error: ${err.message}`);
                        failDownload(err);
                    });

                    file.on('finish', () => {
                        file.close(() => {
                            logDownload('HTTP', `File written: ${item.filePath}`);
                            finishDownload();
                        });
                    });

                    response.pipe(file);
                });

                request.on('error', (err) => {
                    logDownload('HTTP', `Request error: ${err.message} (code: ${err.code})`);
                    failDownload(err);
                });

                request.setTimeout(60000, () => {
                    logDownload('HTTP', `Request timed out for ${url}`);
                    request.destroy(new Error('Request timed out'));
                });

                item.request = request;
            };

            makeRequest(item.url);
        }
    }

    // ── IPC: start download ──────────────────────────────────────────────────
    ipcMain.handle("offline:downloadEpisode", async (_, animeMeta, episodeMeta, url) => {
        const downloadId = `${animeMeta.id}_${episodeMeta.id}`;

        if (activeDownloads[downloadId]) {
            logDownload('IPC', `Already active: ${downloadId}`);
            return false;
        }

        logDownload('IPC', `Queuing: ${downloadId} | url=${url}`);

        const safeAnimeTitle   = (animeMeta.title || 'anime').replace(/[^a-z0-9а-яёА-ЯЁ ]/gi, '').trim() || 'anime';
        const safeEpisodeName  = (episodeMeta.title || `Episode_${episodeMeta.id}`).replace(/[^a-z0-9а-яёА-ЯЁ ]/gi, '').trim() || `Episode_${episodeMeta.id}`;
        const fileName  = `${safeAnimeTitle} - ${safeEpisodeName}.mp4`;
        const filePath  = path.join(offlineStoragePath, fileName);

        activeDownloads[downloadId] = {
            animeMeta,
            episodeMeta,
            url,
            filePath,
            percent: -2,
            command: null,
            request: null,
            fileStream: null  // \u0437\u0430\u043f\u043e\u043b\u043d\u044f\u0435\u0442\u0441\u044f \u043f\u0435\u0440\u0435\u0434 \u0437\u0430\u043f\u0438\u0441\u044c\u044e \u0444\u0430\u0439\u043b\u0430 \u2014 \u0434\u043b\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0433\u043e close() \u0432 failDownload
        };

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('offline:progress', {
                animeId:   animeMeta.id,
                episodeId: episodeMeta.id,
                percent:   -2
            });
        }

        downloadQueue.push(downloadId);
        processQueue();
        return true;
    });

    // ── IPC: cancel ──────────────────────────────────────────────────────────
    ipcMain.handle("offline:cancelDownload", (_, animeId, episodeId) => {
        const downloadId = `${animeId}_${episodeId}`;
        const item = activeDownloads[downloadId];
        if (!item) return false;

        logDownload('CANCEL', `User cancelled: ${downloadId}`);
        item.cancelled = true;

        if (item.command) {
            item.command.kill('SIGKILL');
        } else if (item.request) {
            item.request.destroy();
            // failDownload will be called from the request 'error' handler
        } else {
            // Still in queue — remove manually
            delete activeDownloads[downloadId];
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('offline:progress', {
                    animeId, episodeId, percent: -1
                });
            }
        }
        return true;
    });

    // ── IPC: getters ─────────────────────────────────────────────────────────
    ipcMain.handle("offline:getActiveDownloads", () => {
        return Object.entries(activeDownloads)
            .filter(([, d]) => d.animeMeta)
            .map(([id, d]) => ({
                downloadId:  id,
                animeMeta:   d.animeMeta,
                episodeMeta: d.episodeMeta,
                percent:     d.percent
            }));
    });
}

module.exports = { initDownloader, getLibrary, saveLibrary };
