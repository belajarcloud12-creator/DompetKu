/* =====================================================================
   DompetKu - service worker
   Tugasnya menyimpan file aplikasi di perangkat, supaya DompetKu tetap
   bisa dibuka saat offline.

   PENTING: kalau kamu mengubah index.html / style.css / script.js,
   naikkan angka VERSI di bawah (v1 -> v2, dst) supaya HP mengambil
   file yang baru.
   ===================================================================== */

const VERSI = 'v1';
const CACHE_APP = 'dompetku-app-' + VERSI;
const CACHE_FONT = 'dompetku-font'; // font tidak ikut dihapus saat ganti versi

// Semua file yang dibutuhkan aplikasi untuk berjalan
const FILE_APP = [
    './',
    'index.html',
    'style.css',
    'script.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png'
];

// Font Google. Disimpan otomatis saat pertama kali dibuka dengan internet.
const HOST_FONT = ['fonts.googleapis.com', 'fonts.gstatic.com'];


// Pertama kali dipasang: simpan semua file aplikasi
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_APP)
            // cache: 'reload' = ambil dari server, bukan dari cache bawaan browser
            .then(cache => cache.addAll(FILE_APP.map(url => new Request(url, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

// Setelah aktif: hapus cache dari versi lama
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(daftar => Promise.all(
                daftar
                    .filter(nama => nama !== CACHE_APP && nama !== CACHE_FONT)
                    .map(nama => caches.delete(nama))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (HOST_FONT.includes(url.hostname)) {
        event.respondWith(cacheLaluPerbarui(event, CACHE_FONT));
    } else if (url.origin === self.location.origin) {
        event.respondWith(ambilFileApp(event));
    }
});


// Ambil dari cache dulu (cepat dan bisa offline), lalu perbarui cache di belakang layar
function cacheLaluPerbarui(event, namaCache) {
    const { request } = event;

    return caches.open(namaCache).then(cache =>
        cache.match(request, { ignoreSearch: true }).then(tersimpan => {
            const dariJaringan = fetch(request)
                .then(respons => {
                    // respons "opaque" = file dari domain lain (font), tetap boleh disimpan
                    if (respons.ok || respons.type === 'opaque') cache.put(request, respons.clone());
                    return respons;
                })
                .catch(() => tersimpan);

            if (tersimpan) {
                event.waitUntil(dariJaringan); // biarkan pembaruan selesai walau halaman sudah tampil
                return tersimpan;
            }
            return dariJaringan;
        })
    );
}

function ambilFileApp(event) {
    const { request } = event;

    return cacheLaluPerbarui(event, CACHE_APP).then(respons => {
        if (respons) return respons;
        // Offline + file tidak ada di cache: kembali ke halaman utama
        return request.mode === 'navigate' ? caches.match('index.html') : Response.error();
    });
}
