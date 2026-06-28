const { Anixart } = require('anixartjs');

async function getAvatar() {
    const api = new Anixart({
        token: '62cbadbb776252c3607c6533a672138cd7b187b7'
    });
    
    try {
        const profile = await api.endpoints.profile.info(3905515);
        console.log("Avatar URL:", profile.profile.avatar);
    } catch (e) {
        console.error("API request failed:", e);
    }
}
getAvatar();
