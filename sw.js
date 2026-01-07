const CACHE_NAME = 'chair-game-v2';
const ASSETS = [
  './',
  './chairgame.html',
  './sketch.js',
  './style.css',
  './manifest.json',
  './images/background.png',
  './images/chair1.png',
  './images/chair2.png',
  './images/chair3.png',
  './images/chair4.png',
  './images/chair5.png',
  './images/chair6.png',
  './images/chair7.png',
  'https://cdn.jsdelivr.net/npm/p5@1.11.1/lib/p5.js',
  'https://cdn.jsdelivr.net/npm/p5@1.11.1/lib/addons/p5.sound.min.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
