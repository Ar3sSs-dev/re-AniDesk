<script>
    import { createEventDispatcher } from "svelte";
    import Preloader from "../gui/Preloader.svelte";
    import AnimeColumnCard from "../elements/AnimeColumnCard.svelte";
    import Dot from "../elements/Dot.svelte";

    const dispatch = createEventDispatcher();

    export let args;
    export let showed;
    dispatch("setTitle", "Оценка релизов");

    import { optimisticVotes } from "../../stores.js";
    import { get } from "svelte/store";

    let page = 0;
    let allData = [];
    let firstData = getFirstData();
    let updateInfo = false;

    function applyOptimisticUpdates(contentArray) {
        if (!contentArray) return [];
        const overrides = get(optimisticVotes);
        let merged = [...contentArray];
        
        for (const [idStr, update] of Object.entries(overrides)) {
            const id = parseInt(idStr);
            const existingIndex = merged.findIndex(v => v.id === id);
            
            if (update.vote === 0) {
                if (existingIndex !== -1) merged.splice(existingIndex, 1);
            } else {
                if (existingIndex !== -1) {
                    merged[existingIndex].my_vote = update.vote;
                    merged[existingIndex] = { ...merged[existingIndex] };
                } else if (page === 0 && update.releaseData) {
                    // Only unshift to the first page if it's new
                    merged.unshift({
                        id: id,
                        title: update.releaseData.title_ru,
                        title_ru: update.releaseData.title_ru,
                        my_vote: update.vote,
                        image: update.releaseData.image,
                        voted_at: update.timestamp
                    });
                }
            }
        }
        
        if (page === 0) {
            merged.sort((a, b) => b.voted_at - a.voted_at);
        }
        return merged;
    }

    async function getFirstData() {
        let data = await anixApi.profile.getVotedReleases(args.id, 0);
        data.content = applyOptimisticUpdates(data.content);
        return data;
    }

    async function getRelatedPage() {
        const data = await anixApi.profile.getVotedReleases(args.id, page);
        let updatedContent = applyOptimisticUpdates(data.content);
        allData = allData.concat(updatedContent);
        updateInfo = false;
    }

    async function scrollEvent(e) {
        if ((e.target.scrollTop >= e.target.scrollHeight - 2000) && !updateInfo) {
            updateInfo = true;
            page++;
            await getRelatedPage();
        }
    }
</script>

{#if showed}
<div class="modal-title">Оценки релизов</div>
{#await firstData}
    <div class="center">
        <Preloader />
    </div>
{:then i}
    <div class="modal-content" onscroll="{scrollEvent}">
        <div class="cards-grid">
            {#each i.content as r}
            <AnimeColumnCard anime={r} inModal={true}>
                <div class="info-box flex-row">
                    ★ {r.my_vote} из 5 <Dot size={{width: 4, height: 4}} />
                    <span class="third-text"
                        >{utils.returnTimeString(r.voted_at * 1000)}</span
                    >
                </div>
            </AnimeColumnCard>
        {/each}
        {#each allData as r}
            <AnimeColumnCard anime={r} inModal={true}>
                <div class="info-box flex-row">
                    ★ {r.my_vote} из 5 <Dot size={{width: 4, height: 4}} />
                    <span class="third-text"
                        >{utils.returnTimeString(r.voted_at * 1000)}</span
                    >
                </div>
            </AnimeColumnCard>
        {/each}
        </div>
    </div>
{/await}
{/if}

<style>
    .third-text {
        font-size: 14px;
        color: var(--secondary-text-color);
    }

    .info-box {
        background-color: var(--alt-background-color);
        margin-bottom: 10px;
        border-radius: 10px;
        width: max-content;
        padding: 3px 12px;
        align-items: center;
    }
</style>



