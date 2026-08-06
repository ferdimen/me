let map;
let activeLayers = {};
let categoriesSummary = [];
const loadedCategoryData = {};

let elevationChart = null;
let hoverMarker = null;
let currentRoutePoints = [];

// 1. HARİTAYI VE KATMANLARI İLKLENDİRME
// 1. HARİTAYI VE KATMANLARI İLKLENDİRME
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  const isAuthorized = checkUserIsAuthorized();

  // Yetkisiz kullanıcılar için zoom sınırları
  const minZoomLevel = isAuthorized ? 1 : 6;
  const maxZoomLevel = isAuthorized ? 19 : 11; // Yetkisizse en fazla 11. seviyeye kadar yakınlaşabilir

  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: maxZoomLevel,
    minZoom: minZoomLevel,
    attribution: '© OpenStreetMap | Tüm Hakları Saklıdır <a href="https://ferdimen.com/" target="_blank">Ferdimen</a>'
  });

  const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: Math.min(maxZoomLevel, 17),
    minZoom: minZoomLevel,
    attribution: '© OpenTopoMap | Tüm Hakları Saklıdır <a href="https://ferdimen.com/" target="_blank">Ferdimen</a>'
  });

  map = L.map('map', {
    center: [39.0, 35.0],
    zoom: 6,
    minZoom: minZoomLevel,
    maxZoom: maxZoomLevel,
    layers: [osmLayer],
    fullscreenControl: true
  });

  // Eğer zoom seviyesini TAMAMEN SABİTLEMEK (hiç yaklaştırıp uzaklaştırmamak) isterseniz:
  if (!isAuthorized) {
    // map.scrollWheelZoom.disable(); // Fare tekerleğiyle zoom'u kapatır
    // map.doubleClickZoom.disable();  // Çift tıklamayla zoom'u kapatır
    // map.touchZoom.disable();        // Mobilde pinch-to-zoom'u kapatır
  }

  const baseMaps = {
    "OpenStreetMap": osmLayer,
    "OpenTopoMap": topoLayer
  };
  L.control.layers(baseMaps).addTo(map);

  hoverMarker = L.circleMarker([0, 0], {
    radius: 7,
    fillColor: "#ef4444",
    color: "#ffffff",
    weight: 2,
    opacity: 1,
    fillOpacity: 1
  });
}

// 2. MASKE ÇÖZME (BASE64 DECODE)
function decodeGeoData(maskedData) {
  try {
    const jsonStr = decodeURIComponent(escape(atob(maskedData)));
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("GeoData decode hatası:", e);
    return null;
  }
}

// 3. PORTAL ANA YÜKLEME
async function loadPortal() {
  try {
    const response = await fetch('data/kategoriler.json');
    if (!response.ok) throw new Error("Kategori indeksi okunamadı.");
    categoriesSummary = await response.json();

    renderCategorySkeleton();
    checkUrlParams();
  } catch (err) {
    console.error("Portal yükleme hatası:", err);
  }
}
// 4. KATEGORİ İSKELETİNİ ÇİZME
function renderCategorySkeleton() {
  const container = document.getElementById('categoryContainer');
  if (!container) return;
  container.innerHTML = '';

  categoriesSummary.forEach(cat => {
    const catCard = document.createElement('div');
    catCard.className = 'category-card';
    catCard.id = `cat_${cat.id}`;

    const header = document.createElement('div');
    header.className = 'category-header';

    const catTitleGroup = document.createElement('div');
    catTitleGroup.className = 'category-title-group';

    const catCheckbox = document.createElement('input');
    catCheckbox.type = 'checkbox';
    catCheckbox.className = 'map-check';
    catCheckbox.onclick = async (e) => {
      e.stopPropagation();
      await ensureCategoryLoaded(cat);
      const isChecked = catCheckbox.checked;
      
      if (loadedCategoryData[cat.id]) {
        loadedCategoryData[cat.id].forEach(route => {
          toggleRouteOnMap(route, isChecked);
        });
        if (isChecked) fitAllActiveBounds();
      }
    };

    // Kategori Başlığı (Solda)
    const catTitleText = document.createElement('span');
    catTitleText.innerText = cat.baslik;

    // Etap Sayısı (En Sağa Dayalı)
    const catCountText = document.createElement('span');
    catCountText.id = `cat_count_${cat.id}`;
    catCountText.style.cssText = "margin-left: auto; font-size: 0.78rem; font-weight: 500; opacity: 0.75; white-space: nowrap;";
    catCountText.innerText = cat.etapSayisi ? `(${cat.etapSayisi} Etap)` : '';

    catTitleGroup.appendChild(catCheckbox);
    catTitleGroup.appendChild(catTitleText);
    catTitleGroup.appendChild(catCountText); // Sağa dayalı sayaç eklendi
    header.appendChild(catTitleGroup);

    const routeList = document.createElement('div');
    routeList.className = 'route-list';
    routeList.id = `list_${cat.id}`;

    header.onclick = async (e) => {
      if (e.target === catCheckbox) return;
      const isOpen = catCard.classList.contains('open');
      document.querySelectorAll('.category-card').forEach(c => c.classList.remove('open'));

      if (!isOpen) {
        catCard.classList.add('open');
        await ensureCategoryLoaded(cat);
      }
    };

    catCard.appendChild(header);
    catCard.appendChild(routeList);
    container.appendChild(catCard);
  });
}

