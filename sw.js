// sw.js — 홈 화면에 추가(설치)할 수 있게 하는 최소 서비스 워커.
// 아무것도 저장해 두지 않고 늘 인터넷에서 새로 받으므로 자동 업데이트가 그대로 됨
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
