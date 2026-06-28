<script>
    import githubLogo from "../icons/github.svg";
    import Icon from "../components/elements/Icon.svelte";
</script>

<div class="about-program flex-column">
    <div class="about-program-title flex-row">
        <img
            src="./assets/icons/anidesk-transparent.png"
            width="200px"
            alt="icon"
        />
        <div class="app-info flex-column">
            <span class="app-title">Re:AniDesk</span>
            <p class="app-description">
                Быстрый и удобный неофициальный десктоп-клиент для <strong>Anixart</strong>. 
                Проект с открытым исходным кодом, построенный на современном стеке веб-технологий: 
                <strong>Node.js</strong>, <strong>Electron</strong>, <strong>Svelte</strong> и <strong>AnixartJS</strong>.
            </p>
        </div>
    </div>
    <div class="app-developers flex-column">
        <span class="app-title">Основные разработчики</span>
        <div class="developers flex-column">
            <div class="developer flex-row">
                <img
                    src="https://github.com/theDesConnet.png"
                    width="100px"
                    alt="icon"
                />
                <div class="dev-info">
                    <span class="developer-name">DesConnet</span>
                    <span class="developer-role">Главный разработчик</span>
                    <div class="social-links">
                        <button
                            onclick={() => {
                                winApi.openLink(
                                    `https://github.com/theDesConnet`,
                                );
                            }}
                        >
                            <Icon
                                src={githubLogo}
                                varColor="--main-text-color"
                                size={{ width: 35, height: 35 }}
                            />
                        </button>
                    </div>
                </div>
            </div>
            <div class="developer flex-row">
                <img
                    src="https://github.com/hack1exe.png"
                    width="100px"
                    alt="icon"
                />
                <div class="dev-info">
                    <span class="developer-name"
                        >Michail Electronshik (aka Hack1exe)</span
                    >
                    <span class="developer-role">Разработчик</span>
                    <div class="social-links">
                        <button
                            onclick={() => {
                                winApi.openLink(
                                    `https://github.com/hack1exe`,
                                );
                            }}
                        >
                            <Icon
                                src={githubLogo}
                                varColor="--main-text-color"
                                size={{ width: 35, height: 35 }}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="app-developers flex-column" style="margin-top: 10px;">
        <span class="app-title">Контрибьюторы</span>
        <div class="developers flex-column">
            <div class="developer flex-row">
                <img
                    src="https://github.com/Ar3sSs-dev.png"
                    width="100px"
                    alt="icon"
                />
                <div class="dev-info">
                    <span class="developer-name">Ar3sSs-dev</span>
                    <span class="developer-role">Независимый разработчик</span>
                    <div class="social-links">
                        <button
                            onclick={() => {
                                winApi.openLink(
                                    `https://github.com/Ar3sSs-dev`,
                                );
                            }}
                        >
                            <Icon
                                src={githubLogo}
                                varColor="--main-text-color"
                                size={{ width: 35, height: 35 }}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .about-program {
        width: 100%;
        height: 100%;
        align-items: center;
    }

    .developer-name {
        font-size: 18px;
        font-weight: bold;
        color: var(--main-text-color);
    }

    .dev-info {
        margin-left: 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .developer {
        width: 100%;
        margin-bottom: 30px;
        margin-top: 10px;
    }

    .social-links {
        display: flex;
        gap: 10px;
        margin-top: 5px;
    }

    .app-developers {
        width: 80%;
    }

    .developer img {
        border-radius: 50%;
    }

    .about-program-title {
        width: fit-content;
        margin-top: 40px;
        width: 80%;
    }

    .app-info {
        height: auto;
        justify-content: center;
        margin-left: 20px;
    }

    .app-title {
        margin-top: 30px;
        font-size: 24px;
        font-weight: bold;
        color: var(--main-text-color);
        width: fit-content;
    }

    .app-description {
        margin-top: 12px;
        font-size: 15px;
        line-height: 1.6;
        color: var(--secondary-text-color);
        max-width: 650px;
    }

    .app-description strong {
        color: var(--main-text-color);
        font-weight: 600;
    }
</style>