// 5. KATEGORİ VERİSİNİ LAZY LOAD YÜKLEME
async function ensureCategoryLoaded(cat) {
  if (loadedCategoryData[cat.id]) return loadedCategoryData[cat.id];

  const routeListContainer = document.getElementById(`list_${cat.id}`);
  if (routeListContainer) {
    routeListContainer.innerHTML = '<div style="padding:8px; color:#64748b; font-size:0.8rem;">Etaplar yükleniyor...</div>';
  }

  try {
    const res = await fetch(cat.jsonPath);
    if (!res.ok) throw new Error("Kategori JSON okunamadı.");
    const routes = await res.json();
    routes.forEach((r, idx) => { 
      r._id = r.id || `${cat.id}_${idx}`; 
      r.turKategorisi = cat.baslik;
      r.catId = cat.id;
    });

    loadedCategoryData[cat.id] = routes;

    // Sağa dayalı etap sayacını güncelle
    const catCountEl = document.getElementById(`cat_count_${cat.id}`);
    if (catCountEl) {
      catCountEl.innerText = `(${routes.length} Etap)`;
    }

    renderRoutesInCategory(cat.id, routes);
    return routes;
  } catch (err) {
    if (routeListContainer) {
      routeListContainer.innerHTML = '<div style="padding:8px; color:#ef4444; font-size:0.8rem;">Etaplar yüklenemedi.</div>';
    }
    return [];
  }
}

// 6. ETAP LİSTESİNİ YAZMA (Sol menüde açıklama gizli)
function renderRoutesInCategory(catId, routes) {
  const routeListContainer = document.getElementById(`list_${catId}`);
  if (!routeListContainer) return;
  routeListContainer.innerHTML = '';

  routes.forEach(route => {
    const item = document.createElement('div');
    item.className = 'route-item';
    item.id = `item_${route._id}`;

    item.innerHTML = `
      <div style="font-weight: 600;">${escapeXml(route.baslik)}</div>
    `;

    item.onclick = () => selectAndHighlightRoute(route);
    routeListContainer.appendChild(item);
  });
}

// HARİTADAKİ TÜM ROTALARI TEMİZLEME FONKSİYONU
function clearAllActiveRoutes() {
  Object.keys(activeLayers).forEach(routeId => {
    if (activeLayers[routeId]) {
      map.removeLayer(activeLayers[routeId]);
      delete activeLayers[routeId];
    }
  });
}

