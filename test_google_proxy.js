const targetUrl = 'https://anixart.tv/favicon.ico';
const googleUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(targetUrl)}`;
const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&w=300&output=webp`;

async function test() {
    console.log("Testing:", targetUrl);
    
    // 1. Google Focus
    try {
        const res = await fetch(googleUrl);
        console.log("Google Focus status:", res.status, res.statusText);
    } catch (e) {
        console.log("Google Focus failed:", e.message);
    }

    // 2. Weserv
    try {
        const res = await fetch(weservUrl);
        console.log("Weserv status:", res.status, res.statusText);
    } catch (e) {
        console.log("Weserv failed:", e.message);
    }
}

test();
