const CACHE_NAME='pinoyambula-shell-v38';
const CACHE_VERSION='v38';
const SHELL=[
  '/index.html',
  '/account.html',
  '/admin.html',
  '/reset-password.html',
  '/style.css',
  '/app.js?v=20261007-live7',
  '/loyalty.js?v=20261009-loyalty1',
  '/enhancements.js',
  '/final-fixes.js',
  '/master-enhancements.js?v=20261010-stock3',
  '/admin-fixes.js?v=20261007-live8',
  '/admin-notify.js?v=20261007-live7',
  '/media-runtime-fix.js?v=20261003-android1',
  '/pwa.js?v=20261006-v28',
  '/runtime-config.js',
  '/manifest.json',
  '/icons/pinoyambula.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.all(SHELL.map(async url=>{
      const response=await fetch(new Request(url,{cache:'reload'}));
      if(!response.ok)throw new Error('Shell asset failed: '+url+' ('+response.status+')');
      await cache.put(url,response);
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(request.method!=='GET')return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
    return response;
  }).catch(()=>caches.match(request).then(cached=>cached||caches.match('/index.html'))));
});