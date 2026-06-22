/**
 * Набор всяких вспомогательных функций
 */

module.exports = {
    seasons: [null, "Зима", "Весна", "Лето", "Осень"],

    avaliableNotifications: [
        "myCollection",
        "relatedRelease",
        "friend",
        "episode",
    ], /*Отсеиваем неподдерживаемые уведомления в приложении чтобы потом небыло проблем с их обработкой 
        (В последствии я буду добавлять новые типы уведомлений)*/

    playerDefaultSettings: {
        autoplayEpisode: true,
        rememberTime: false,
        defaultAspectRatio: "16-9",
        saveUserVolume: {
            enabled: false,
            lastValue: null
        },
        defaultVolume: 50,
        opacityInterface: 50,
        timeHideInterface: 5000,
        hotkeys: {
            hotkeyPlayPause: ["Space"],
            hotkeyNextEpisode: ["KeyN"],
            hotkeyPrevEpisode: ["KeyB"],
            hotkeySkipOpening: ["KeyS"],
            hotkeyForward: ["ArrowRight"],
            hotkeyBackward: ["ArrowLeft"],
            hotkeyMute: ["KeyM"],
            hotkeyFullscreen: ["KeyF"]
        },
    },

    guiDefaultSettings: {
        theme: "dark",
        releaseCardType: "full-row",
    },

    playingDefaultSettings: {
        defaultQuality: 1080,
        defaultSource: null,
        disableHistory: false
    },

    downloadDefaultSettings: {
        defaultQuality: 720
    },

    upscaleDefaultSettings: {
        enabled: false,
        mode: 15
    },

    endpointValues: [
        { label: "api-s.anixsekai.com", value: "api-s.anixsekai.com" },
        { label: "api.anixart.app", value: "api.anixart.app" },
        { label: "api.anixart.tv (Заблокирован в РФ)", value: "api.anixart.tv" },
    ],

    bookmarkSortValues: [
        { label: "По дате добавления: сначала новые", value: 1 },
        { label: "По дате добавления: сначала старые", value: 2 },
        { label: "По алфавиту: A → Z", value: 5 },
        { label: "По алфавиту: Z → A", value: 6 },
        { label: "По году выхода релиза: сначала новые", value: 3 },
        { label: "По году выхода релиза: сначала старые", value: 4 },
    ],

    privacyOptions: [
        { label: "Никто", value: 2 },
        { label: "Только друзья", value: 1 },
        { label: "Все пользователи", value: 0 }
    ],

    privacyFriendsOptions: [
        { label: "Никто", value: 1 },
        { label: "Все пользователи", value: 0 }
    ],

    sourceValues: [
        { label: "Не выбран", value: null },
        { label: "Kodik", value: 0 },
        { label: "Libria", value: 1 },
        { label: "Sibnet", value: 2 }
    ],

    qualityValues: [
        { label: "1080p", value: 1080 },
        { label: "720p", value: 720 },
        { label: "480p", value: 480 },
        { label: "360p", value: 360 }
    ],

    aspectRatioValues: [
        { label: "16:9", value: "16-9" },
        { label: "4:3", value: "4-3" },
        { label: "Fit", value: "fit" },
        { label: "Оригинальное", value: "original" },
    ],

    playerSpeedValues: [
        { label: "0.5x", value: 0.5 },
        { label: "1x", value: 1.0 },
        { label: "1.25x", value: 1.25 },
        { label: "1.5x", value: 1.5 },
        { label: "2x", value: 2.0 }
    ],

    collectionSortValues: [
        { label: "В закладках", value: 0 },
        { label: "Лидеры рейтинга", value: 1 },
        { label: "Популярные за год", value: 2 },
        { label: "Популярные за сезон", value: 3 },
        { label: "Популярные за неделю", value: 4 },
        { label: "Недавно добавленные", value: 5 },
        { label: "Случайные", value: 6 },
    ],

    themeValues: [
        { label: "Темная", value: "dark" },
        { label: "Светлая (Не оптимизированная)", value: "light" }
    ],

    upscaleValues: [
        { label: "ModeA [Preset]", value: 14, description: "Быстрый пресет с умеренным восстановлением и апскейлом." },
        { label: "ModeB [Preset]", value: 15, description: "Сбалансированный пресет с акцентом на детализацию." },
        { label: "ModeC [Preset]", value: 16, description: "Качественный пресет с более агрессивным улучшением." },
        { label: "ModeA+A [Preset]", value: 17, description: "Расширенный ModeA с дополнительной обработкой." },
        { label: "ModeB+B [Preset]", value: 18, description: "Улучшенный ModeB, обеспечивает более высокое качество." },
        { label: "ModeC+A [Preset]", value: 19, description: "Комбинированный пресет с высокой чёткостью и восстановлением." },
        { label: "DoG [Deblur]", value: 0, description: "Удаление размытия и усиление границ с помощью фильтра разности Гауссиан." },
        { label: "BilateralMean [Denoise]", value: 1, description: "Снижение шума без потери резкости с помощью билинейного среднего." },
        { label: "CNNM [Restore]", value: 2, description: "Нейросетевое восстановление с умеренной глубиной, хорошо для общего улучшения." },
        { label: "CNNSoftM [Restore]", value: 3, description: "Более мягкое восстановление, минимизирующее артефакты и перегибы." },
        { label: "CNNSoftVLM [Restore]", value: 4, description: "Очень лёгкое и мягкое восстановление, подходит для слабых устройств." },
        { label: "CNNVL [Restore]", value: 5, description: "Восстановление с малой задержкой и быстрой обработкой." },
        { label: "CNNUL [Restore]", value: 6, description: "Универсальное восстановление с фокусом на стабильность качества." },
        { label: "GANUUL [Restore]", value: 7, description: "Реконструкция изображения с использованием GAN, для сложных сцен." },
        { label: "CNNx2M [Upscale]", value: 8, description: "Увеличение в 2 раза с сохранением структуры и минимальными артефактами." },
        { label: "CNNx2VL [Upscale]", value: 9, description: "Быстрый и лёгкий апскейл в 2 раза, подходит для слабых систем." },
        { label: "DenoiseCNNx2VL [Upscale]", value: 10, description: "Апскейл в 2 раза с предварительным шумоподавлением." },
        { label: "CNNx2UL [Upscale]", value: 11, description: "Универсальный и сбалансированный апскейл в 2 раза." },
        { label: "GANx3L [Upscale]", value: 12, description: "Апскейл в 3 раза с помощью GAN — нацелен на высокое качество." },
        { label: "GANx4UUL [Upscale]", value: 13, description: "Максимальный апскейл в 4 раза через GAN — для максимальной детализации." },
    ],

    getStringTime(time) {
        const days = Math.floor(time / 1440);
        const hours = Math.floor((time % 1440) / 60);
        const minutes = time;

        return {
            days,
            hours,
            minutes
        }
    },

    getNumericWord(number, words) {
        const cases = [2, 0, 1, 1, 1, 2];
        return words[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
    },

    returnFullStringTime(time) {
        const { days, hours, minutes, seconds } = this.getStringTime(time);

        return `${days} ${this.getNumericWord(days, ['день', 'дня', 'дней'])} ${hours !== 0 ? `${hours} ${this.getNumericWord(hours, ['час', 'часа', 'часов'])}` : ""}`;
    },

    returnEpisodeString(anime) {
        let released = anime.episodes_released;
        let total = anime.episodes_total;

        if (total == null) total = '?';
        if (released == null) released = '?';
        if (total == null && released == null) return '?';
        if (total == released) return total;

        return `${released} из ${total}`;
    },

    getAgeRate(rate) {
        switch (rate) {
            case 2:
                return "6+";

            case 3:
                return "12+";

            case 4:
                return "16+";

            case 5:
                return "18+";

            case 1:
            default:
                return "0+";
        }
    },

    getShortDate(timestamp) {
        let date = new Date(timestamp * 1000);
        return `${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()}.${date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1}`
    },

    returnTimeString(time, showYear = false) {
        let date = new Date(time);
        return `${date.getDate()} ${date.toLocaleString("default", { month: "short" })} ${showYear ? date.getFullYear() : ""} в ${date.getHours()}:${date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()}`;
    },

    returnFormatedTime(time) {
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);

        return [h, m, s]
            .map((x, i) => {
                if (x == 0 && i == 0) return null;
                return x >= 0 && x <= 9 ? `0${x}` : x;
            })
            .filter((x) => x !== null)
            .join(":");
    },

    async checkGPUSupport() {
        if (!navigator.gpu) {
            console.warn("WebGPU не поддерживается в этом браузере.");
            return false;
        }

        return navigator.gpu
            .requestAdapter()
            .then((adapter) => {
                return adapter !== null;
            })
            .catch(() => {
                return false;
            });
    },

    async fallback(callback, count) {
        for (let i = 0; i < count; i++) {
            // callback \u0434\u043e\u043b\u0436\u0435\u043d \u0432\u0435\u0440\u043d\u0443\u0442\u044c true \u043f\u0440\u0438 \u0443\u0441\u043f\u0435\u0445\u0435.
            // \u041f\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0444\u043b\u0430\u0433\u0430 success \u043f\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044e (\u0441\u0442\u0430\u0440\u044b\u0439 \u043a\u043e\u0434) \u043d\u0435 \u0440\u0430\u0431\u043e\u0442\u0430\u043b\u0430 \u2014
            // \u043c\u0443\u0442\u0430\u0446\u0438\u044f \u0432\u043d\u0443\u0442\u0440\u0438 \u043a\u043e\u043b\u043b\u0431\u044d\u043a\u0430 \u043d\u0435 \u0432\u043b\u0438\u044f\u043b\u0430 \u043d\u0430 \u043f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u0443\u044e \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u0446\u0438\u043a\u043b\u0430.
            const success = await callback();
            if (success) return;
            if (i < count - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
};