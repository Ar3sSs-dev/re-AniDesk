const { app, net } = require('electron');
const fs = require('fs');
const logFile = 'C:\\Users\\Angel\\AppData\\Local\\AniDesk\\app-0.0.1-beta7\\resources\\app\\test_out.txt';

function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
}

log("Script loaded outside ready.");

app.whenReady().then(async () => {
    if (fs.existsSync(logFile)) {
        try { fs.unlinkSync(logFile); } catch(e) {}
    }
    log("Electron ready. Testing net.fetch...");
    const originalUrl = 'https://s.anixmirai.com/avatars/8672f37fbcdbf638154ecf5b185a7b7f126df369_Lr1ZwWdU6Q.jpg';
    const fetchUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}&w=300&output=webp`;
    
    log("Fetching url: " + fetchUrl);
    try {
        const response = await net.fetch(fetchUrl, {
            headers: {
                'User-Agent': 'AnixartApp/9.0 BETA 3-25021818 (Android 9; SDK 28; x86_64; ROG ASUS AI2201_B; ru)',
                'Referer': 'https://anixart.tv/'
            }
        });
        log("Response status: " + response.status + " " + response.statusText);
        if (response.ok) {
            const buf = await response.arrayBuffer();
            log("Success! ArrayBuffer size: " + buf.byteLength);
        } else {
            log("Response text: " + await response.text());
        }
    } catch (e) {
        log("net.fetch failed: " + e.stack);
    }
    app.quit();
});
