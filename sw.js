const CACHE_NAME = 'blockblast-solver-v1';
// 列出所有需要快取的資源
const urlsToCache = [
    '/',
    'index.html',
    'style.css',
    'script.js',
    'manifest.json', // 確保 manifest 也被快取
    'icon-192.png',
    'icon-512.png' 
];

// 安裝 Service Worker 並快取所有資源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache and added all resources');
                return cache.addAll(urlsToCache);
            })
    );
});

// 攔截網路請求，先從快取中查找
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 快取中找到，直接返回
                if (response) {
                    return response;
                }
                // 快取中沒有，則向網路請求
                return fetch(event.request);
            })
    );
});

// 移除舊的快取
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});