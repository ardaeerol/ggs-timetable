/* Service worker: offline cache, background reminder checks, notification buttons. */
importScripts('./engine.js?v=8');

const CACHE = 'tu-timetable-v8';
const SHELL = ['./', './index.html', './engine.js?v=8', './manifest.webmanifest', './app-192.png', './app-512.png', './badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// App files: network first so updates arrive, cache as offline fallback. APIs: network only.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // no-cache: always revalidate with GitHub Pages so page and engine never come from different versions
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});

function show(a) {
  return self.registration.showNotification(a.title, {
    body: a.body, tag: a.tag, renotify: true, requireInteraction: !!a.urgent || !!a.actions,
    icon: './app-192.png', badge: './badge-96.png', vibrate: a.urgent ? [300, 150, 300, 150, 300] : [200],
    actions: a.actions || [], data: { url: a.url || './' }
  });
}

async function backgroundTick() {
  try { await Engine.tick(show); } catch (e) { /* offline or storage unavailable */ }
}

// Android Chrome wakes an installed app now and then (roughly every 15+ minutes, at Chrome's discretion).
self.addEventListener('periodicsync', e => { if (e.tag === 'reminders') e.waitUntil(backgroundTick()); });
self.addEventListener('message', e => { if (e.data === 'tick') e.waitUntil(backgroundTick()); });

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const act = e.action || '';
  e.waitUntil((async () => {
    if (act.startsWith('grp:')) {
      const [setId, date, opt] = act.slice(4).split('|');
      await Engine.setAnswer(setId, date, opt);
      const cl = await self.clients.matchAll({ type: 'window' });
      cl.forEach(c => c.postMessage({ type: 'answers-changed' }));
      return;
    }
    const target = (e.notification.data && e.notification.data.url) || './';
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cl.length) { cl[0].postMessage({ type: 'open', hash: target.split('#')[1] || 'today' }); return cl[0].focus(); }
    return self.clients.openWindow(target);
  })());
});
