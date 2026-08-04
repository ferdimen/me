/**
 * Rota Portalı - Ana Uygulama Scripti (app.js / portal.js)
 * rotalar.json verisini okur, çözümler (decode eder), 
 * Gidiş ve Dönüş rotalarını pinleri ile haritaya işler.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadRoutesData();
});

let map;
let routeLayersGroup;

// 1. Haritayı Başlat (Leaflet)
function initMap() {
  // Varsayılan koordinat (Türkiye geneli veya bölge odaklı)
  map = L.map('map').setView([39.92077, 32.85411], 6);

  // OpenStreetMap Taban Katmanı
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap katkıda bulunanlar'
  }).addTo(map);

  // Çizgileri ve pinleri gruplayacağımız katman
  routeLayersGroup = L.layerGroup().addTo(map);
}

// 2. rotalar.json Dosyasını Yükle
async function loadRoutesData() {
  const possiblePaths = ['rotalar.json', '../rotalar.json', '../../rotalar.json'];
  let routes = null;

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        routes = await response.json();
        break;
      }
    } catch (e) {
      // Bir sonraki yolu dene
    }
  }

  if (routes && Array.isArray(routes)) {
    renderAllRoutes(routes);
  } else {
    console.error("rotalar.json yüklenemedi veya veri dizisi bulunamadı.");
  }
}

// 3. Base64 / Maskelenmiş GeoData Verisini Çözen Yardımcı Fonksiyon
function decodeGeoData(maskedGeoData) {
  if (!maskedGeoData) return null;
  try {
    const jsonStr = decodeURIComponent(escape(atob(maskedGeoData)));
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("GeoData çözme hatası:", e);
    return null;
  }
}

// 4. Tüm Rotaları ve Pinleri Haritaya Çizen Fonksiyon
function renderAllRoutes(routes) {
  routeLayersGroup.clearLayers();
  const allBounds = [];

  routes.forEach(route => {
    const geoObj = decodeGeoData(route.maskedGeoData);
    if (!geoObj) return;

    // A) GİDİŞ ROTASI VE PİNLERİ
    if (geoObj.gidis && geoObj.gidis.coordinates && geoObj.gidis.coordinates[0]) {
      // GeoJSON [lon, lat] dizisini Leaflet [lat, lon] dizisine dönüştür
      const gidisLatLngs = geoObj.gidis.coordinates[0].map(pt => [pt[1], pt[0]]);
      
      // Gidiş Çizgisi (Mavi)
      const gidisLine = L.polyline(gidisLatLngs, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85
      });

      // Gidiş Başlangıç Pini
      const startMarker = L.marker(gidisLatLngs[0]).bindPopup(`
        <div style="font-family:sans-serif;">
          <strong style="color:#2563eb;">${route.baslik}</strong><br>
          <small>🚩 Gidiş / Başlangıç Noktası</small>
        </div>
      `);

      // Gidiş Varış Pini
      const endMarker = L.marker(gidisLatLngs[gidisLatLngs.length - 1]).bindPopup(`
        <div style="font-family:sans-serif;">
          <strong style="color:#2563eb;">${route.baslik}</strong><br>
          <small>🏁 Gidiş / Bitiş Noktası</small>
        </div>
      `);

      routeLayersGroup.addLayer(gidisLine);
      routeLayersGroup.addLayer(startMarker);
      routeLayersGroup.addLayer(endMarker);

      allBounds.push(...gidisLatLngs);
    }

    // B) DÖNÜŞ ROTASI VE PİNLERİ (Eğer Varsa)
    if (geoObj.donus && geoObj.donus.coordinates && geoObj.donus.coordinates[0]) {
      const donusLatLngs = geoObj.donus.coordinates[0].map(pt => [pt[1], pt[0]]);

      // Dönüş Çizgisi (Kesikli Kırmızı)
      const donusLine = L.polyline(donusLatLngs, {
        color: '#ef4444',
        weight: 3,
        dashArray: '6, 6',
        opacity: 0.85
      });

      // Dönüş Başlangıç Pini
      const donusStartMarker = L.marker(donusLatLngs[0]).bindPopup(`
        <div style="font-family:sans-serif;">
          <strong style="color:#ef4444;">${route.baslik}</strong><br>
          <small>🔄 Dönüş Başlangıç Noktası</small>
        </div>
      `);

      // Dönüş Bitiş Pini
      const donusEndMarker = L.marker(donusLatLngs[donusLatLngs.length - 1]).bindPopup(`
        <div style="font-family:sans-serif;">
          <strong style="color:#ef4444;">${route.baslik}</strong><br>
          <small>🏁 Dönüş Bitiş Noktası</small>
        </div>
      `);

      routeLayersGroup.addLayer(donusLine);
      routeLayersGroup.addLayer(donusStartMarker);
      routeLayersGroup.addLayer(donusEndMarker);

      allBounds.push(...donusLatLngs);
    }
  });

  // Haritayı tüm rotaları kaplayacak şekilde odakla
  if (allBounds.length > 0) {
    map.fitBounds(allBounds, { padding: [30, 30] });
  }
}