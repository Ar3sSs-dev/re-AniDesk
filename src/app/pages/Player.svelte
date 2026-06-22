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

    let defaultCanvasSize = {
        width: screen.width,
        height: screen.height,
    };

    let video,
        canvas,
        timePos,
        volControl,
        timeout,
        mainDiv,
        hls,
        currentEpisode,
        startTimestamp,
        videoAspect = 16 / 9;

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

    const upscaleSettingsRaw = localStorageWritable(
        "upscaleSettings",
        utils.upscaleDefaultSettings,
    );

    upscaleSettingsRaw.subscribe((value) => {
        upscaleSettings = value;
    });

    let savedTimes;
    const savedTimesRaw = localStorageWritable(
        "savedVideoTimes",
        {},
    );

    savedTimesRaw.subscribe((value) => {
        savedTimes = value;
    });

    let upscaleEnabled = upscaleSettings.enabled;

    async function changeUpscale(enabled) {
        upscaleEnabled = enabled;
        await renderUpscale();
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
        try {
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
            let source = episode.source;
            if (!source && args.episodes?.[0]?.source) {
                source = args.episodes[0].source;
            }
            if (typeof source === "number") {
                const found = args.episodes.find((x) => x.source && (x.source["@id"] == source || x.source.id == source));
                source = found ? found.source : null;
            }

            if (!source) {
                console.error("Episode source not found in episodes list");
                loading = false;
                return;
            }

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

            if (!avaliableQuality) {
                throw new Error("No video quality links resolved");
            }

            const url =
                avaliableQuality[String(playingSettings.defaultQuality)]?.src ??
                avaliableQuality["720"]?.src;

            if (!url) {
                throw new Error("No valid quality URL found");
            }

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

            if (source) {
                analytics.trackEvent("play_anime", {
                    source: source.name || "Unknown",
                    name: episode.name,
                    releaseTitle: args.release.title_ru,
                    dubber: source.type?.name || "Unknown",
                });
            }

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
        } catch (e) {
            console.error("Error in playVideo:", e);
            loading = false;
        }
    }

    async function renderUpscale() {
        canvas = await waitForElm(".player-canvas");
        await render({
            video,
            canvas,
            pipelineBuilder: (device, inputTexture) => {
                const nativeDimensions = {
                    width: video.videoWidth,
                    height: video.videoHeight,
                };

                const targetDimensions = {
                    width: defaultCanvasSize.width,
                    height: defaultCanvasSize.height,
                };

                return [
                    upscaleEnabled
                        ? new upscaleModeMap[upscaleSettings.mode]({
                              device,
                              inputTexture,
                              nativeDimensions,
                              targetDimensions,
                          })
                        : new Original({
                              device,
                              inputTexture,
                              nativeDimensions,
                              targetDimensions,
                          }),
                ];
            },
        });
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

        if (avaliableGPU) await renderUpscale();

        args.src = url;
        args.currentQuality = quality;
    }

    async function init() {
        mainDiv = await waitForElm(".anidesk-player");
        video = await waitForElm(".player-video");

        currentEpisode = args.currentEpisode;

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
            videoAspect = video.videoWidth / video.videoHeight;
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

        video.onerror = () => {
            loading = false;
            console.error('Video load error:', video.error?.message);
        };

        video.ontimeupdate = () => {
            currentTime = utils.returnFormatedTime(video.currentTime);
            progressPercent = (video.currentTime / video.duration) * 100;
        };

        let source;
        if (!args.isOffline) {
            source = args.currentEpisode.source;
            if (typeof source === "number") {
                const found = args.episodes.find(
                    (x) => x.source && (x.source["@id"] == source || x.source.id == source)
                );
                source = found ? found.source : null;
            }
        }

        if (!args.isOffline && source) {
            analytics.trackEvent("play_anime", {
                source: source.name || "Unknown",
                name: args.currentEpisode.name,
                releaseTitle: args.release.title_ru,
                dubber: source.type?.name || "Unknown",
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

        // If src is already provided, load it, otherwise fetch dynamically
        if (args.src) {
            if (args.isOffline || args.src.startsWith('anidesk-offline://')) {
                video.src = args.src;
            } else if (Hls.isSupported() && !new URL(args.src).pathname.endsWith(".mp4")) {
                hls = new Hls();
                hls.on(Hls.Events.BUFFER_APPENDING, (e, data) => {
                    loadedPercent = (data.frag._streams.video.endPTS / video.duration) * 100;
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

            if (avaliableGPU) await renderUpscale();
            try {
                await video.play();
            } catch (e) {
                console.error("Failed to play video automatically", e);
            }

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
        } else {
            // Fetch dynamically on first load
            try {
                await playVideo(currentEpisode);
            } catch (e) {
                console.error("Failed to load video on init", e);
                loading = false;
            }
        }
    }

</script>

<div class="anidesk-player full" style="--video-aspect: {videoAspect};">
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
        class="player-video {aspectRatio}"
        crossorigin="anonymous"
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

    .player-canvas,
    .player-video {
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

    .aspect-original {
        aspect-ratio: var(--video-aspect);
    }

    .anidesk-player {
        background-color: black;
    }
</style>
