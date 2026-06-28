<script>
    import { anixApi } from '../lib/stores/api.store.js';
    import TitleBar from "./components/gui/TitleBar.svelte";
    import LeftMenu from "./components/gui/LeftMenu.svelte";
    import HomePage from "./pages/Home.svelte";
    import { Anixart } from "anixartjs";
    import MetaInfo from "./components/gui/MetaInfo.svelte";
    import Utils from "./utils";
    import { localStorageWritable } from "@babichjacob/svelte-localstorage";
    import BaseModal from "./components/modal/BaseModal.svelte";
    import FirstRunModal from "./components/modal/FirstRunModal.svelte";
    import { notificationCount } from "./components/stores/notificationCount";
    import { notificationsList } from "./components/stores/notificationsList";
    import { fade } from "svelte/transition";
    import { onDestroy } from "svelte";

    // Патч для предотвращения зависания сети (Tаймаут 8 секунд на внешние запросы + менеджер отмены)
    const activeControllers = new Set();

    window.cancelActiveRequests = function () {
        for (const controller of activeControllers) {
            controller.abort();
        }
        activeControllers.clear();
    };

    const originalFetch = window.fetch;
    window.fetch = async function (url, options = {}) {
        const urlStr = url.toString();
        if (
            urlStr.includes("localhost") ||
            urlStr.includes("127.0.0.1") ||
            urlStr.startsWith("file:") ||
            urlStr.startsWith("anidesk-offline:") ||
            urlStr.startsWith("anidesk-cache:")
        ) {
            return originalFetch(url, options);
        }

        if (options.signal) {
            return originalFetch(url, options);
        }

        const isCritical = 
            urlStr.includes("/profile") || 
            urlStr.includes("/auth") || 
            urlStr.includes("/notification") || 
            urlStr.includes("/settings") ||
            urlStr.includes("/history") ||
            urlStr.includes("/watch") ||
            urlStr.includes("/favorite") ||
            urlStr.includes("/list/") ||
            urlStr.includes("/comment/") ||
            urlStr.includes("/vote/");

        const controller = new AbortController();
        if (!isCritical) {
            activeControllers.add(controller);
        }

        const timeoutId = setTimeout(() => {
            controller.isTimeout = true;
            controller.abort();
        }, 8000);

        try {
            const res = await originalFetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            activeControllers.delete(controller);
            return res;
        } catch (err) {
            clearTimeout(timeoutId);
            activeControllers.delete(controller);
            if (err instanceof Error && err.name === 'AbortError' && controller.isTimeout) {
                throw new Error('Timeout');
            }
            throw err;
        }
    };

    window.utils = Utils;

    let guiSettings, endpointUrl;

    const guiSettingsRaw = localStorageWritable(
        "guiSettings",
        utils.guiDefaultSettings,
    );

    const endpointUrlRaw = localStorageWritable(
        "endpointUrl",
        "api-s.anixsekai.com",
    );

    guiSettingsRaw.subscribe((value) => {
        guiSettings = value;
    });

    endpointUrlRaw.subscribe((value) => {
        endpointUrl = value;
    });

    document.body.classList = [`${guiSettings.theme}-theme`];

    let utoken;

    let isFullscreen = false;

    const user_token = localStorageWritable("user_token", null);
    user_token.subscribe((value) => {
        if (!value || value === "null") {
            const defaultUser = { id: 1, token: "62cbadbb776252c3607c6533a672138cd7b187b7" };
            user_token.set(JSON.stringify(defaultUser));
            utoken = defaultUser;
        } else {
            utoken = JSON.parse(value);
        }
    });

    let firstRun;

    const firstRunRaw = localStorageWritable("first_run", true);
    firstRunRaw.subscribe((value) => (firstRun = value));

    discordRPC.setActivity({
        type: 3,
        state: "Ожидание...",
        largeImageKey: "anidesk-transparent",
        largeImageText: "Re:AniDesk - Anixart Client",
        instance: true,
        buttons: [
            { label: "Ссылка на клиент", url: "https://anidesk.ds1nc.ru/" },
        ],
    });

    window.waitForElm = (selector, timeoutMs = 10000) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            // Таймаут — фикс утечки памяти если элемент так и не появится
            const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`waitForElm: "${selector}" not found in ${timeoutMs}ms`));
            }, timeoutMs);

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        });
    };

    /**
     * Глобальные переменные
     */
    window.baseSettings = settings.getAll().then((res) => (baseSettings = res));
    window.versions = prc
        .getVersions()
        .then((versions) => (window.versions = versions));

    const paginatedProps = new Set([
        'filter', 'all', 'getCollectionFavorites', 'getCollectionReleases',
        'getFriends', 'getVotedReleases', 'getBookmarks', 'getFavorites',
        'getComments', 'getRelatedReleases', 'releases', 'getCommentReplies'
    ]);

    function getContentArray(r) {
        if (r && Array.isArray(r.content)) return r.content;
        if (r && r.releases && Array.isArray(r.releases.content)) return r.releases.content;
        return null;
    }

    function setContentArray(r, arr) {
        if (r && Array.isArray(r.content)) r.content = arr;
        else if (r && r.releases && Array.isArray(r.releases.content)) r.releases.content = arr;
    }

    const pageIndex1Props = new Set([
        'getCollectionReleases', 'getComments', 'getRelatedReleases', 
        'getCommentReplies', 'getVotedReleases'
    ]);

    function wrapAnixApi(endpoints) {
        const handler = {
            get(target, prop) {
                const val = target[prop];
                if (typeof val === 'function') {
                    return async function(...args) {
                        if (!paginatedProps.has(prop)) {
                            return val.apply(target, args);
                        }

                        let pageValue = -1;
                        let pageIndex = -1;
                        
                        if (pageIndex1Props.has(prop)) {
                            if (typeof args[1] === 'number') {
                                pageValue = args[1]; pageIndex = 1;
                            } else if (typeof args[1] === 'object' && args[1] !== null && typeof args[1].page === 'number') {
                                pageValue = args[1].page; pageIndex = 'in_obj_1';
                            }
                        } else if (typeof args[0] === 'number') {
                            pageValue = args[0]; pageIndex = 0;
                        } else if (args[0] !== null && typeof args[0] === 'object' && typeof args[0].page === 'number') {
                            pageValue = args[0].page; pageIndex = 'in_obj';
                        } else if (args.length > 1) {
                            if (typeof args[1] === 'number') {
                                pageValue = args[1]; pageIndex = 1;
                            } else if (typeof args[1] === 'object' && args[1] !== null && typeof args[1].page === 'number') {
                                pageValue = args[1].page; pageIndex = 'in_obj_1';
                            }
                        }

                        if (pageValue === -1) {
                            return val.apply(target, args);
                        }

                        const pageA = pageValue * 2;
                        const pageB = pageValue * 2 + 1;

                        const argsA = JSON.parse(JSON.stringify(args));
                        if (pageIndex === 0 || pageIndex === 1) argsA[pageIndex] = pageA;
                        else if (pageIndex === 'in_obj') argsA[0].page = pageA;
                        else if (pageIndex === 'in_obj_1') argsA[1].page = pageA;

                        const argsB = JSON.parse(JSON.stringify(args));
                        if (pageIndex === 0 || pageIndex === 1) argsB[pageIndex] = pageB;
                        else if (pageIndex === 'in_obj') argsB[0].page = pageB;
                        else if (pageIndex === 'in_obj_1') argsB[1].page = pageB;

                        try {
                            const [resA, resB] = await Promise.all([
                                val.apply(target, argsA),
                                val.apply(target, argsB).catch(() => null)
                            ]);

                            if (resA) {
                                const contentA = getContentArray(resA);
                                const contentB = resB ? getContentArray(resB) : null;
                                
                                if (contentA && contentB && contentB.length > 0) {
                                    setContentArray(resA, contentA.concat(contentB));
                                }
                                
                                return resA;
                            }
                        } catch (e) {
                            // Префетч провалился или основной запрос упал
                            if (e instanceof Error && (e.name === 'AbortError' || e.message.includes('AbortError') || e.message.includes('aborted'))) {
                                throw e;
                            }
                            console.error("API Error in wrapAnixApi", e);
                            throw e; // Пробрасываем ошибку, чтобы Svelte {#await} ушел в {:catch}
                        }

                        throw new Error("Empty response");
                    };
                }
                if (typeof val === 'object' && val !== null) {
                    return new Proxy(val, handler);
                }
                return val;
            }
        };
        return new Proxy(endpoints, handler);
    }

    anixApi.init(wrapAnixApi(new Anixart({
        token: utoken?.token,
        baseUrl: `https://${endpointUrl}`,
    }).endpoints));
    window.anixApi = anixApi.get();
    window.profileInfo = utoken
        ? anixApi.get().profile
              .info(utoken?.id)
              .then((x) => (profileInfo = x.profile))
        : null;
    window.profileSettings = {
        main: null,
        socials: null,
        login: null,
    };
    window.avaliableGPU = utils
        .checkGPUSupport()
        .then((res) => (avaliableGPU = res));

    if (utoken) {
        anixApi.get().settings
            .getCurrentProfileSettings()
            .then((x) => (profileSettings.main = x));
        anixApi.get().settings.getSocial().then((x) => (profileSettings.socials = x));
        anixApi.get().settings
            .getLoginInfo()
            .then((x) => (profileSettings.login = x));

        mergeNotifications();
    }

    async function mergeNotifications() {
        if ($notificationsList === null) {
            const local = await window.notificationsApi.get();
            $notificationsList = local || [];
            notificationCount.set($notificationsList.length);
        }

        try {
            const remote = await anixApi.get().notification.getNotifications(0);
            if (remote && remote.content) {
                let current = [...$notificationsList];
                let changed = false;
                
                remote.content.forEach(rn => {
                    const id = `${rn.type}_${rn.timestamp}_${rn.release?.id || ''}_${rn.by_profile?.id || ''}_${rn.collection_comment?.collection?.id || ''}`;
                    rn._localId = id;
                    
                    if (!current.some(n => (n._localId || `${n.type}_${n.timestamp}_${n.release?.id || ''}_${n.by_profile?.id || ''}_${n.collection_comment?.collection?.id || ''}`) === id)) {
                        current.push(rn);
                        changed = true;
                    }
                });

                if (changed) {
                    current.sort((a, b) => b.timestamp - a.timestamp);
                    $notificationsList = current;
                    window.notificationsApi.save(current);
                    notificationCount.set(current.length);
                }
            }
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        }
    }

    let views;

    let viewInfo = {
        viewportComponent: HomePage,
        args: {typeReleases: 0},
    };

    let viewInfoOld = {
        viewportComponent: null,
        args: null,
    };

    $: {
        viewInfo.viewportComponent;
        if (typeof window.cancelActiveRequests === 'function') {
            window.cancelActiveRequests();
        }
    }

    let scrollEvent = null;

    window.setViewportScrollEvent = (callback) => {
        scrollEvent = callback;
    };

    function handleResize() {
        isFullscreen = window.innerHeight === screen.height;
    }
    window.addEventListener("resize", handleResize);

    const notifInterval = setInterval(mergeNotifications, 1800000); // Раз в 30 минут обновляем кол-во уведомлений

    // Чистим глобальные подписки (fix при HMR дублирования)
    onDestroy(() => {
        window.removeEventListener("resize", handleResize);
        clearInterval(notifInterval);
    });
