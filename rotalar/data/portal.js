let map;
let activeLayers = {};
let categoriesSummary = [];
const loadedCategoryData = {};

let elevationChart = null;
let hoverMarker = null;
let currentRoutePoints = [];

// 1. HARİTAYI VE KATMANLARI İLKLENDİRME
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // Altlık Harita Katmanları
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  });

  const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: © OpenStreetMap, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
  });

  // Harita Oluşturma
  map = L.map('map', {
    center: [39.0, 35.0],
    zoom: 6,
    layers: [osmLayer],
    fullscreenControl: true // Tam ekran eklentisi
  });

  // Katman Yöneticisi Ekleme
  const baseMaps = {
    "OpenStreetMap": osmLayer,
    "OpenTopoMap (Arazi/Yükseklik)": topoLayer
  };
  L.control.layers(baseMaps).addTo(map);

  // Rota üzerindeki mouse takip imleci
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

    const catTitleText = document.createElement('span');
    catTitleText.innerText = cat.baslik;

    catTitleGroup.appendChild(catCheckbox);
    catTitleGroup.appendChild(catTitleText);
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
    });

    loadedCategoryData[cat.id] = routes;
    renderRoutesInCategory(cat.id, routes);
    return routes;
  } catch (err) {
    if (routeListContainer) {
      routeListContainer.innerHTML = '<div style="padding:8px; color:#ef4444; font-size:0.8rem;">Etaplar yüklenemedi.</div>';
    }
    return [];
  }
}

// 6. ETAP LİSTESİNİ YAZMA
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
      ${route.aciklama ? `<div style="font-size:0.78rem; color:#64748b; margin-top:2px;">${escapeXml(route.aciklama)}</div>` : ''}
    `;

    item.onclick = () => selectAndHighlightRoute(route);
    routeListContainer.appendChild(item);
  });
}

// 7. ETABA TIKLANDIĞINDA HARİTA VE YÜKSEKLİK GRAFİĞİNİ GÜNCELLEME
function selectAndHighlightRoute(route) {
  document.querySelectorAll('.route-item').forEach(el => el.classList.remove('active'));
  const currentItem = document.getElementById(`item_${route._id}`);
  if (currentItem) currentItem.classList.add('active');

  const layerGroup = toggleRouteOnMap(route, true);
  if (layerGroup) {
    const polyline = layerGroup.getLayers().find(l => l instanceof L.Polyline);
    if (polyline) {
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      polyline.openPopup();
    }
  }

  // Yükseklik Profili Çizimi
  const geoObj = decodeGeoData(route.maskedGeoData);
  const rawCoords = extractCoordinates(geoObj ? (geoObj.gidis || geoObj) : null);
  
  if (rawCoords && rawCoords.length > 0) {
    buildElevationChart(rawCoords);
  } else {
    document.getElementById('elevation-panel').style.display = 'none';
  }
}

// HARİTAYA ROTA VE PİNLERİ (WAYPOINTS) ÇİZME / KALDIRMA
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

  // --- 1. GİDİŞ / DÖNÜŞ ROTA ÇİZGİLERİ ---
  const gidisObj = geoObj.gidis || geoObj;
  const rawCoords = extractCoordinates(gidisObj);
  
  if (rawCoords && rawCoords.length > 0) {
    const leafletLatLngs = rawCoords.map(pt => [pt[1], pt[0]]);
    const polyline = L.polyline(leafletLatLngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85
    });

    const popupContent = `
      <div style="min-width: 180px;">
        <h4 style="margin: 0 0 6px 0; font-size: 0.95rem; color: #0f172a;">${escapeXml(route.baslik)}</h4>
        ${route.aciklama ? `<p style="margin:0 0 8px 0; font-size:0.82rem; color:#475569; line-height:1.3;">${escapeXml(route.aciklama)}</p>` : ''}
        <button onclick="triggerGpxDownload('${route._id}')" style="background:#059669; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem; width:100%;">
          📥 Rotayı İndir (.GPX)
        </button>
      </div>
    `;

    polyline.bindPopup(popupContent);
    layerGroup.addLayer(polyline);
  }

  // --- 2. DÖNÜŞ VE GEZİ NOKTALARI (WAYPOINTS / PINLER) ---
  const allWaypoints = [];
  if (geoObj.gidis && geoObj.gidis.waypoints) allWaypoints.push(...geoObj.gidis.waypoints);
  if (geoObj.donus && geoObj.donus.waypoints) allWaypoints.push(...geoObj.donus.waypoints);
  if (geoObj.waypoints) allWaypoints.push(...geoObj.waypoints);

  allWaypoints.forEach(wpt => {
    // Pin İkon Özelleştirmesi
    const pinMarker = L.circleMarker([wpt.lat, wpt.lon], {
      radius: 6,
      fillColor: '#f59e0b', // Turuncu Gezi Noktası Pini
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
  const R = 6371; // Dünya yarıçapı (km)
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

// 13. GPX İNDİRME TETİKLEYİCİSİ
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
  const urlParams = new URLSearchParams(window.location.search);
  const routeId = urlParams.get('rota');

  if (routeId) {
    for (const cat of categoriesSummary) {
      const routes = await ensureCategoryLoaded(cat);
      const targetRoute = routes.find(r => r._id === routeId || r.id === routeId);
      if (targetRoute) {
        const catCard = document.getElementById(`cat_${cat.id}`);
        if (catCard) catCard.classList.add('open');
        selectAndHighlightRoute(targetRoute);
        break;
      }
    }
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