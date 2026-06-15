<!--Anidesk player-->

<script>
    export let args;
    import {
        Original,
        ModeA,
        render,
        ModeBB,
        ModeB,
        DoG,
        BilateralMean,
        CNNM,
        CNNSoftM,
        CNNSoftVL,
        CNNVL,
        CNNUL,
        CNNx2M,
        CNNx2VL,
        DenoiseCNNx2VL,
        GANx3L,
        GANx4UUL,
        GANUUL,
        ModeAA,
        ModeCA,
        CNNx2UL,
        ModeC,
    } from "anime4k-webgpu";
    import { localStorageWritable } from "@babichjacob/svelte-localstorage";
    import PlayerGui from "../components/player/PlayerGUI.svelte";
    import { onMount, onDestroy } from "svelte";
    import { AniLibriaParser, SibnetParser, KodikParser } from "anixartjs";
    import utils from "../utils";

    const upscaleModeMap = {
        0: DoG,
        1: BilateralMean,
        2: CNNM,
        3: CNNSoftM,
        4: CNNSoftVL,
        5: CNNVL,
        6: CNNUL,
        7: GANUUL,
        8: CNNx2M,
        9: CNNx2VL,
        10: DenoiseCNNx2VL,
        11: CNNx2UL,
        12: GANx3L,
        13: GANx4UUL,
        14: ModeA,
        15: ModeB,
        16: ModeC,
        17: ModeAA,
        18: ModeBB,
        19: ModeCA,
    };

    let currentTime,
        durationTime,
        upscaleSettings,
        playerSettings,
        playingSettings,
        volPercent;

    // Аниме4К: храним текущий инстанс рендера чтобы убивать перед пересозданием
    let currentAnime4kInstance = null;
    // Debounce-таймер для ResizeObserver
    let resizeDebounceTimer = null;
    // ResizeObserver для отслеживания фактического размера канваса
    let canvasResizeObserver = null;

    let video,
        canvas,
        timePos,
        volControl,
        timeout,
        mainDiv,
        hls,
        currentEpisode,
        startTimestamp;

    let progressPercent, loadedPercent;
    let seekTarget = 0;

    let isHidden, isPaused, isTimePosClick, isFullscreen;
    let pressedKeys = new Set();

    const playerSettingsRaw = localStorageWritable(
        "playerSettings",
        utils.playerDefaultSettings,
    );

    playerSettingsRaw.subscribe((value) => {
        playerSettings = value;
    });

    const playingSettingsRaw = localStorageWritable(
        "playingSettings",
        utils.playingDefaultSettings,
    );

    playingSettingsRaw.subscribe((value) => {
        playingSettings = value;
    });

    let upscaleEnabled = false;

    const upscaleSettingsRaw = localStorageWritable(
        "upscaleSettings",
        utils.upscaleDefaultSettings,
    );

    upscaleSettingsRaw.subscribe((value) => {
        upscaleSettings = value;
        upscaleEnabled = value.enabled;
    });

    let savedTimes;
    const savedTimesRaw = localStorageWritable(
        "savedVideoTimes",
        {},
    );

    savedTimesRaw.subscribe((value) => {
        savedTimes = value;
    });

    async function changeUpscale(enabled) {
        upscaleEnabled = enabled;
        // Сохраняем состояние в localStorage — чтобы при перезаходе настройка не сбрасывалась
        upscaleSettings.enabled = enabled;
        upscaleSettingsRaw.set({ ...upscaleSettings });
        // Только если видео уже загружено и разрешение известно
        if (video && video.videoWidth > 0) {
            await renderUpscale();
        }
    }

    //aspect-16-9
    //aspect-4-3
    //aspect-fit
    let aspectRatio = `aspect-${playerSettings.defaultAspectRatio}`;

    function changeAspectRatio(aspect) {
        playerSettings.defaultAspectRatio = aspect;
        aspectRatio = `aspect-${aspect}`;
    }

    let loading = true;

    function hideOnIdle() {
        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            if (!isHidden) {
                isHidden = true;
            }
        }, playerSettings.timeHideInterface);

        if (isHidden) {
            isHidden = false;
        }
    }

    function handleResize(event) {
        isFullscreen = window.innerHeight === screen.height;
    }

    document.addEventListener("mousemove", hideOnIdle);

    window.addEventListener("resize", handleResize);

    onMount(async () => {
        init();
    });

    onDestroy(() => {
        // Сохранение времени ПЕРЕД сбросом видео
        let ep = currentEpisode || args?.currentEpisode;
        if (playerSettings.rememberTime && video && ep && !video.ended && video.duration - video.currentTime > 10) {
            const timeKey = `${args?.release?.id}_${ep.position}`;
            if (args?.release?.id) {
                savedTimes[timeKey] = video.currentTime;
                savedTimesRaw.set({ ...savedTimes });
            }
        }

        // Уничтожаем Anime4K пайплайн и его циклы перед выходом из плеера
        if (currentAnime4kInstance || window._anime4kRafIds?.size > 0 || window._anime4kRvfcIds?.size > 0) {
            if (window._anime4kRafIds) {
                for (const id of window._anime4kRafIds) window.cancelAnimationFrame(id);
                window._anime4kRafIds.clear();
            }
            if (window._anime4kRvfcIds) {
                for (const id of window._anime4kRvfcIds) {
                    if (video && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(id);
                }
                window._anime4kRvfcIds.clear();
            }

            if (window._anime4kDevice) {
                window._anime4kDevice.destroy();
                window._anime4kDevice = null;
            }
            try {
                if (canvas) canvas.getContext("webgpu")?.unconfigure();
            } catch (e) {}

            currentAnime4kInstance = null;
        }

        // Останавливаем ResizeObserver
        if (canvasResizeObserver) {
            canvasResizeObserver.disconnect();
            canvasResizeObserver = null;
        }
        if (resizeDebounceTimer) {
            clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = null;
        }

        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
            video.onpause = null;
            video.onplay = null;
            video.ontimeupdate = null;
            video.onloadedmetadata = null;
            video.onwaiting = null;
            video.onplaying = null;
            video.onended = null;
            video.onerror = null;
            video = null;
        }
        if (hls) {
            hls.detachMedia();
            hls.destroy();
            hls = null;
        }
        document.removeEventListener("mousemove", hideOnIdle);
        window.removeEventListener("resize", handleResize);
        window.onwheel = null;
        window.onkeydown = null;
        window.onkeyup = null;
        window.onblur = null;

        if (volControl) volControl.oninput = null;
        clearTimeout(timeout);
    });

    async function playVideo(episode) {
        // For offline episodes use src directly, skip HLS
        if (args.isOffline || (episode.url && episode.url.startsWith('anidesk-offline://'))) {
            const src = episode.url || args.src;
            video.src = src;
            args.src = src;
            args.avaliableQuality = { "720": { src } };
            await video.play();
            return;
        }

        let avaliableQuality, link;
        let source =
            typeof episode.source == "number"
                ? args.episodes.find((x) => episode.source == x.source["@id"])
                      .source
                : episode.source;

        switch (source.name) {
            case "Kodik":
                let aQ = {};
                const kLinks = await KodikParser.getDirectLinks(episode.url);
                for (const [key, value] of Object.entries(kLinks)) {
                    aQ[key] = {
                        src: value[0].src,
                    };
                }
                avaliableQuality = aQ;
                break;

            case "Liberty":
            case "Libria":
                await utils.fallback(async () => {
                    const aLinks = await AniLibriaParser.getDirectLinks(
                        episode.url,
                    );
                    avaliableQuality = aLinks;

                    return true;
                }, 3);
                break;

            case "Sibnet":
                await utils.fallback(async () => {
                    const link = await Sibnet.Parse(episode.url);
                    if (!link) return false;

                    avaliableQuality = {
                        "720": {
                            src: link,
                        },
                    };

                    return true;
                }, 3);
                break;
        }

        const url =
            avaliableQuality[String(playingSettings.defaultQuality)]?.src ??
            avaliableQuality["720"]?.src;

        args.avaliableQuality = avaliableQuality;

        link = `${URL.canParse(url) ? url : `https:${url}`}`;

        if (Hls.isSupported() && !new URL(link).pathname.endsWith(".mp4")) {
            hls.detachMedia();
            hls.destroy();

            hls = new Hls();

            hls.on(Hls.Events.BUFFER_APPENDING, (e, data) => {
                loadedPercent =
                    (data.frag._streams.video.endPTS / video.duration) * 100;
            });

            hls.loadSource(link);
            hls.attachMedia(video);
        } else {
            video.src = link;
        }

        args.src = link;

        if (playerSettings.rememberTime) {
            const timeKey = `${args.release.id}_${episode.position}`;
            if (savedTimes[timeKey]) {
                seekTarget = savedTimes[timeKey];
            } else {
                seekTarget = 0;
            }
        }

        await video.play();

        if (!playingSettings.disableHistory && !args.isOffline) {
            anixApi.release.markEpisodeAsWatched(
                args.release.id,
                args.episodes[0].source.id,
                currentEpisode.position,
            );
            anixApi.release.addToHistory(
                args.release.id,
                args.episodes[0].source.id,
                currentEpisode.position,
            );
        }

        analytics.trackEvent("play_anime", {
            source: source.name,
            name: episode.name,
            releaseTitle: args.release.title_ru,
            dubber: source.type.name,
        });

        startTimestamp = Date.now();

        discordRPC.setActivity({
            type: 3,
            state: `${episode.name}`,
            details: args.release.title_ru.slice(0, 127),
            largeImageKey: "anidesk-transparent",
            largeImageText: "AniDesk - Anixart Client",
            startTimestamp: startTimestamp - video.currentTime * 1000,
            endTimestamp:
                startTimestamp + (video.duration - video.currentTime) * 1000,
            instance: true,
            buttons: [
                {
                    label: "Ссылка на релиз",
                    url: `https://anixart.app/release/${args.release.id}`,
                },
                { label: "Ссылка на клиент", url: "https://anidesk.ds1nc.ru/" },
            ],
        });
    }

    async function renderUpscale() {
        canvas = await waitForElm(".player-canvas");

        // Защита: если видео ещё не загрузило метаданные — не создаём пайплайн
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
            return;
        }

        // --- FIX: Отслеживание и остановка циклов рендера anime4k-webgpu ---
        // Библиотека anime4k-webgpu не экспортирует метод destroy(), из-за чего циклы рендера 
        // накапливаются при каждом изменении окна или пресета, вызывая WebGPU TextureView errors.
        if (!window._anime4kPatched) {
            window._anime4kRafIds = new Set();
            window._anime4kRvfcIds = new Set();

            const origRaf = window.requestAnimationFrame;
            window.requestAnimationFrame = function(cb) {
                if (window._captureAnime4k || window._insideAnime4k) {
                    let id;
                    const wrapped = function(...args) {
                        window._insideAnime4k = true;
                        try { return cb(...args); } finally { 
                            window._insideAnime4k = false; 
                            window._anime4kRafIds.delete(id); 
                        }
                    };
                    id = origRaf.call(window, wrapped);
                    window._anime4kRafIds.add(id);
                    return id;
                }
                return origRaf.call(window, cb);
            };

            const origRvfc = HTMLVideoElement.prototype.requestVideoFrameCallback;
            if (origRvfc) {
                HTMLVideoElement.prototype.requestVideoFrameCallback = function(cb) {
                    if (window._captureAnime4k || window._insideAnime4k) {
                        let id;
                        const wrapped = function(...args) {
                            window._insideAnime4k = true;
                            try { return cb(...args); } finally { 
                                window._insideAnime4k = false; 
                                window._anime4kRvfcIds.delete(id);
                            }
                        };
                        id = origRvfc.call(this, wrapped);
                        window._anime4kRvfcIds.add(id);
                        return id;
                    }
                    return origRvfc.call(this, cb);
                };
            }
            window._anime4kPatched = true;
        }

        // Уничтожаем предыдущий инстанс, жестко убиваем его циклы и сбрасываем контекст канваса
        if (currentAnime4kInstance || window._anime4kRafIds?.size > 0 || window._anime4kRvfcIds?.size > 0) {
            for (const id of window._anime4kRafIds) window.cancelAnimationFrame(id);
            window._anime4kRafIds.clear();

            for (const id of window._anime4kRvfcIds) {
                if (video && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(id);
            }
            window._anime4kRvfcIds.clear();

            if (window._anime4kDevice) {
                window._anime4kDevice.destroy();
                window._anime4kDevice = null;
            }
            try {
                canvas.getContext("webgpu")?.unconfigure();
            } catch (e) {}

            // Заменяем канвас на новый, чтобы старый Device не конфликтовал с новым в getContext()
            const newCanvas = canvas.cloneNode(true);
            canvas.parentNode.replaceChild(newCanvas, canvas);
            canvas = newCanvas;

            currentAnime4kInstance = null;
        }

        // ——— FIX #2: CSS-хинты композитора ———
        // Форсируем отдельный GPU-слой для канваса, чтобы Chromium
        // не троттлил rAF из-за перекрытия GUI-слоем (rAF throttle fix)
        canvas.style.willChange = 'transform';
        // transform: translateZ(0) убрано, чтобы не затереть translateX(-50%)
        canvas.style.backfaceVisibility = 'hidden';

        // ——— FIX #4: размер канваса = размер видеопотока (не DPR-экран)
        // Компьютерные шейдеры работают в пространстве пикселей видео, не экрана!
        // Отрисованный результат потом CSS масштабирует до размера окна автоматически
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const targetWidth = Math.round(canvas.clientWidth * window.devicePixelRatio) || videoWidth;
        const targetHeight = Math.round(canvas.clientHeight * window.devicePixelRatio) || videoHeight;

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
        }

        // ——— FIX #1: замораживаем значения реактивных переменных в плоские JS-переменные
        // Это изолирует цикл рендера от реактивности Svelte —
        // переменные читаются один раз при создании пайплайна, а не на каждый кадр rAF
        const _upscaleEnabled = upscaleEnabled;
        const _mode = upscaleSettings.mode;
        const _customStages = upscaleSettings.customPreset?.stages ? [...upscaleSettings.customPreset.stages] : [];

        const nativeDimensions = { width: videoWidth, height: videoHeight };
        const targetDimensions = { width: targetWidth, height: targetHeight };

        window._captureAnime4k = true;
        const instance = await render({
            video,
            canvas,
            pipelineBuilder: (device, inputTexture) => {
                window._anime4kDevice = device;
                if (!_upscaleEnabled) {
                    return [new Original({ device, inputTexture, nativeDimensions, targetDimensions })];
                }

                // Пользовательский пресет (mode 20) — многоэтапный пайплайн
                if (_mode === 20) {
                    if (_customStages.length > 0) {
                        return _customStages.map(stageMode =>
                            new upscaleModeMap[stageMode]({ device, inputTexture, nativeDimensions, targetDimensions })
                        );
                    } else {
                        return [new Original({ device, inputTexture, nativeDimensions, targetDimensions })];
                    }
                }

                // Стандартный одиночный шейдер
                return [new upscaleModeMap[_mode]({ device, inputTexture, nativeDimensions, targetDimensions })];
            },
        });
        window._captureAnime4k = false;

        // Сохраняем инстанс (хоть он и не используется для очистки, флаг нужен)
        currentAnime4kInstance = instance || true;

        // Следим за изменением реального размера канваса через ResizeObserver
        if (canvasResizeObserver) {
            canvasResizeObserver.disconnect();
        }
        canvasResizeObserver = new ResizeObserver(() => {
            // Debounce: пересоздаём пайплайн только через 200мс после окончания ресайза
            if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(() => {
                if (video && video.videoWidth > 0) {
                    renderUpscale();
                }
            }, 200);
        });
        canvasResizeObserver.observe(canvas);
    }

    async function changeQuality(quality) {
        const qualitySrc = args.avaliableQuality[String(quality)]?.src;
        if (!qualitySrc) return;

        const url = URL.canParse(qualitySrc)
            ? qualitySrc
            : `https:${qualitySrc}`;

        if (Hls.isSupported()) {
            const currentTime = video.currentTime;
            const isPausedNow = video.paused;

            hls.detachMedia();
            hls.destroy();

            hls = new Hls();

            hls.on(Hls.Events.BUFFER_APPENDING, (e, data) => {
                loadedPercent =
                    (data.frag._streams.video.endPTS / video.duration) * 100;
            });

            hls.loadSource(url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.currentTime = currentTime;
                if (!isPausedNow) {
                    video.play();
                }
            });
        } else {
            video.src = url;
            video.play();
        }

        // Перезапускаем апскейл только когда видео реально загрузится
        if (avaliableGPU) {
            hls.once(Hls.Events.MANIFEST_PARSED, async () => {
                // Ждём появления метаданных видео
                if (video.videoWidth === 0) {
                    await new Promise(res => { video.addEventListener('loadedmetadata', res, { once: true }); });
                }
                await renderUpscale();
            });
        }

        args.src = url;
        args.currentQuality = quality;
    }

    async function init() {
        mainDiv = await waitForElm(".anidesk-player");
        video = await waitForElm(".player-video");

        if (args.isOffline || args.src.startsWith('anidesk-offline://')) {
            video.src = args.src;
        } else if (Hls.isSupported() && !new URL(args.src).pathname.endsWith(".mp4")) {
            hls = new Hls();

            hls.on(Hls.Events.BUFFER_APPENDING, (e, data) => {
                loadedPercent =
                    (data.frag._streams.video.endPTS / video.duration) * 100;
            });

            hls.loadSource(args.src);
            hls.attachMedia(video);
        } else {
            video.src = args.src;
        }

        if (playerSettings.rememberTime) {
            const timeKey = `${args.release.id}_${args.currentEpisode.position}`;
            if (savedTimes[timeKey]) {
                seekTarget = savedTimes[timeKey];
            } else {
                seekTarget = 0;
            }
        }

        video.volume = playerSettings.saveUserVolume.enabled
            ? (playerSettings.saveUserVolume.lastValue ??
              playerSettings.defaultVolume / 100)
            : playerSettings.defaultVolume / 100;

        volControl = await waitForElm("#volume-position");

        volControl.value = video.volume;
        volPercent = video.volume * 100;

        volControl.oninput = () => {
            video.volume = volControl.value;

            if (playerSettings.saveUserVolume.enabled) {
                playerSettings.saveUserVolume.lastValue = volControl.value;
                playerSettingsRaw.set({ ...playerSettings });
            }
        };

        video.onloadedmetadata = () => {
            loading = true;
            durationTime = utils.returnFormatedTime(video.duration);
            if (seekTarget > 0) {
                video.currentTime = seekTarget;
                seekTarget = 0;
            }
        };

        video.onwaiting = () => {
            loading = true;
        };

        video.onplaying = () => {
            loading = false;
        };

        // Запускаем апскейл только после того, как видео сообщит своё разрешение
        // Это устраняет Race Condition: video.videoWidth > 0 гарантировано
        if (avaliableGPU) {
            video.addEventListener('loadedmetadata', async () => {
                await renderUpscale();
            }, { once: true });
        }

        await video.play();

        window.onwheel = (e) => {
            switch (true) {
                case e.deltaY > 0 && volControl.value > 0:
                    volControl.value = volControl.value - 0.05;
                    video.volume -= 0.05;
                    volPercent = video.volume * 100;
                    break;

                case e.deltaY < 0 && volControl.value < 1:
                    volControl.value = parseFloat(volControl.value) + 0.05;
                    video.volume += 0.05;
                    volPercent = video.volume * 100;
                    break;
            }
        };

        window.onkeydown = (e) => {
            pressedKeys.add(e.code);

            for (const [action, keys] of Object.entries(
                playerSettings.hotkeys,
            )) {
                if (keys.length !== pressedKeys.size) continue;

                if (keys.every((key) => pressedKeys.has(key))) {
                    switch (action) {
                        case "hotkeyPlayPause":
                            isPaused ? video.play() : video.pause();
                            break;

                        case "hotkeyMute":
                            video.muted = !video.muted;
                            break;

                        case "hotkeyFullscreen":
                            isFullscreen
                                ? elecWindow.exitFullscreen()
                                : elecWindow.enterFullscreen();
                            break;

                        case "hotkeyForward":
                            video.currentTime += 10;
                            break;

                        case "hotkeyBackward":
                            video.currentTime -= 10;
                            break;

                        case "hotkeySkipOpening":
                            video.currentTime += 85;
                            break;

                        case "hotkeyNextEpisode":
                            let e =
                                args.episodes[
                                    args.episodes.findIndex(
                                        (x) =>
                                            x.position ==
                                            currentEpisode.position,
                                    ) + 1
                                ];

                            if (e) {
                                currentEpisode = e;
                                playVideo(currentEpisode);
                            }
                            break;

                        case "hotkeyPrevEpisode":
                            let p =
                                args.episodes[
                                    args.episodes.findIndex(
                                        (x) =>
                                            x.position ==
                                            currentEpisode.position,
                                    ) - 1
                                ];

                            if (p) {
                                currentEpisode = p;
                                playVideo(currentEpisode);
                            }
                            break;
                    }

                    pressedKeys.clear();
                    break;
                }
            }

            switch (e.code) {
                case "Escape":
                    if (isFullscreen) {
                        elecWindow.exitFullscreen();
                    }
                    if (args.isOffline) {
                        updateViewportComponent(13); // back to Offline page
                    } else {
                        updateViewportComponent(8, { id: args.release.id });
                    }
                    break;
            }
        };

        window.onkeyup = (e) => {
            pressedKeys.delete(e.code);
        };

        // Очищаем массив нажатых клавиш при потере фокуса окна, чтобы небыло проблем
        // когда клавиша осталась в массиве из-за чего хоткеи перестают работать
        window.onblur = () => {
            pressedKeys.clear();
        }

        durationTime = utils.returnFormatedTime(video.duration);
        startTimestamp = Date.now();

        video.onpause = () => {
            isPaused = true;
            loading = false;

            let ep = currentEpisode || args.currentEpisode;
            if (playerSettings.rememberTime && ep && video.duration - video.currentTime > 10) {
                const timeKey = `${args.release.id}_${ep.position}`;
                savedTimes[timeKey] = video.currentTime;
                savedTimesRaw.set({ ...savedTimes });
            }

            if (!args.isOffline) {
                discordRPC.setActivity({
                    type: 3,
                    state: `${ep?.name || ''}`,
                    details: args.release.title_ru.slice(0, 127),
                    largeImageKey: "anidesk-transparent",
                    largeImageText: "AniDesk - Anixart Client",
                    instance: true,
                    buttons: [
                        {
                            label: "Ссылка на релиз",
                            url: `https://anixart.app/release/${args.release.id}`,
                        },
                        {
                            label: "Ссылка на клиент",
                            url: "https://anidesk.ds1nc.ru/",
                        },
                    ],
                });
            }
        };

        video.onplay = (e) => {
            isPaused = false;
            loading = false;

            startTimestamp = Date.now();
            const ep = currentEpisode || args.currentEpisode;

            if (!args.isOffline) {
                discordRPC.setActivity({
                    type: 3,
                    state: `${ep?.name || ''}`,
                    details: args.release.title_ru.slice(0, 127),
                    largeImageKey: "anidesk-transparent",
                    largeImageText: "AniDesk - Anixart Client",
                    startTimestamp: startTimestamp - video.currentTime * 1000,
                    endTimestamp:
                        startTimestamp +
                        (video.duration - video.currentTime) * 1000,
                    instance: true,
                    buttons: [
                        {
                            label: "Ссылка на релиз",
                            url: `https://anixart.tv/release/${args.release.id}`,
                        },
                        {
                            label: "Ссылка на клиент",
                            url: "https://anidesk.ds1nc.ru/",
                        },
                    ],
                });
            }
        };

        video.onended = async () => {
            let ep = currentEpisode || args.currentEpisode;
            if (playerSettings.rememberTime && ep) {
                const timeKey = `${args.release.id}_${ep.position}`;
                if (savedTimes[timeKey]) {
                    delete savedTimes[timeKey];
                    savedTimesRaw.set({ ...savedTimes });
                }
            }

            if (playerSettings.autoplayEpisode) {
                const nextEp = args.episodes.find(
                    (x) => x.position == (ep?.position ?? -1) + 1,
                );

                if (nextEp) {
                    currentEpisode = nextEp;
                    await playVideo(currentEpisode);
                }
            }
        };

        // Обработчик ошибки загрузки видео
        video.onerror = () => {
            loading = false;
            console.error('Video load error:', video.error?.message);
        };

        video.ontimeupdate = () => {
            currentTime = utils.returnFormatedTime(video.currentTime);
            progressPercent = (video.currentTime / video.duration) * 100;
        };

        // Guard: для оффлайн-режима source — заглушка, пропускаем
        let source;
        if (!args.isOffline) {
            source =
                typeof args.currentEpisode.source == "number"
                    ? args.episodes.find(
                          (x) => args.currentEpisode.source == x.source["@id"],
                      )?.source
                    : args.currentEpisode.source;
        }

        if (!args.isOffline) {
            analytics.trackEvent("play_anime", {
                source: source.name,
                name: args.currentEpisode.name,
                releaseTitle: args.release.title_ru,
                dubber: source.type.name,
            });
        }

        if (!args.isOffline) {
            const ep = currentEpisode || args.currentEpisode;
            discordRPC.setActivity({
                type: 3,
                state: `${ep?.name || ''}`,
                details: args.release.title_ru.slice(0, 127),
                largeImageKey: "anidesk-transparent",
                largeImageText: "AniDesk - Anixart Client",
                startTimestamp: startTimestamp - video.currentTime * 1000,
                endTimestamp:
                    startTimestamp + (video.duration - video.currentTime) * 1000,
                instance: true,
                buttons: [
                    {
                        label: "Ссылка на релиз",
                        url: `https://anixart.tv/release/${args?.release?.id || ''}`,
                    },
                    { label: "Ссылка на клиент", url: "https://anidesk.ds1nc.ru/" },
                ],
            });
        }
    }

