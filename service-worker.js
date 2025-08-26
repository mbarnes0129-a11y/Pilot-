const CACHE = 'digicoach-fix-all-v3'; // bump to break old caches
const ASSETS = ['./','./index.html','./style.css','./app.js','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  const url = new URL(e.request.url);
  // Honor ?v= cache busters
  if (url.searchParams.has('v')) { e.respondWith(fetch(e.request)); return; }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});