</script>

{#if $anixApi}
<main>
    {#if !isFullscreen}
        <TitleBar />
    {/if}
    <div class="main-content" class:fullscreen={isFullscreen}>
        <LeftMenu
            bind:viewportComponent={viewInfo.viewportComponent}
            bind:views
            bind:argsComponent={viewInfo.args}
            bind:viewInfoOld
        />
        {#key viewInfo}
            <MetaInfo />
            <div
                id="viewport"
                class="unselectable"
                tabindex="-1"
                on:scroll={scrollEvent}
                in:fade={{ duration: 200 }}
            >
                <svelte:component
                    this={viewInfo.viewportComponent}
                    args={viewInfo.args}
                ></svelte:component>
                {#if firstRun}
                    <BaseModal
                        modalComponent={FirstRunModal}
                        canCloseOnBackground={false}
                        showed={firstRun}
                        modalSize={{ width: "700px", height: "500px" }}
                        on:closeModal={() => (firstRun = false)}
                    />
                {/if}
            </div>
        {/key}
    </div>
</main>
{/if}

<style>
    .main-content {
        display: flex;
        flex-direction: row;
        height: calc(100vh - 22px);
        width: 100vw;
        margin-top: 22px;
        position: relative;
        background-color: var(--background-color);
        overflow: hidden;
    }

    .fullscreen {
        margin-top: 0px;
        height: 100vh;
    }

    #viewport {
        overflow-y: auto;
        overflow-x: hidden;
        width: 100vw;
        z-index: 0;
        position: relative;
    }

    :global(::-webkit-scrollbar) {
        width: 10px;
        height: 17px;
    }

    /* Track */
    :global(::-webkit-scrollbar-track) {
        background-color: var(--alt-background-color);
        border-radius: 10px;
        opacity: 0.01;
    }

    /* Handle */
    :global(::-webkit-scrollbar-thumb) {
        background: #828282;
        border-radius: 10px;
        box-shadow: inset 0 0 6px var(--scroll-bar-handle-bg-color);
        -webkit-box-shadow: inset 0 0 6px var(--scroll-bar-handle-bg-color);
    }

    :global(::-webkit-scrollbar-thumb:window-inactive) {
        background: var(--scroll-bar-track-bg-color);
    }
</style>