</script>

<div class="anidesk-player full">
    <PlayerGui
        {playVideo}
        {args}
        {isHidden}
        {isFullscreen}
        {isPaused}
        {video}
        {progressPercent}
        {loadedPercent}
        {currentTime}
        {durationTime}
        bind:cEpisode={currentEpisode}
        transparentPercent={playerSettings.opacityInterface}
        {changeQuality}
        {changeUpscale}
        {upscaleEnabled}
        {changeAspectRatio}
        aspectRatio={utils.aspectRatioValues.find(
            (x) => x.value == playerSettings.defaultAspectRatio,
        ).label}
        bind:volumePercent={volPercent}
    />

    <span class:hide={!loading} class="loader"></span>

    {#if avaliableGPU}
        <canvas
            class="player-canvas {aspectRatio}"
            width={screen.width}
            height={screen.height}
        ></canvas>
    {/if}
    <video
        class="player-video"
        crossorigin="anonymous"
        class:full={!avaliableGPU}
        class:hide={avaliableGPU}
    ></video>
</div>

<style>
    .full {
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    .loader {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 30px;
        height: 30px;
        border: 3px solid var(--player-timeline-progress-color);
        border-bottom-color: transparent;
        border-radius: 50%;
        display: inline-block;
        box-sizing: border-box;
        animation: rotation 1s linear infinite;
        z-index: 1;
    }

    @keyframes rotation {
        0% {
            transform: translate(-50%, -50%) rotate(0deg);
        }
        100% {
            transform: translate(-50%, -50%) rotate(360deg);
        }
    }

    canvas,
    video {
        cursor: none;
    }

    .player-canvas {
        height: 100%;
        overflow: hidden;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
    }

    .aspect-16-9 {
        aspect-ratio: 16 / 9;
    }

    .aspect-4-3 {
        aspect-ratio: 4 / 3;
    }

    .aspect-fit {
        width: 100%;
    }

    .anidesk-player {
        background-color: black;
    }
</style>
