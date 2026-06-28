const avatarUrl = 'https://s.anixmirai.com/avatars/8672f37fbcdbf638154ecf5b185a7b7f126df369_Lr1ZwWdU6Q.jpg';

const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(avatarUrl)}&w=300&output=webp`;
const googleUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(avatarUrl)}`;

async function test() {
    console.log("Testing:", avatarUrl);
    
    // 1. Direct
    try {
        const res = await fetch(avatarUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log("Direct status:", res.status, res.statusText);
    } catch (e) {
        console.log("Direct failed:", e.message);
    }
    
    // 2. Weserv
    try {
        const res = await fetch(weservUrl);
        console.log("Weserv status:", res.status, res.statusText);
        if (res.status !== 200) {
            console.log("Weserv body:", await res.text());
        }
    } catch (e) {
        console.log("Weserv failed:", e.message);
    }
    
    // 3. Google Focus
    try {
        const res = await fetch(googleUrl);
        console.log("Google Focus status:", res.status, res.statusText);
    } catch (e) {
        console.log("Google Focus failed:", e.message);
    }
}

test();
