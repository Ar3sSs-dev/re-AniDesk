<script>
    import Preloader from "../gui/Preloader.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import { AniLibriaParser, KodikParser } from "anixartjs";
    import { localStorageWritable } from "@babichjacob/svelte-localstorage";
    import DropdownButton from "../buttons/DropdownButton.svelte";
    import Icon from "../elements/Icon.svelte";
    import DownloadIcon from "../../icons/download.svg";
    import { downloadProgressStore } from "../stores/downloadProgressStore";

    const dispatch = createEventDispatcher();

    export let args;
    export let showed;

    $: progresses = $downloadProgressStore;

    let currentDubberId,
        currentSourceId,
        currentSourceName,
        playingSettings,
        downloadSettings,
        episodes;

    let dubberList = [];
    let backgroundModal = document.querySelector(".modal-background");

    let offlineLibrary = [];

    onMount(async () => {
        try {
            offlineLibrary = await offlineApi.getLibrary();
        } catch (e) {
            console.error("Failed to load offline library", e);
        }
    });

    let sourceList = {
        sources: [],
    };

    const playingSettingsRaw = localStorageWritable(
        "playingSettings",
        utils.playingDefaultSettings,
    );

    const downloadSettingsRaw = localStorageWritable(
        "downloadSettings",
        utils.downloadDefaultSettings,
    );

    playingSettingsRaw.subscribe((value) => {
        playingSettings = value;
    });

    downloadSettingsRaw.subscribe((value) => {
        downloadSettings = value;
    });

    let favoriteSourceName = utils.sourceValues.find(
        (x) => x.value === playingSettings?.defaultSource,
    ).label;

    anixApi.release.getDubbers(args.id).then((v) => {
        if (!v.types?.length) return; // guard: no dubbers
        dubberList = v.types.map((x) => ({
            label: x.name,
            value: x.id,
            icon:
                x.icon == "" || !x.icon
                    ? "./assets/icons/defaultDubber.svg"
                    : x.icon,
            description: `${x.view_count} просмотров | ${x.episodes_count} эпизодов`,
        }));
        
        let matchedDubber = dubberList.find(
            (x) => x.label === playingSettings?.lastDubberName
        );
        const defaultDubberId = matchedDubber ? matchedDubber.value : v.types[0].id;
        selectDubber(defaultDubberId);
    });

    async function selectDubber(id) {
        currentDubberId = id;

        episodes = null;

        sourceList = await anixApi.release.getDubberSources(
            args.id,
            currentDubberId,
        );

        if (!sourceList.sources?.length) {
            currentSourceId = null;
            currentSourceName = '';
            episodes = null;
            return sourceList;
        }

        const dubName = dubberList.find((x) => x.value === id)?.label;
        if (dubName) {
            playingSettings.lastDubberName = dubName;
            playingSettingsRaw.set({ ...playingSettings });
        }

        let matchedSource = sourceList.sources.find(
            (x) => x.name === playingSettings?.lastSourceName
        ) || sourceList.sources.find(
            (x) => x.name === favoriteSourceName
        );

        currentSourceId = !matchedSource
            ? sourceList.sources[0].id
            : matchedSource.id;

        currentSourceName = !matchedSource
            ? sourceList.sources[0].name
            : matchedSource.name;

        episodes = getEpisodes();

        return sourceList;
    }

    function selectSource(src) {
        currentSourceId = src;
        const srcObj = sourceList.sources.find((x) => x.id == src);
        if (srcObj) {
            currentSourceName = srcObj.name;
            playingSettings.lastSourceName = currentSourceName;
            playingSettingsRaw.set({ ...playingSettings });
        }
    }

    function setTitle(title) {
        dispatch("setTitle", title);
    }

    async function getEpisodes() {
        return await anixApi.release.getEpisodes(
            args.id,
            currentDubberId,
            currentSourceId,
        );
    }

    /**
     * Picks the best available URL from a quality map for downloading.
     * Tries the desired quality first, then falls back to nearest lower available.
     * availableQuality: { "1080": { src }, "720": { src }, ... }
     */
    function pickDownloadQuality(availableQuality) {
        const desired = downloadSettings?.defaultQuality ?? 720;
        const orderedKeys = [1080, 720, 480, 360];

        // Try exact match first
        if (availableQuality[String(desired)]?.src) {
            return availableQuality[String(desired)].src;
        }

        // Find nearest lower quality
        const desiredIdx = orderedKeys.indexOf(desired);
        for (let i = desiredIdx + 1; i < orderedKeys.length; i++) {
            const key = String(orderedKeys[i]);
            if (availableQuality[key]?.src) return availableQuality[key].src;
        }

        // Fallback: any available
        for (const key of orderedKeys) {
            if (availableQuality[String(key)]?.src) return availableQuality[String(key)].src;
        }

        // Last resort: first key
        const firstKey = Object.keys(availableQuality)[0];
        return availableQuality[firstKey]?.src ?? null;
    }