// 7. ETABA TIKLANDIĞINDA HARİTA VE YÜKSEKLİK GRAFİĞİNİ GÜNCELLEME
function selectAndHighlightRoute(route) {
  document.querySelectorAll('.route-item').forEach(el => el.classList.remove('active'));
  const currentItem = document.getElementById(`item_${route._id}`);
  if (currentItem) currentItem.classList.add('active');

  // Kategori kutusunun seçili olup olmadığını kontrol et
  const catId = route.catId || (Object.keys(loadedCategoryData).find(cId => loadedCategoryData[cId].some(r => r._id === route._id)));
  const catCard = document.getElementById(`cat_${catId}`);
  const catCheckbox = catCard ? catCard.querySelector('.map-check') : null;
  const isCategoryChecked = catCheckbox ? catCheckbox.checked : false;

  // Tüm etaplar seçilmediyse önceki tıklanan rotaları haritadan kaldır
  if (!isCategoryChecked) {
    clearAllActiveRoutes();
  }

  const layerGroup = toggleRouteOnMap(route, true);
  if (layerGroup) {
    const polyline = layerGroup.getLayers().find(l => l instanceof L.Polyline);
    if (polyline) {
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      polyline.openPopup();
    }
  }

  const geoObj = decodeGeoData(route.maskedGeoData);
  const rawCoords = extractCoordinates(geoObj ? (geoObj.gidis || geoObj) : null);
  
  if (rawCoords && rawCoords.length > 0) {
    buildElevationChart(rawCoords);
  } else {
    document.getElementById('elevation-panel').style.display = 'none';
  }
}

