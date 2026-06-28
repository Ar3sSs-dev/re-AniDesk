const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const originalUrl = 'https://s.anixmirai.com/avatars/8672f37fbcdbf638154ecf5b185a7b7f126df369_Lr1ZwWdU6Q.jpg';
const hash = crypto.createHash('md5').update(originalUrl).digest('hex');
const urlObj = new URL(originalUrl);
const ext = path.extname(urlObj.pathname) || '.jpg';
const filename = `${hash}${ext}`;

console.log("Looking for:", filename);

const cachePath1 = path.join(process.env.APPDATA, 're-AniDesk', 'image_cache', filename);
const cachePath2 = path.join(process.env.APPDATA, 'anidesk', 'image_cache', filename);

console.log("Path 1:", cachePath1, fs.existsSync(cachePath1) ? `Exists, size: ${fs.statSync(cachePath1).size} bytes` : "Not found");
console.log("Path 2:", cachePath2, fs.existsSync(cachePath2) ? `Exists, size: ${fs.statSync(cachePath2).size} bytes` : "Not found");
