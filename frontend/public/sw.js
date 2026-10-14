/**
 * MediCare AI — Service Worker
 * Provides offline application shell caching and Web Push Notification handling.
 * Strict privacy rule: Never cache private medical documents, JWT tokens, or clinical records.
 */

const CACHE_NAME = 'medicare-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Install Event — Cache Application Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Network-First for APIs, Cache-First for Shell Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Never cache API requests, auth tokens, uploads, or private documents
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/uploads/') ||
    event.request.method !== 'GET' ||
    event.request.headers.has('Authorization')
  ) {
    return; // Pass directly to network
  }

  // 2. Static shell assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Notification Event
self.addEventListener('push', (event) => {
  let data = {
    title: 'MediCare Health Notice',
    body: 'A vital reading or reminder requires your attention.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'medicare-alert',
    url: '/patient/vitalsense',
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  // Privacy protection: Ensure lock screen does not leak raw medical telemetry by default
  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'medicare-notification',
    data: {
      url: data.url || '/patient/vitalsense',
      timestamp: Date.now(),
    },
    requireInteraction: data.requireInteraction ?? false,
    actions: [
      { action: 'open', title: 'Open MediCare' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event — Open or Focus Window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/patient/vitalsense';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