// 8. HARİTAYA ROTA, PİNLER VE BAŞLANGIÇ/BİTİŞ İKONLARINI ÇİZME
// 8. HARİTAYA ROTA VE PİNLERİ ÇİZME
function toggleRouteOnMap(route, show) {
  if (!map) return null;

  if (!show) {
    if (activeLayers[route._id]) {
      map.removeLayer(activeLayers[route._id]);
      delete activeLayers[route._id];
    }
    return null;
  }

  if (activeLayers[route._id]) {
    return activeLayers[route._id];
  }

  const geoObj = decodeGeoData(route.maskedGeoData);
  if (!geoObj) return null;

  const layerGroup = L.layerGroup();
  const isAuthorized = checkUserIsAuthorized();

  const gidisObj = geoObj.gidis || geoObj;
  const rawCoords = extractCoordinates(gidisObj);
  
  if (rawCoords && rawCoords.length > 0) {
    const leafletLatLngs = rawCoords.map(pt => [pt[1], pt[0]]);
    const polyline = L.polyline(leafletLatLngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85
    });

// Raw koordinatlar alındıktan hemen sonra hesaplamayı yapıyoruz
const stats = calculateRouteStats(rawCoords);

polyline.bindPopup(() => {
      const aciklamaHtml = (isAuthorized && route.aciklama)
        ? `<div style="margin: 0 0 8px 0; font-size: 0.82rem; color: #475569; line-height: 1.3;">${route.aciklama}</div>`
        : '';

  // Dinamik hesaplanan istatistikler
  const statsHtml = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; padding: 6px; background: #f8fafc; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
      <div>
        <div style="font-size: 0.68rem; color: #64748b; font-weight: 600;">Mesafe</div>
        <div style="font-size: 0.82rem; color: #0f172a; font-weight: 700;">${stats.mesafeKm} km</div>
      </div>
      <div>
        <div style="font-size: 0.68rem; color: #16a34a; font-weight: 600;">Tırmanış</div>
        <div style="font-size: 0.82rem; color: #15803d; font-weight: 700;">+${stats.tirmanis} m</div>
      </div>
      <div>
        <div style="font-size: 0.68rem; color: #dc2626; font-weight: 600;">İniş</div>
        <div style="font-size: 0.82rem; color: #b91c1c; font-weight: 700;">-${stats.inis} m</div>
      </div>
    </div>
  `;

  return `
    <div style="min-width: 210px;">
      <h4 style="margin: 0 0 6px 0; font-size: 0.95rem; color: #0f172a; line-height: 1.2;">${escapeXml(route.baslik)}</h4>
      ${statsHtml}
      ${aciklamaHtml}
      <button onclick="triggerGpxDownload('${route._id}')" style="background:#2563eb; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem; width:100%; margin-top: 4px;">
        📥 Rotayı İndir (.GPX)
      </button>
    </div>
  `;
});

    layerGroup.addLayer(polyline);

    // Başlangıç ve Bitiş İkonları (Sadece yetkili kullanıcılara gösterilir)
    if (isAuthorized) {
      const startLatLng = leafletLatLngs[0];
      const startIcon = L.divIcon({
        className: 'custom-start-icon',
      html: `<div style="background-color: #10b981; color: white; border: 2px solid white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.4);" title="Başlangıç">▶</div>`,
      iconSize: [18, 18],
      iconAnchor: [12, 12]
    });
      
      const startMarker = L.marker(startLatLng, { icon: startIcon });
      startMarker.bindPopup(`<strong>🏁 Başlangıç:</strong> ${escapeXml(route.baslik)}`);
      layerGroup.addLayer(startMarker);

      const stopLatLng = leafletLatLngs[leafletLatLngs.length - 1];
      const stopIcon = L.divIcon({
        className: 'custom-stop-icon',
      html: `<div style="background-color: #ef4444; color: white; border: 2px solid white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.4);" title="Bitiş">⬛</div>`,
      iconSize: [18, 18],
      iconAnchor: [12, 12]
    });

      const stopMarker = L.marker(stopLatLng, { icon: stopIcon });
      stopMarker.bindPopup(`<strong>🏁 Bitiş:</strong> ${escapeXml(route.baslik)}`);
      layerGroup.addLayer(stopMarker);
    }
  }

  // Gezi Noktaları / Özel Pinler (Sadece yetkili kullanıcılara gösterilir)
  if (isAuthorized) {
    const allWaypoints = [];
    if (geoObj.gidis && geoObj.gidis.waypoints) allWaypoints.push(...geoObj.gidis.waypoints);
    if (geoObj.donus && geoObj.donus.waypoints) allWaypoints.push(...geoObj.donus.waypoints);
    if (geoObj.waypoints) allWaypoints.push(...geoObj.waypoints);

    allWaypoints.forEach(wpt => {
      const pinMarker = L.circleMarker([wpt.lat, wpt.lon], {
        radius: 6,
        fillColor: '#f59e0b',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      });

      const wptPopup = `
        <div style="min-width: 140px;">
          <strong style="color: #0f172a; font-size: 0.88rem;">📍 ${escapeXml(wpt.name)}</strong>
          ${wpt.desc ? `<p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #475569;">${escapeXml(wpt.desc)}</p>` : ''}
        </div>
      `;
      pinMarker.bindPopup(wptPopup);
      layerGroup.addLayer(pinMarker);
    });
  }

  layerGroup.addTo(map);
  activeLayers[route._id] = layerGroup;
  return layerGroup;
}

// 9. HAVERSINE FORMÜLÜ İLE MESAFE (KM) & ELEVATION VERİ HESABI
function calculateRouteMetrics(rawCoords) {
  let totalDist = 0;
  const metrics = [];
  currentRoutePoints = [];

  for (let i = 0; i < rawCoords.length; i++) {
    const lon = rawCoords[i][0];
    const lat = rawCoords[i][1];
    const ele = rawCoords[i][2] || 0;

    if (i > 0) {
      const prevLon = rawCoords[i - 1][0];
      const prevLat = rawCoords[i - 1][1];
      totalDist += getHaversineDistance(prevLat, prevLon, lat, lon);
    }

    metrics.push({
      dist: parseFloat(totalDist.toFixed(2)),
      ele: Math.round(ele),
      lat: lat,
      lon: lon
    });

    currentRoutePoints.push([lat, lon]);
  }
  return metrics;
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 10. CHART.JS İLE YÜKSEKLİK GRAFİĞİ VE MOUSE ETKİLEŞİMİ
function buildElevationChart(rawCoords) {
  const panel = document.getElementById('elevation-panel');
  panel.style.display = 'block';

  const metrics = calculateRouteMetrics(rawCoords);
  const labels = metrics.map(m => m.dist);
  const dataEle = metrics.map(m => m.ele);

  const ctx = document.getElementById('elevationChart').getContext('2d');

  if (elevationChart) {
    elevationChart.destroy();
  }

  elevationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'İrtifa (m)',
        data: dataEle,
        borderColor: '#0284c7',
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Mesafe: ${items[0].label} km`,
            label: (item) => `Yükseklik: ${item.formattedValue} m`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Mesafe (km)', font: { size: 10 } },
          ticks: { maxTicksLimit: 10, font: { size: 10 } }
        },
        y: {
          title: { display: true, text: 'İrtifa (m)', font: { size: 10 } },
          ticks: { font: { size: 10 } }
        }
      },
      onHover: (event, chartElements) => {
        if (chartElements && chartElements.length > 0) {
          const index = chartElements[0].index;
          const targetPoint = metrics[index];

          if (targetPoint && map) {
            hoverMarker.setLatLng([targetPoint.lat, targetPoint.lon]);
            if (!map.hasLayer(hoverMarker)) {
              hoverMarker.addTo(map);
            }
          }
        } else {
          if (map && map.hasLayer(hoverMarker)) {
            map.removeLayer(hoverMarker);
          }
        }
      }
    }
  });

  map.invalidateSize();
}