</script>

{#snippet baseCard(x, clickCallback, downloadCallback)}
    {@const progress = progresses[`${args.id}_${x.position}`]}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="base-card" onclick={clickCallback}>
        <div class="base-card-name">
            {x.name}
        </div>
        <div class="right-menu flex-row">
            {#if x.is_watched}
                <img src="./assets/icons/checkmark.svg" alt="check" />
            {/if}
            <button class="download-btn" onclick={async (e) => { 
                e.stopPropagation();
                const btn = e.currentTarget;
                if (btn.disabled) return;
                btn.disabled = true; // Заблокируем двойной клик сразу до любых проверок
                
                if (progress === 100) {
                    if (confirm("Вы действительно хотите удалить эту скачанную серию?")) {
                        await offlineApi.deleteEpisode(args.id, x.position);
                        downloadProgressStore.update(s => { delete s[`${args.id}_${x.position}`]; return { ...s }; });
                        btn.disabled = false;
                    } else {
                        // Пользователь отменил — разблокируем кнопку, иначе она останется серой навсегда
                        btn.disabled = false;
                    }
                    return;
                } else if (progress === -2 || (progress >= 0 && progress < 100)) {
                    await offlineApi.cancelDownload(args.id, x.position);
                    downloadProgressStore.update(s => { delete s[`${args.id}_${x.position}`]; return { ...s }; });
                    btn.disabled = false;
                    return;
                }

                const originalHtml = btn.innerHTML;
                try {
                    const started = await downloadCallback(); 
                    if (started && progress === undefined) {
                        downloadProgressStore.update(s => ({...s, [`${args.id}_${x.position}`]: -2}));
                    } else if (!started && progress === undefined) {
                        btn.innerHTML = '<span style="color: #FFC107; font-size: 14px; font-weight: bold; margin-right: 5px;">Уже в процессе</span>';
                        setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 2000);
                        return;
                    }
                } catch(err) {
                    btn.innerHTML = '<span style="color: #F44336; font-size: 14px; font-weight: bold; margin-right: 5px;">Ошибка</span>';
                    setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 2000);
                    return;
                }
                btn.disabled = false;
            }} title="Скачать / Отменить / Удалить">
                {#if progress >= 0 && progress < 100}
                    <span style="color: #4CAF50; font-size: 14px; font-weight: bold; margin-right: 5px;">Загрузка: {Math.round(progress)}%</span>
                {:else if progress === -2}
                    <span style="color: #FFC107; font-size: 14px; font-weight: bold; margin-right: 5px;">В очереди</span>
                {:else if progress === 100}
                    <img src="./assets/icons/checkmark.svg" alt="check" />
                {:else if progress === -1}
                    <span style="color: #F44336; font-size: 14px; font-weight: bold; margin-right: 5px;">Ошибка</span>
                {:else}
                    <Icon src={DownloadIcon} size={{width: 20, height: 20}} varColor="--main-text-color" />
                {/if}
            </button>
        </div>
    </div>
{/snippet}

<div class="modal-title">
    <span class="title">Выбор эпизода</span>
    <div class="modal-buttons flex-row">
        <DropdownButton
            placeholder="Озвучка"
            bind:values={dubberList}
            value={currentDubberId}
            onChange={(e, v) => {
                selectDubber(v);
            }}
            height={35}
            width={280}
            outsideElement={backgroundModal}
        />
        <DropdownButton
            placeholder="Источник"
            values={sourceList.sources.map((x) => ({
                label: x.name,
                value: x.id,
                description: `${x.episodes_count} эпизодов`,
            }))}
            value={currentSourceId}
            onChange={(e, v) => {
                selectSource(v);
                episodes = getEpisodes();
            }}
            height={35}
            width={150}
            outsideElement={backgroundModal}
        />
    </div>
</div>
<div class="modal-content">
    {#key currentSourceId}
        {#if episodes}
            {#await episodes}
                <div class="center">
                    <Preloader />
                </div>
            {:then i}
                {#each i.episodes as d}
                    {@render baseCard(d, () => {
                        // Check offline first (local check is very fast)
                        let isOffline = false;
                        let offlineUrl = "";
                        try {
                            const anime = offlineLibrary.find(a => a.id === args.id);
                            if (anime) {
                                const ep = anime.episodes.find(e => e.id === d.position);
                                if (ep) {
                                    isOffline = true;
                                    const hexPath = Array.from(new TextEncoder().encode(ep.filePath)).map(b => b.toString(16).padStart(2, '0')).join('');
                                    offlineUrl = `anidesk-offline://${hexPath}`;
                                }
                            }
                        } catch(e) {}

                        if (isOffline) {
                            updateViewportComponent(11, {
                                src: offlineUrl,
                                currentQuality: 720,
                                avaliableQuality: { "720": { src: offlineUrl } },
                                release: args,
                                episodes: i.episodes,
                                currentEpisode: d,
                                isOffline: true
                            });
                        } else {
                            // Transition IMMEDIATELY! Player.svelte will load streams asynchronously.
                            updateViewportComponent(11, {
                                release: args,
                                episodes: i.episodes,
                                currentEpisode: d,
                            });
                        }
                    }, async () => {
                        let avaliableQuality, link;
                        switch (currentSourceName) {
                            case "Kodik":
                                let aQ = {};
                                const kLinks = await KodikParser.getDirectLinks(d.url);
                                for (const [key, value] of Object.entries(kLinks)) { aQ[key] = { src: value[0].src }; }
                                avaliableQuality = aQ; break;
                            case "Liberty":
                            case "Libria":
                                avaliableQuality = await AniLibriaParser.getDirectLinks(d.url); break;
                            case "Sibnet":
                                await utils.fallback(async () => {
                                    const link = await Sibnet.Parse(d.url);
                                    if (!link) return false;
                                    avaliableQuality = { "720": { src: link } };
                                    return true;
                                }, 3); break;
                        }
                        const rawUrl = pickDownloadQuality(avaliableQuality);
                        if (!rawUrl) throw new Error("Не удалось получить ссылку на видео");
                        const realUrl = URL.canParse(rawUrl) ? rawUrl : `https:${rawUrl}`;
                        return offlineApi.downloadEpisode(
                            { id: args.id, title: args.title_ru || args.name_ru || args.name || args.title, image: args.image },
                            { id: d.position, title: d.name },
                            realUrl
                        );
                    })}
                {/each}
            {/await}
        {:else}
            <div class="center">
                <Preloader />
            </div>
        {/if}
    {/key}
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }

    .modal-buttons {
        width: fit-content;
        margin-right: 25px;
        gap: 10px;
    }

    .modal-title {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }

    .base-card {
        display: flex;
        flex-direction: row;
        align-items: center;
        cursor: pointer;
        height: 40px;
        min-height: 40px;
        border-radius: 7px;
    }

    .base-card:hover {
        background-color: var(--select-button-color);
    }

    .base-card-name {
        margin-left: 10px;
        font-size: 18px;
        font-weight: bold;
        color: var(--main-text-color);
        display: flex;
        flex-direction: column;
    }

    .right-menu {
        margin-left: auto;
        margin-right: 0;
        justify-items: center;
        align-items: center;
        gap: 10px;
        padding-right: 10px;
    }

    .download-btn {
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5px;
        border-radius: 50%;
        transition: background-color 0.2s;
    }

    .download-btn:hover {
        background-color: var(--background-color);
    }
</style>
