<script>
    import { createEventDispatcher } from "svelte";
    import Icon from "../elements/Icon.svelte";
    import DownBtnIcon from "../../icons/downBtn.svg";
    import { optimisticVotes } from "../../stores.js";
    import { get } from "svelte/store";
    import { anixApi } from "../../../lib/stores/api.store.js";

    let { release, onshowAuthModal } = $props();
    
    const dispatch = createEventDispatcher();
    
    let currentRating = $derived($optimisticVotes[release.id]?.vote ?? release.your_vote ?? 0);
    let showDropdown = $state(false);

    let ratingTypes = [
        { type: 0, color: "--main-text-color", text: "Убрать оценку" },
        { type: 5, color: "--hold-on-color", text: "⭐⭐⭐⭐⭐" },
        { type: 4, color: "--hold-on-color", text: "⭐⭐⭐⭐" },
        { type: 3, color: "--hold-on-color", text: "⭐⭐⭐" },
        { type: 2, color: "--hold-on-color", text: "⭐⭐" },
        { type: 1, color: "--hold-on-color", text: "⭐" },
    ];

    let rStyle = $derived(ratingTypes.find(r => r.type === currentRating) || ratingTypes[0]);

    async function rateTitle(vote) {
        const api = get(anixApi);
        if (!api) { console.error('[AniDesk] API not ready'); return; }
        
        const userTokenStr = localStorage.getItem("user_token");
        const utoken = userTokenStr ? JSON.parse(userTokenStr) : null;
        if (!utoken || utoken.id === 1) {
            if (onshowAuthModal) onshowAuthModal();
            dispatch("showAuthModal");
            return;
        }

        showDropdown = false;
        
        try {
            // Если оценка уже была, сначала удаляем ее
            if (currentRating !== 0) {
                const removeRes = await api.release.removeVote(release.id);
                if (removeRes && removeRes.code !== 0 && removeRes.code !== 3) {
                    console.error('[AniDesk] Failed to remove previous vote:', removeRes);
                    return;
                }
                // Пауза 300мс во избежание состояния гонки на сервере Аниксарта
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            const res = await api.release.addVote(release.id, vote);
            
            if (res && res.code === 0) {
                optimisticVotes.update(v => ({...v, [release.id]: { vote, releaseData: release }}));
            } else {
                console.error('[AniDesk] Failed to add vote:', res);
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function removeRating() {
        const api = get(anixApi);
        if (!api) { console.error('[AniDesk] API not ready'); return; }
        
        const userTokenStr = localStorage.getItem("user_token");
        const utoken = userTokenStr ? JSON.parse(userTokenStr) : null;
        if (!utoken || utoken.id === 1) {
            if (onshowAuthModal) onshowAuthModal();
            dispatch("showAuthModal");
            return;
        }

        showDropdown = false;
        
        try {
            const res = await api.release.removeVote(release.id);
            
            if (res && (res.code === 0 || res.code === 3)) {
                optimisticVotes.update(v => ({...v, [release.id]: { vote: 0 }}));
            } else {
                console.error('[AniDesk] Failed to remove vote:', res);
            }
        } catch (error) {
            console.error(error);
        }
    }

    function handleOutsideClick(e) {
        if (showDropdown) {
            if (!e.target.closest('.user-rating-container')) {
                showDropdown = false;
            }
        }
    }
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="user-rating-container flex-column">
    <button
        class="release-left-button flex-row play"
        class:voted={currentRating !== 0}
        onclick={(e) => { e.stopPropagation(); showDropdown = !showDropdown; }}
    >
        <Icon
            src={DownBtnIcon}
            varColor={currentRating !== 0 ? "--background-color" : "--background-color"}
            size={{ width: 17, height: 9 }}
        />
        {currentRating === 0 ? "Оценить" : rStyle.text}
    </button>

    {#if showDropdown}
        <div class="dropdown-bookmark flex-column">
            {#each ratingTypes as r}
                <button
                    class="dropdown-bookmark-element flex-row"
                    class:selected={currentRating === r.type && r.type !== 0}
                    class:remove-vote={r.type === 0}
                    onclick={(e) => {
                        e.stopPropagation();
                        if (r.type === 0) {
                            removeRating();
                        } else {
                            rateTitle(r.type);
                        }
                    }}
                >
                    {r.text}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .user-rating-container {
        position: relative;
        align-items: center;
        width: 100%;
        justify-content: center;
    }

    .release-left-button {
        width: 387px;
        height: 48px;
        align-items: center;
        justify-content: center;
        border-radius: 50px;
        min-height: 48px;
        font-size: 16px;
        margin-top: 15px;
        background-color: var(--main-text-color);
        color: var(--background-color);
        font-weight: bold;
        transition: all 0.2s;
        cursor: pointer;
        border: none;
    }

    .release-left-button:hover {
        background-color: #c2c2c2;
    }

    .release-left-button.voted {
        background-color: #ffb300;
        color: #121212;
    }

    .release-left-button.voted:hover {
        background-color: #ffa000;
    }

    :global(.release-left-button svg) {
        margin-right: 8px;
    }

    .dropdown-bookmark {
        position: absolute;
        top: 100%;
        background-color: var(--alt-background-color);
        padding: 10px 20px;
        margin-top: 10px;
        z-index: 100;
        width: 350px;
        border-radius: 20px;
        margin-bottom: 20px;
        box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.5);
    }

    .dropdown-bookmark-element {
        padding: 8px 0px;
        justify-content: center;
        transition: all 0.2s ease-in-out;
        border-radius: 12px;
        background: none;
        border: none;
        color: var(--main-text-color);
        font-size: 16px;
        cursor: pointer;
    }

    .dropdown-bookmark-element:hover {
        background-color: var(--background-color);
        color: #ffb300; /* Золотой цвет звезд при наведении */
    }

    .dropdown-bookmark-element.selected {
        color: #ffb300;
        background-color: var(--background-color);
        font-weight: bold;
    }

    .dropdown-bookmark-element.remove-vote:hover {
        color: var(--main-text-color);
        background-color: rgba(255, 0, 0, 0.15); /* Подсветка удаления оценки */
    }
</style>
