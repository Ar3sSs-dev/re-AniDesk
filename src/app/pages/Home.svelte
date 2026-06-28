<script>
    import AnimeColumnCard from "../components/elements/AnimeColumnCard.svelte";
    import MetaInfo from "../components/gui/MetaInfo.svelte";
    import Preloader from "../components/gui/Preloader.svelte";
    import Icon from "../components/elements/Icon.svelte";
    import filterIcon from "../icons/filter.svg";
    import BaseModal from "../components/modal/BaseModal.svelte";
    import MyFeedSettingsModal from "../components/modal/MyFeedSettingsModal.svelte";
    import BaseMainButton from "../components/buttons/BaseMainButton.svelte";
    import { fade } from "svelte/transition";
    import { pageCache } from "../components/stores/pageCache.js";
    import { get } from "svelte/store";
    import { onDestroy } from "svelte";

    export let args;
    let page = 0;
    let filterArgs = { sort: 0, status_id: null, category_id: null };
    let allData = [];
    let firstData = null;
    let updateInfo = false;

    // Состояние фильтра «Моей вкладки»
    let isMyFeedConfigured = false;
    let myFeedFilter = null;
    let showSettingsModal = false;

    function checkMyFeedConfig() {
        const saved = localStorage.getItem("myTabFilterSettings");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                myFeedFilter = parsed;
                // Считаем фильтр настроенным, если хотя бы одно поле отличается от дефолтного
                isMyFeedConfigured = !!(
                    parsed.country || 
                    parsed.category_id !== null || 
                    parsed.status_id !== null || 
                    parsed.genres?.length || 
                    parsed.start_year || 
                    parsed.end_year || 
                    parsed.studio || 
                    parsed.profile_list_exclusions?.length
                );
            } catch (e) {
                isMyFeedConfigured = false;
            }
        } else {
            isMyFeedConfigured = false;
        }
    }

    function loadMyFeedData(isFirst = false) {
        checkMyFeedConfig();
        if (!isMyFeedConfigured) {
            firstData = Promise.resolve({ content: [], total_count: 0 });
            return;
        }

        const apiFilter = {
            sort: myFeedFilter.sort
        };
        if (myFeedFilter.country) apiFilter.country = myFeedFilter.country;
        if (myFeedFilter.category_id !== null) apiFilter.category_id = myFeedFilter.category_id;
        if (myFeedFilter.status_id !== null) apiFilter.status_id = myFeedFilter.status_id;
        if (myFeedFilter.genres && myFeedFilter.genres.length > 0) apiFilter.genres = myFeedFilter.genres;
        if (myFeedFilter.profile_list_exclusions && myFeedFilter.profile_list_exclusions.length > 0) {
            apiFilter.profile_list_exclusions = myFeedFilter.profile_list_exclusions;
        }
        if (myFeedFilter.start_year) apiFilter.start_year = parseInt(myFeedFilter.start_year);
        if (myFeedFilter.end_year) apiFilter.end_year = parseInt(myFeedFilter.end_year);
        if (myFeedFilter.episodes_from) apiFilter.episodes_from = parseInt(myFeedFilter.episodes_from);
        if (myFeedFilter.episodes_to) apiFilter.episodes_to = parseInt(myFeedFilter.episodes_to);
        if (myFeedFilter.studio) apiFilter.studio = myFeedFilter.studio;

        const req = anixApi.release.filter(page, apiFilter, true);
        if (isFirst) {
            firstData = req;
        } else {
            req.then(data => {
                allData = allData.concat(data.content);
                updateInfo = false;
            });
        }
    }

    async function getMainPage() {
        if (args.typeReleases === 0) {
            loadMyFeedData(false);
        } else {
            const data = await anixApi.release.filter(page, filterArgs, true);
            allData = allData.concat(data.content);
            updateInfo = false;
        }
    }

    function initFilterArgs(type) {
        switch (type) {
            case 1: // Последние
                filterArgs = { sort: 0, status_id: null, category_id: null };
                break;
            case 2: // Онгоинги
                filterArgs = { sort: 0, status_id: 2, category_id: null };
                break;
            case 3: // Анонсы
                filterArgs = { sort: 0, status_id: 3, category_id: null };
                break;
            case 4: // Завершенные
                filterArgs = { sort: 0, status_id: 1, category_id: null };
                break;
            case 5: // Фильмы
                filterArgs = { sort: 0, status_id: null, category_id: 2 };
                break;
        }
    }

    let firstDataResolved = null;
    $: if (firstData && typeof firstData.then === 'function') {
        firstData.then(data => {
            firstDataResolved = data;
        });
    } else if (firstData) {
        firstDataResolved = firstData;
    }

    function setReleasesType(type) {
        if (args.typeReleases === type) return;
        let viewport = document.getElementById("viewport");

        if (typeof window.cancelActiveRequests === 'function') {
            window.cancelActiveRequests();
        }

        if (firstDataResolved) {
            pageCache.update(cache => {
                cache[`Home_${args.typeReleases}`] = {
                    page,
                    allData,
                    firstDataResolved,
                    filterArgs,
                    isMyFeedConfigured,
                    myFeedFilter
                };
                return cache;
            });
        }

        args.typeReleases = type;
        page = 0;
        allData = [];

        const cacheKey = `Home_${type}`;
        const cached = get(pageCache)[cacheKey];
        if (cached) {
            page = cached.page;
            allData = cached.allData;
            firstData = Promise.resolve(cached.firstDataResolved);
            firstDataResolved = cached.firstDataResolved;
            filterArgs = cached.filterArgs;
            isMyFeedConfigured = cached.isMyFeedConfigured;
            myFeedFilter = cached.myFeedFilter;
        } else {
            if (type === 0) {
                loadMyFeedData(true);
            } else {
                initFilterArgs(type);
                firstData = anixApi.release.filter(page, filterArgs, true);
            }
        }
        viewport.scrollTop = 0;
    }

    // Инициализация при старте
    if (args.typeReleases === undefined) {
        args.typeReleases = 0;
    }

    const cacheKey = `Home_${args.typeReleases}`;
    const cached = get(pageCache)[cacheKey];
    if (cached) {
        page = cached.page;
        allData = cached.allData;
        firstData = Promise.resolve(cached.firstDataResolved);
        firstDataResolved = cached.firstDataResolved;
        filterArgs = cached.filterArgs;
        isMyFeedConfigured = cached.isMyFeedConfigured;
        myFeedFilter = cached.myFeedFilter;
    } else {
        if (args.typeReleases === 0) {
            loadMyFeedData(true);
        } else {
            initFilterArgs(args.typeReleases);
            firstData = anixApi.release.filter(page, filterArgs, true);
        }
    }

    onDestroy(() => {
        if (firstDataResolved) {
            pageCache.update(cache => {
                cache[`Home_${args.typeReleases}`] = {
                    page,
                    allData,
                    firstDataResolved,
                    filterArgs,
                    isMyFeedConfigured,
                    myFeedFilter
                };
                return cache;
            });
        }
    });

    setViewportScrollEvent(async (e) => {
        if (
            e.target.scrollTop >= e.target.scrollHeight - 2000 &&
            !updateInfo
        ) {
            updateInfo = true;
            page++;
            await getMainPage();
        }
    });
