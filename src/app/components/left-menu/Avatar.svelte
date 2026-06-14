<script>
    export let onClickCallback;
    export let avatar;
    export let tooltip = "Профиль";
</script>

<button class="left-menu-profile" onclick='{onClickCallback}' data-tooltip={tooltip}>
    <img width="50" height="50" src={avatar} alt="avatar">
</button>

<style>
    .left-menu-profile img{
        border-radius: 100%;
    }

    .left-menu-profile {
        margin-bottom: 10px;
    }
</style>