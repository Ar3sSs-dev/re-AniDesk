<script>
    export let releases;
    export let type;

    import AnimePoster from "../release/AnimePoster.svelte";
</script>

<div class="anime-card-row flex-row">
    {#each releases as r}
        <button class="anime-card-release flex-column" onclick={() => updateViewportComponent(8, { id: r.id })}>
            <div class="full-column-anime-poster">
                <AnimePoster
                    size={{ width: 169, height: 242 }}
                    posterInfo={{ poster: r.image ? r.image.replace(/\/\d+x\d+\//, "/") : "", title: r.title }}
                    shadow={true}
                    borderRadius={15}
                />
            </div>
            <div class="anime-release-info flex-column">
                {#if type}
                    <div class="anime-release-addon flex-column">
                        {#if type == "rate"}
                            <div>★ {r.my_vote} из 5</div>
                            <div class="third-text">{utils.returnTimeString(r.voted_at * 1000)}</div>
                        {:else if type == "watched"}
                            <div>{r.last_view_episode.name}</div>
                            <div class="third-text">{utils.returnTimeString(r.last_view_timestamp * 1000)}</div>
                        {/if}
                    </div>
                {/if}
                <div class="anime-release-title">
                    {r.title_ru}
                </div>
            </div>
        </button>
    {/each}
</div>

<style>
    .anime-card-row {
        width: 100%;
    }

    .anime-card-row:last-child {
        margin-bottom: 20px;
    }

    .anime-release-addon {
        align-items: flex-start;
        font-size: 13px;
        color: var(--main-text-color);
        font-weight: 600;
        margin-bottom: 6px;
        margin-top: 4px;
        gap: 2px;
        text-align: left;
    }

    .third-text {
        color: var(--third-text-color);
        font-size: 12px;
        font-weight: 500;
    }

    .anime-card-release {
        margin-right: auto;
        max-width: 169px;
        cursor: pointer;
    }

    .anime-card-release:last-child {
        margin-right: 0px;
    }

    .full-column-anime-poster {
        transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .anime-card-release:hover .full-column-anime-poster {
        transform: scale(1.03);
    }

    .anime-release-title {
        font-size: 14px;
        color: var(--main-text-color);
        font-weight: 600;
        text-align: left;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2em;
    }

    .anime-release-info {
        width: 100%;
        margin-top: 5px;
    }
</style>