</script>

<MetaInfo subTitle="Главная" />

<div class="releases-type flex-row">
    {#if args?.typeReleases === 0}
        <button
            class="releases-filter-btn flex-column justify-center align-center"
            onclick={() => showSettingsModal = true}
            title="Настройки вкладки"
            transition:fade={{ duration: 150 }}
        >
            <Icon src={filterIcon} size={{ width: 22, height: 22 }} varColor="--main-text-color" />
        </button>
    {/if}

    <button
        class="releases-type-title flex-column"
        class:selected={args?.typeReleases == 0}
        onclick={() => setReleasesType(0)}>Моя вкладка</button
    >
    <button
        class="releases-type-title flex-column"
        class:selected={args?.typeReleases == 1}
        onclick={() => setReleasesType(1)}>Последние</button
    >
    <button
        class="releases-type-title flex-column"
        class:selected={args?.typeReleases == 2}
        onclick={() => setReleasesType(2)}>Онгоинги</button
    >
    <button
        class="releases-type-title flex-column"
        class:selected={args?.typeReleases == 3}
        onclick={() => setReleasesType(3)}>Анонсы</button
    >
    <button
        class="releases-type-title flex-column"
        class:selected={args?.typeReleases == 4}
        onclick={() => setReleasesType(4)}>Завершенные</button
    >
    <button
        class="releases-type-title flex-column"
        class:selected={args?.typeReleases == 5}
        onclick={() => setReleasesType(5)}>Фильмы</button
    >
</div>

<div class="releases-container flex-column">
    {#if args.typeReleases === 0 && !isMyFeedConfigured}
        <div class="my-tab-placeholder flex-column align-center justify-center">
            <div class="placeholder-image-container">
                <!-- Стилизованная CSS-иллюстрация вместо тяжелой картинки -->
                <svg viewBox="0 0 100 100" class="placeholder-svg-art">
                    <circle cx="50" cy="45" r="25" fill="none" stroke="var(--rate-back-color)" stroke-width="3" />
                    <line x1="50" y1="20" x2="50" y2="70" stroke="var(--rate-back-color)" stroke-width="3" />
                    <line x1="25" y1="45" x2="75" y2="45" stroke="var(--rate-back-color)" stroke-width="3" />
                    <circle cx="50" cy="45" r="8" fill="var(--main-text-color)" />
                </svg>
            </div>
            <span class="placeholder-title">Это ваша вкладка</span>
            <span class="placeholder-desc">Настройте её под себя и укажите,<br>что хотели бы здесь видеть</span>
            <BaseMainButton style="primary" width="160px" height="38" onClickCallback={() => showSettingsModal = true}>Настроить</BaseMainButton>
        </div>
    {:else}
        {#await firstData}
            <Preloader />
        {:then Releases}
            {#if args.typeReleases === 0 && (!Releases.content || (Releases.content.length === 0 && allData.length === 0))}
                <div class="my-tab-placeholder flex-column align-center justify-center">
                    <span class="placeholder-title">Ничего не найдено</span>
                    <span class="placeholder-desc">Попробуйте изменить настройки фильтра</span>
                    <BaseMainButton style="primary" width="160px" height="38" onClickCallback={() => showSettingsModal = true}>Настроить</BaseMainButton>
                </div>
            {:else}
                <div class="cards-grid">
                    {#each Releases.content as Release}
                        <AnimeColumnCard anime={Release} />
                    {/each}
                    {#each allData as Release}
                        <AnimeColumnCard anime={Release} />
                    {/each}
                </div>
            {/if}
        {:catch error}
            <div class="my-tab-placeholder flex-column align-center justify-center">
                <span class="placeholder-title">Ошибка загрузки</span>
                <span class="placeholder-desc">{error.message === 'Timeout' ? 'Превышено время ожидания ответа от сервера (Timeout)' : error.message}</span>
                <BaseMainButton style="primary" width="160px" height="38" onClickCallback={() => {
                    page = 0;
                    allData = [];
                    if (args.typeReleases === 0) {
                        loadMyFeedData(true);
                    } else {
                        firstData = anixApi.release.filter(page, filterArgs, true);
                    }
                }}>Повторить</BaseMainButton>
            </div>
        {/await}
    {/if}
</div>

{#if showSettingsModal}
    <BaseModal
        modalComponent={MyFeedSettingsModal}
        canCloseOnBackground={true}
        showed={showSettingsModal}
        modalSize={{ width: "800px", height: "600px" }}
        on:closeModal={() => showSettingsModal = false}
        on:apply={() => {
            page = 0;
            allData = [];
            loadMyFeedData(true);
        }}
    />
{/if}

<style>
    .releases-container {
        width: 100%;
        height: 100%;
        position: relative;
    }

    .releases-type {
        width: 100%;
        height: 50px;
        margin-top: 20px;
        justify-content: center;
        align-items: center;
        position: sticky;
        top: 0;
        background-color: var(--background-color);
        z-index: 1;
        border-bottom: 1px solid var(--rate-back-color);
    }

    .releases-filter-btn {
        position: absolute;
        left: 20px;
        top: 14px;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        background-color: transparent;
        border: none;
        padding: 0;
        box-sizing: border-box;
        cursor: pointer;
        transition: background-color 0.2s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        will-change: transform;
    }

    .releases-filter-btn:hover {
        background-color: var(--alt-gray-background-color);
        transform: scale(1.15);
    }

    .releases-filter-btn:hover :global(svg) {
        filter: drop-shadow(0 0 8px var(--main-text-color));
    }

    .releases-type-title {
        height: 100%;
        padding-left: 20px;
        padding-right: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: var(--third-text-color);
        transition: color 0.3s ease, text-shadow 0.3s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-weight: 500;
        font-size: 16px;
        position: relative;
        will-change: transform;
    }

    .releases-type-title:hover {
        cursor: pointer;
        color: var(--main-text-color);
        text-shadow: 0 0 10px var(--main-text-color);
        transform: scale(1.1);
    }

    .selected {
        font-weight: bold;
        color: var(--main-text-color);
        text-shadow: 0 0 10px var(--main-text-color);
        transform: scale(1.1);
    }

    .selected:hover {
        cursor: default;
    }

    /* Стили заглушки «Моей вкладки» */
    .my-tab-placeholder {
        margin-top: 80px;
        text-align: center;
        gap: 15px;
        width: 100%;
        align-items: center;
    }

    .placeholder-image-container {
        width: 120px;
        height: 120px;
        margin-bottom: 10px;
    }

    .placeholder-svg-art {
        width: 100%;
        height: 100%;
        opacity: 0.8;
    }

    .placeholder-title {
        font-size: 24px;
        font-weight: bold;
        color: var(--main-text-color);
    }

    .placeholder-desc {
        font-size: 16px;
        color: var(--secondary-text-color);
        line-height: 24px;
        margin-bottom: 10px;
    }

    .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 20px;
        padding: 20px;
    }

    @keyframes line-grow {
        0% {
            width: 0;
            left: 50%;
        }
        100% {
            width: 100%;
            left: 0;
        }
    }
</style>
