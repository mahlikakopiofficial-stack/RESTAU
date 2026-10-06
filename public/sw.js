const CACHE_NAME='pinoyambula-shell-v23';
const SHELL=[
  '/index.html',
  '/account.html',
  '/admin.html',
  '/reset-password.html',
  '/style.css',
  '/app.js',
  '/enhancements.js',
  '/final-fixes.js',
  '/master-enhancements.js',
  '/media-runtime-fix.js',
  '/pwa.js',
  '/runtime-config.js',
  '/manifest.json',
  '/icons/pinoyambula.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(request.method!=='GET')return;

  event.respondWith(
    fetch(request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
      }
      return response;
    }).catch(()=>caches.match(request).then(cached=>cached||caches.match('/index.html')))
  );
});
