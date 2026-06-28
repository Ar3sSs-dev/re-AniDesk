<script>
    import { createEventDispatcher, onMount } from "svelte";
    import BaseMainButton from "../buttons/BaseMainButton.svelte";
    import DropdownElement from "../settings/DropdownElement.svelte";
    import Separator from "../elements/Separator.svelte";

    let { showed } = $props();

    const dispatch = createEventDispatcher();

    const defaultSettings = {
        country: "",
        category_id: null,
        status_id: null,
        sort: 0,
        genres: [],
        profile_list_exclusions: [],
        start_year: "",
        end_year: "",
        episodes_from: "",
        episodes_to: "",
        studio: ""
    };

    // Локальное реактивное состояние формы
    let filterState = $state({ ...defaultSettings });

    const countryValues = [
        { label: "Неважно", value: "" },
        { label: "Япония", value: "Япония" },
        { label: "Китай", value: "Китай" },
        { label: "Южная Корея", value: "Южная Корея" },
        { label: "США", value: "США" },
        { label: "Россия", value: "Россия" }
    ];

    const categoryValues = [
        { label: "Неважно", value: null },
        { label: "Аниме (Сериал)", value: 1 },
        { label: "Аниме (Фильм)", value: 2 },
        { label: "OVA", value: 3 },
        { label: "Спешл", value: 6 }
    ];

    const statusValues = [
        { label: "Неважно", value: null },
        { label: "Вышел (Завершен)", value: 1 },
        { label: "Онгоинг (Выходит)", value: 2 },
        { label: "Анонс", value: 3 }
    ];

    const sortValues = [
        { label: "По дате обновления", value: 0 },
        { label: "По рейтингу", value: 1 },
        { label: "По году выхода", value: 2 },
        { label: "По популярности", value: 3 }
    ];

    const allGenres = [
        "Экшен", "Приключения", "Комедия", "Драма", "Фэнтези", "Фантастика",
        "Романтика", "Повседневность", "Мистика", "Детектив", "Триллер", "Ужасы",
        "Спорт", "Меха", "Сёнэн", "Сёдзё"
    ];

    const bookmarkFolders = [
        { label: "Избранное", value: 0 },
        { label: "Смотрю", value: 1 },
        { label: "В планах", value: 2 },
        { label: "Просмотрено", value: 3 },
        { label: "Отложено", value: 4 },
        { label: "Брошено", value: 5 }
    ];

    onMount(() => {
        dispatch("setTitle", "Настройки вкладки");
        const saved = localStorage.getItem("myTabFilterSettings");
        if (saved) {
            try {
                filterState = { ...defaultSettings, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Ошибка парсинга настроек фильтра:", e);
            }
        }
    });

    function toggleGenre(genre) {
        if (filterState.genres.includes(genre)) {
            filterState.genres = filterState.genres.filter(g => g !== genre);
        } else {
            filterState.genres = [...filterState.genres, genre];
        }
    }

    function toggleExclusion(val) {
        if (filterState.profile_list_exclusions.includes(val)) {
            filterState.profile_list_exclusions = filterState.profile_list_exclusions.filter(x => x !== val);
        } else {
            filterState.profile_list_exclusions = [...filterState.profile_list_exclusions, val];
        }
    }

    function applyFilters() {
        localStorage.setItem("myTabFilterSettings", JSON.stringify(filterState));
        dispatch("apply", filterState);
        dispatch("closeModal");
    }

    function resetFilters() {
        filterState = { ...defaultSettings };
        localStorage.setItem("myTabFilterSettings", JSON.stringify(filterState));
        dispatch("apply", filterState);
        dispatch("closeModal");
    }
</script>

{#if showed}
    <div class="modal-title flex-row justify-between align-center">
        <span>Настройки вкладки</span>
    </div>
    <div class="modal-content filter-modal-content">
        <div class="filter-group">
            <DropdownElement
                title="Страна"
                values={countryValues}
                value={filterState.country}
                placeholder="Выберите страну"
                onChangeCallback={(e, v) => filterState.country = v}
            />
        </div>

        <div class="filter-group">
            <DropdownElement
                title="Категория"
                values={categoryValues}
                value={filterState.category_id}
                placeholder="Выберите категорию"
                onChangeCallback={(e, v) => filterState.category_id = v}
            />
        </div>

        <div class="filter-group">
            <DropdownElement
                title="Статус"
                values={statusValues}
                value={filterState.status_id}
                placeholder="Выберите статус"
                onChangeCallback={(e, v) => filterState.status_id = v}
            />
        </div>

        <div class="filter-group">
            <DropdownElement
                title="Сортировка"
                values={sortValues}
                value={filterState.sort}
                placeholder="Выберите тип сортировки"
                onChangeCallback={(e, v) => filterState.sort = v}
            />
        </div>

        <Separator width="90%" />

        <!-- Года и Эпизоды -->
        <div class="flex-row double-fields-container justify-between">
            <div class="fields-group flex-column">
                <span class="section-title">Год выхода</span>
                <div class="flex-row gap-10">
                    <input type="number" placeholder="От" class="filter-input" bind:value={filterState.start_year} />
                    <input type="number" placeholder="До" class="filter-input" bind:value={filterState.end_year} />
                </div>
            </div>

            <div class="fields-group flex-column">
                <span class="section-title">Количество эпизодов</span>
                <div class="flex-row gap-10">
                    <input type="number" placeholder="От" class="filter-input" bind:value={filterState.episodes_from} />
                    <input type="number" placeholder="До" class="filter-input" bind:value={filterState.episodes_to} />
                </div>
            </div>
        </div>

        <Separator width="90%" />

        <!-- Студия -->
        <div class="fields-group flex-column studio-input-group">
            <span class="section-title">Студия</span>
            <input type="text" placeholder="Введите название студии" class="filter-input-full" bind:value={filterState.studio} />
        </div>

        <Separator width="90%" />

        <!-- Жанры -->
        <div class="flex-column genres-section">
            <span class="section-title">Жанры</span>
            <div class="genres-grid">
                {#each allGenres as genre}
                    <button
                        type="button"
                        class="genre-tag"
                        class:active={filterState.genres.includes(genre)}
                        onclick={() => toggleGenre(genre)}
                    >
                        {genre}
                    </button>
                {/each}
            </div>
        </div>

        <Separator width="90%" />

        <!-- Исключить закладки -->
        <div class="flex-column exclusions-section">
            <span class="section-title">Исключить из выдачи закладки</span>
            <div class="genres-grid">
                {#each bookmarkFolders as folder}
                    <button
                        type="button"
                        class="genre-tag exclusion-tag"
                        class:active={filterState.profile_list_exclusions.includes(folder.value)}
                        onclick={() => toggleExclusion(folder.value)}
                    >
                        {folder.label}
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <!-- Кнопки управления -->
    <div class="filter-modal-footer flex-row justify-end gap-10">
        <BaseMainButton style="default" width="120px" height="35" onClickCallback={resetFilters}>Сбросить</BaseMainButton>
        <BaseMainButton style="primary" width="120px" height="35" onClickCallback={applyFilters}>Применить</BaseMainButton>
    </div>
{/if}

<style>
    .filter-modal-content {
        height: 75% !important;
        overflow-y: auto;
        padding-top: 10px;
    }

    .filter-group {
        width: 100%;
        margin-bottom: -5px;
    }

    .section-title {
        font-size: 16px;
        font-weight: bold;
        color: var(--main-text-color);
        margin-bottom: 8px;
    }

    .double-fields-container {
        width: 80%;
        margin: 15px auto;
        gap: 40px;
    }

    .fields-group {
        width: 48%;
    }

    .gap-10 {
        gap: 10px;
    }

    .filter-input {
        width: 100%;
        height: 38px;
        border-radius: 10px;
        background-color: var(--alt-background-color);
        border: 1px solid var(--rate-back-color);
        color: var(--main-text-color);
        padding: 0 12px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
    }

    .filter-input:focus, .filter-input-full:focus {
        border-color: var(--main-text-color);
    }

    .studio-input-group {
        width: 80%;
        margin: 15px auto;
    }

    .filter-input-full {
        width: 100%;
        height: 38px;
        border-radius: 10px;
        background-color: var(--alt-background-color);
        border: 1px solid var(--rate-back-color);
        color: var(--main-text-color);
        padding: 0 12px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
    }

    .genres-section, .exclusions-section {
        width: 80%;
        margin: 15px auto;
    }

    .genres-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }

    .genre-tag {
        padding: 6px 14px;
        border-radius: 20px;
        background-color: var(--alt-background-color);
        border: 1px solid var(--rate-back-color);
        color: var(--secondary-text-color);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }

    .genre-tag:hover {
        background-color: var(--select-button-color);
        color: var(--main-text-color);
    }

    .genre-tag.active {
        background-color: var(--main-text-color);
        border-color: var(--main-text-color);
        color: var(--background-color);
        font-weight: bold;
    }

    .filter-modal-footer {
        padding: 15px 40px;
        border-top: 1px solid var(--rate-back-color);
        background-color: var(--background-color);
        box-sizing: border-box;
        height: 65px;
    }
</style>