// 11. KOORDİNAT DİZİSİNİ AYIKLAMA
function extractCoordinates(dataObj) {
  if (!dataObj) return null;
  if (Array.isArray(dataObj) && dataObj.length > 0) {
    return Array.isArray(dataObj[0][0]) ? dataObj[0] : dataObj;
  }
  if (dataObj.coordinates && Array.isArray(dataObj.coordinates)) {
    return Array.isArray(dataObj.coordinates[0][0]) ? dataObj.coordinates[0] : dataObj.coordinates;
  }
  return null;
}

// 12. HARİTADAKİ TÜM AKTİF ROTALARA ZOOMLAMA
function fitAllActiveBounds() {
  const bounds = L.latLngBounds();
  let count = 0;

  Object.values(activeLayers).forEach(group => {
    group.getLayers().forEach(layer => {
      if (layer instanceof L.Polyline) {
        bounds.extend(layer.getBounds());
        count++;
      }
    });
  });

  if (count > 0 && map) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

// 13. GPX İNDİRME TETİKLEYİCİSİ (MODAL KONTROLÜ)
function triggerGpxDownload(routeId) {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    alert("GPX indirmek için giriş yapmanız gerekmektedir.");
  }
}

// 14. URL PARAMETRELERİNİ KONTROL ETME
async function checkUrlParams() {
  let routeId = localStorage.getItem('ferdimen_pending_route');
  
  if (!routeId) {
    const urlParams = new URLSearchParams(window.location.search);
    routeId = urlParams.get('rota');
  }

  const isAuthorized = checkUserIsAuthorized();

  if (routeId) {
    localStorage.removeItem('ferdimen_pending_route');

    for (const cat of categoriesSummary) {
      const routes = await ensureCategoryLoaded(cat);
      const targetRoute = routes.find(r => r._id === routeId || r.id === routeId);
      if (targetRoute) {
        const catCard = document.getElementById(`cat_${cat.id}`);
        if (catCard) catCard.classList.add('open');
        selectAndHighlightRoute(targetRoute);

        if (isAuthorized) {
          downloadGpxFile(targetRoute);
        }
        break;
      }
    }
  }

  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// --- SAKLI / AKTİF ROTA BİLGİSİ ---
let currentActiveRoute = null;

const originalSelectAndHighlightRoute = selectAndHighlightRoute;
selectAndHighlightRoute = function(route) {
  currentActiveRoute = route;
  if (typeof currentSelectedRouteId !== 'undefined') {
    currentSelectedRouteId = route._id || route.id;
  }
  originalSelectAndHighlightRoute(route);
};

// --- YETKİ KONTROLÜ ---
function checkUserIsAuthorized() {
  return localStorage.getItem('ferdimen_gpx_authorized') === 'true';
}

// --- GPX İNDİRME BUTONU TETİKLEYİCİSİ (YETKİ KONTROLLÜ) ---
function triggerGpxDownload(routeId) {
  const isAuthorized = checkUserIsAuthorized();

  if (isAuthorized) {
    let route = currentActiveRoute;
    if (routeId) {
      route = Object.values(loadedCategoryData).flat().find(r => (r._id === routeId || r.id === routeId));
    }
    if (route) {
      downloadGpxFile(route);
      return;
    }
  }

  if (typeof openLoginModal === 'function') {
    openLoginModal(routeId);
  }
}

// --- GPX DOSYASI OLUŞTURMA VE İNDİRME ---
function downloadGpxFile(route) {
  const geoObj = decodeGeoData(route.maskedGeoData);
  if (!geoObj) {
    alert("GPX verisi çözülemedi.");
    return;
  }

  const rawCoords = extractCoordinates(geoObj.gidis || geoObj) || [];
  
  let gpxContent = `<?xml version="1.1" encoding="UTF-8"?>
<gpx version="1.1" creator="Ferdimen" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(route.baslik)}</name>
    <trkseg>`;

  rawCoords.forEach(pt => {
    gpxContent += `
      <trkpt lat="${pt[1]}" lon="${pt[0]}"><ele>${pt[2] || 0}</ele></trkpt>`;
  });

  gpxContent += `
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${route.id || 'rota'}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// GİRİŞ / ÇIKIŞ BUTONUNU RENDER ETME
function renderAuthStatus() {
  const container = document.getElementById('authStatusContainer');
  if (!container) return;

  const isAuthorized = checkUserIsAuthorized();

  if (isAuthorized) {
    container.innerHTML = `
      <button onclick="handleLogout()" style="background: #dc2626; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: background 0.2s;">
        🚪 Çıkış Yap
      </button>
    `;
  } else {
    container.innerHTML = `
      <a href="ozel.html?redirect=rotalar.html" style="background: #2563eb; color: white; text-decoration: none; padding: 5px 10px; border-radius: 5px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.2s;">
        🔑 Giriş Yap
      </a>
    `;
  }
}

// ÇIKIŞ İŞLEMİ (Yetkiyi siler ve harita kısıtlamalarını uygulamak için sayfayı yeniler)
function handleLogout() {
  localStorage.removeItem('ferdimen_gpx_authorized');
  window.location.reload();
}
// portal.js dosyasının en altı
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadPortal();
  renderAuthStatus();
});
// Koordinatlardan (Lat, Lng, Ele) Mesafe, Tırmanış ve İniş Hesaplama
function calculateRouteStats(rawCoords) {
  let totalDistanceMeter = 0;
  let totalAscent = 0;
  let totalDescent = 0;

  for (let i = 0; i < rawCoords.length - 1; i++) {
    const pt1 = rawCoords[i];
    const pt2 = rawCoords[i + 1];

    // 1. İki nokta arası mesafe (Leaflet LatLng distanceTo metodu ile)
    const latLng1 = L.latLng(pt1[1], pt1[0]);
    const latLng2 = L.latLng(pt2[1], pt2[0]);
    totalDistanceMeter += latLng1.distanceTo(latLng2);

    // 2. Yükseklik farkı hesaplama (3. eleman yükselti / elevation ise)
    if (pt1.length >= 3 && pt2.length >= 3 && pt1[2] !== undefined && pt2[2] !== undefined) {
      const eleDiff = pt2[2] - pt1[2];
      if (eleDiff > 0) {
        totalAscent += eleDiff;
      } else {
        totalDescent += Math.abs(eleDiff);
      }
    }
  }

  return {
    mesafeKm: (totalDistanceMeter / 1000).toFixed(1),
    tirmanis: Math.round(totalAscent),
    inis: Math.round(totalDescent)
  };
}