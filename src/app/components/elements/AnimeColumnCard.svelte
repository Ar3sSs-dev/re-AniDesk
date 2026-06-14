<script>
    import AnimePoster from "../release/AnimePoster.svelte";
    import Dot from "./Dot.svelte";

    export let anime;
</script>

<anime-column-card class="flex-column" onclick={() => updateViewportComponent(8, { id: anime.id })}>
    <div class="full-column-anime-poster">
        <AnimePoster size={{ width: 169, height: 242 }} posterInfo={{poster: anime.image ? anime.image.replace(/\/\d+x\d+\//, "/") : "", title: anime.title}} shadow={true} borderRadius={20} posterStyle={anime.profile_list_status ?? 0}/>
    </div>
    <div class="anime-item-title">{anime.title_ru}</div>
    <slot></slot>
    <div class="anime-item-epCount flex-row">{utils.returnEpisodeString(anime)} эп. {#if utils.returnEpisodeString(anime) != "?" && anime.status?.id !== 3}<Dot size={{width: 4, height: 4}} />{anime.grade.toFixed(2)} ★{/if}</div>
</anime-column-card>

<style>
    anime-column-card {
        margin: 10px;
        max-width: 169px;
        cursor: pointer;
    }

    .full-column-anime-poster {
        margin-bottom: 10px;
        max-width: 169px;
        transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    anime-column-card:hover .full-column-anime-poster {
        transform: scale(1.03);
    }

    .anime-item-title {
        font-size: 14px;
        color: var(--main-text-color);
        font-weight: 600;
        margin-bottom: 5px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2em;
        min-height: 2.4em;
    }

    .anime-item-epCount {
        font-size: var(--anime-full-row-epCount-size);
        color: var(--third-text-color);
        font-weight: var(--anime-full-row-epCount-weight);
        margin-bottom: 10px;
        align-items: center;
    }

    :global(.dot) {
        margin-left: 5px;
        margin-right: 5px;
    }


</style>