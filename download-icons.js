const fs = require('fs');
const https = require('https');

const icons = {
  'home': 'home.svg',
  'bookmark': 'bookmark.svg',
  'users': 'friends.svg',
  'layers': 'collection.svg',
  'compass': 'discover.svg',
  'search': 'search.svg',
  'settings': 'settings.svg',
  'bell': 'notification.svg',
  'bell-dot': 'notificationAvaliable.svg'
};

const dir = 'C:/O-Other/AniDesk/resources/app/src/app/icons/';

function downloadIcon(lucideName, fileName) {
  const url = 'https://unpkg.com/lucide-static@latest/icons/' + lucideName + '.svg';
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      // Extract contents inside <svg>...</svg>
      const match = data.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
      if (match) {
        const inner = match[1];
        const newSvg = '<svg viewBox="0 0 24 24">\n  <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' + inner + '  </g>\n</svg>';
        fs.writeFileSync(dir + fileName, newSvg, 'utf8');
        console.log('Saved ' + fileName);
      }
    });
  }).on('error', err => console.error(err));
}

for (const [lucideName, fileName] of Object.entries(icons)) {
  downloadIcon(lucideName, fileName);
}
