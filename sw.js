// 離線使用：安裝時把整個 app 存進手機，之後一律從手機讀取。
// VERSION 依檔案內容產生：public/ 任何檔案有改，部署前執行 python docs/tools/sw_version.py
const VERSION = 'card-vault-23088c2d61';
const FILES = [
  'index.html',
  'manifest.json',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/tailwindcss-3.4.17.js',
  'vendor/html5-qrcode-2.3.8.min.js',
  'vendor/jsbarcode-3.11.6.min.js',
  'cards/card-35.svg',
  'cards/card-50.svg',
  'cards/card-100.svg',
  'cards/card-200.svg',
  'cards/card-500.svg',
  'cards/card-1000.svg',
  'cards/card-35-wide.svg',
  'cards/card-50-wide.svg',
  'cards/card-100-wide.svg',
  'cards/card-200-wide.svg',
  'cards/card-500-wide.svg',
  'cards/card-1000-wide.svg'
];

// 全部抓到才算安裝成功；任一失敗就維持舊版
self.addEventListener('install', event => event.waitUntil(
  caches.open(VERSION).then(cache => cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' }))))
));

// 同網域可能還有其他網站，只清本 app 的舊快取
self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('card-vault-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

// 新版安裝後先等著，使用者按「點此更新」才接手
self.addEventListener('message', event => {
  if (event.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  const home = new URL('./', location).pathname;
  const key = request.mode === 'navigate' && url.pathname === home ? 'index.html' : request;
  event.respondWith(
    caches.open(VERSION)
      .then(cache => cache.match(key, { ignoreSearch: true }))
      .then(hit => hit || fetch(request))
  );
});
