let map;
let baseMaps = {};
let activeRouteLayers = {}; 
let hoverMarker = null;
let allRoutesData = [];
let chartInstance = null;
let currentSelectedRoute = null;

const startIcon = L.divIcon({
  className: 'custom-icon start-icon',
  html: '▶',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const stopIcon = L.divIcon({
  className: 'custom-icon stop-icon',
  html: '■',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadRoutesData();
});

function initMap() {
  const osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  });

  const openTopoTile = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© OpenTopoMap'
  });

  baseMaps = {
    "OpenStreetMap": osmTile,
    "OpenTopoMap (Topoğrafya)": openTopoTile
  };

  map = L.map('map', {
    center: [39.92077, 32.85411],
    zoom: 6,
    layers: [osmTile]
  });

  L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

  const downloadControl = L.control({ position: 'bottomright' });
  downloadControl.onAdd = function() {
    const div = L.DomUtil.create('div', 'gpx-download-control');
    div.innerHTML = `
      <button class="gpx-btn" onclick="handleGPXDownload()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Rotayı İndir (.GPX)
      </button>
    `;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  downloadControl.addTo(map);
}

// Rotaları data/rotalar.json Yolundan Okuma
async function loadRoutesData() {
  try {
    const response = await fetch('data/rotalar.json');
    if (!response.ok) throw new Error("JSON dosyası okunamadı.");
    
    allRoutesData = await response.json();
    allRoutesData.forEach((r, idx) => { r._id = r.id || `route_${idx}`; });
    sortRoutesNewToOld(allRoutesData);

    renderCategories(allRoutesData);
  } catch (error) {
    console.error("Yükleme Hatası:", error);
    const container = document.getElementById('categoryContainer');
    if (container) {
      container.innerHTML = '<p style="padding:10px; color:#ef4444;">Rotalar yüklenemedi.</p>';
    }
  }
}

function sortRoutesNewToOld(routes) {
  routes.sort((a, b) => {
    const numA = parseFloat(a.siraNo || a.etapNo || a.gun || 0);
    const numB = parseFloat(b.siraNo || b.etapNo || b.gun || 0);
    if (numA && numB && numA !== numB) return numB - numA;
    return 0;
  });
}

function renderCategories(routes) {
  const container = document.getElementById('categoryContainer');
  if (!container) return;
  container.innerHTML = '';

  const categories = {};
  routes.forEach(route => {
    const catName = route.turKategorisi || 'Diğer Rotalar';
    if (!categories[catName]) categories[catName] = [];
    categories[catName].push(route);
  });

  Object.keys(categories).forEach((catName) => {
    const catCard = document.createElement('div');
    catCard.className = 'category-card';

    const header = document.createElement('div');
    header.className = 'category-header';

    const catTitleGroup = document.createElement('div');
    catTitleGroup.className = 'category-title-group';

    const catCheckbox = document.createElement('input');
    catCheckbox.type = 'checkbox';
    catCheckbox.className = 'map-check';
    
    catCheckbox.onclick = (e) => {
      e.stopPropagation();
      const isChecked = catCheckbox.checked;

      if (isChecked) {
        categories[catName].forEach(route => toggleRouteOnMap(route, true));
        fitAllActiveBounds();
      } else {
        categories[catName].forEach(route => toggleRouteOnMap(route, false));
        closeElevationPanel();
        document.querySelectorAll('.route-item').forEach(i => i.classList.remove('active'));
      }
    };

    const catTitleText = document.createElement('span');
    catTitleText.innerText = catName;

    catTitleGroup.appendChild(catCheckbox);
    catTitleGroup.appendChild(catTitleText);

    const countBadge = document.createElement('small');
    countBadge.innerText = `(${categories[catName].length} Etap)`;

    header.appendChild(catTitleGroup);
    header.appendChild(countBadge);

    header.onclick = (e) => {
      if (e.target === catCheckbox) return;
      document.querySelectorAll('.category-card').forEach(c => {
        if (c !== catCard) c.classList.remove('open');
      });
      catCard.classList.toggle('open');
    };

    const routeList = document.createElement('div');
    routeList.className = 'route-list';

    categories[catName].forEach(route => {
      const item = document.createElement('div');
      item.className = 'route-item';
      item.id = `item_${route._id}`;

      const titleText = document.createElement('span');
      titleText.innerText = route.baslik;

      item.appendChild(titleText);
      item.onclick = () => selectAndHighlightRoute(route);

      routeList.appendChild(item);
    });

    catCard.appendChild(header);
    catCard.appendChild(routeList);
    container.appendChild(catCard);
  });
}

function selectAndHighlightRoute(route) {
  if (!route) return;

  currentSelectedRoute = route;

  const catName = route.turKategorisi || 'Diğer Rotalar';
  document.querySelectorAll('.category-card').forEach(card => {
    const titleSpan = card.querySelector('.category-title-group span');
    if (titleSpan && titleSpan.innerText === catName) {
      card.classList.add('open');
    } else {
      card.classList.remove('open');
    }
  });

  document.querySelectorAll('.route-item').forEach(i => i.classList.remove('active'));
  const activeItem = document.getElementById(`item_${route._id}`);
  if (activeItem) {
    activeItem.classList.add('active');
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  toggleRouteOnMap(route, true);

  if (activeRouteLayers[route._id]) {
    const bounds = activeRouteLayers[route._id].getBounds();
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  const geoObj = decodeGeoData(route.maskedGeoData);
  let profileData = null;

  if (geoObj) {
    profileData = geoObj.elevationProfile || (geoObj.gidis && geoObj.gidis.elevationProfile) || null;
  }
  if (!profileData && route.elevationProfile) {
    profileData = route.elevationProfile;
  }

  if (profileData && profileData.length > 0) {
    renderElevationChart(profileData);
  } else {
    closeElevationPanel();
  }
}

function toggleRouteOnMap(route, isVisible) {
  if (isVisible) {
    if (!activeRouteLayers[route._id]) {
      const layerGroup = createRouteLayerGroup(route);
      if (layerGroup) {
        activeRouteLayers[route._id] = layerGroup;
        layerGroup.addTo(map);
      }
    }
  } else {
    if (activeRouteLayers[route._id]) {
      map.removeLayer(activeRouteLayers[route._id]);
      delete activeRouteLayers[route._id];
    }
  }
}

function createRouteLayerGroup(route) {
  const geoObj = decodeGeoData(route.maskedGeoData);
  if (!geoObj) return null;

  const layerGroup = L.featureGroup();

  if (geoObj.gidis && geoObj.gidis.coordinates && geoObj.gidis.coordinates[0]) {
    const gidisCoords = geoObj.gidis.coordinates[0].map(pt => [pt[1], pt[0]]);
    const line = L.polyline(gidisCoords, { color: '#2563eb', weight: 5, opacity: 0.85 });
    
    const startPin = L.marker(gidisCoords[0], { icon: startIcon });
    const endPin = L.marker(gidisCoords[gidisCoords.length - 1], { icon: stopIcon });

    startPin.bindTooltip(`<b>${route.baslik}</b><br>Başlangıç`, { direction: 'top' });
    endPin.bindTooltip(`<b>${route.baslik}</b><br>Bitiş`, { direction: 'top' });

    const handleRouteClick = (e) => {
      if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
      selectAndHighlightRoute(route);
    };

    startPin.on('click', handleRouteClick);
    endPin.on('click', handleRouteClick);
    line.on('click', handleRouteClick);

    layerGroup.addLayer(line);
    layerGroup.addLayer(startPin);
    layerGroup.addLayer(endPin);
  }

  return layerGroup;
}

function fitAllActiveBounds() {
  const featureGroup = L.featureGroup(Object.values(activeRouteLayers));
  const bounds = featureGroup.getBounds();
  if (bounds && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

// --- CLOUDFLARE ZERO TRUST (ozel.html) KORUMALI İNDİRME İŞLEMİ ---
async function handleGPXDownload() {
  if (!currentSelectedRoute) {
    alert("Lütfen önce listeden veya haritadan bir rota seçiniz.");
    return;
  }

  try {
    // Aynı dizinde (root) yer alan Zero Trust korumalı ozel.html sayfasına istek atılır
    const authCheck = await fetch('ozel.html', {
      method: 'GET',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      redirect: 'manual'
    });

    if (authCheck.type === 'opaqueredirect' || authCheck.status === 401 || authCheck.status === 403 || authCheck.redirected) {
      openAccessModal();
      return;
    }

    if (!authCheck.ok) {
      openAccessModal();
      return;
    }

    generateAndDownloadGPX(currentSelectedRoute);

  } catch (err) {
    openAccessModal();
  }
}

function generateAndDownloadGPX(route) {
  const geoObj = decodeGeoData(route.maskedGeoData);
  if (!geoObj || !geoObj.gidis || !geoObj.gidis.coordinates) {
    alert("Bu rotanın GPX verisi okunamadı.");
    return;
  }

  const coords = geoObj.gidis.coordinates[0];
  let trkpts = "";

  coords.forEach(pt => {
    const lon = pt[0];
    const lat = pt[1];
    const ele = pt[2] !== undefined ? pt[2] : 0;
    trkpts += `      <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>\n`;
  });

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ganos Bisiklet" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.baslik)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(route.baslik)}</name>
    <trkseg>
${trkpts}    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(route.baslik)}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openAccessModal() {
  const modal = document.getElementById('accessModal');
  if (modal) modal.style.display = 'flex';
}

function closeAccessModal() {
  const modal = document.getElementById('accessModal');
  if (modal) modal.style.display = 'none';
}

function copyToClipboard(elementId, btnElem) {
  const text = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btnElem.innerText;
    btnElem.innerText = 'Kopyalandı!';
    btnElem.style.background = '#22c55e';
    btnElem.style.color = '#fff';
    setTimeout(() => {
      btnElem.innerText = originalText;
      btnElem.style.background = '#cbd5e1';
      btnElem.style.color = '#000';
    }, 2000);
  });
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function renderElevationChart(profile) {
  const panel = document.getElementById('elevationPanel');
  const canvas = document.getElementById('elevationChart');

  if (!panel || !canvas) return;

  panel.classList.add('active');

  setTimeout(() => {
    if (map) map.invalidateSize();

    const labels = profile.map(p => {
      if (Array.isArray(p)) return Number(p[0]).toFixed(1);
      return Number(p.km !== undefined ? p.km : 0).toFixed(1);
    });

    const elevations = profile.map(p => {
      if (Array.isArray(p)) return Math.round(Number(p[1]));
      return Math.round(Number(p.ele !== undefined ? p.ele : 0));
    });

    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Yükseklik (m)',
          data: elevations,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#dc2626'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        onHover: (event, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            const pt = profile[idx];

            let kmVal = 0, eleVal = 0, latVal = null, lonVal = null;

            if (Array.isArray(pt)) {
              kmVal = pt[0]; eleVal = pt[1]; latVal = pt[2] || null; lonVal = pt[3] || null;
            } else if (typeof pt === 'object' && pt !== null) {
              kmVal = pt.km !== undefined ? pt.km : 0;
              eleVal = pt.ele !== undefined ? pt.ele : 0;
              latVal = pt.lat !== undefined ? pt.lat : null;
              lonVal = pt.lon !== undefined ? pt.lon : null;
            }

            const distElem = document.getElementById('hoverDist');
            const eleElem = document.getElementById('hoverEle');
            if (distElem) distElem.innerText = `${Number(kmVal).toFixed(1)} km`;
            if (eleElem) eleElem.innerText = `${Math.round(Number(eleVal))} m`;

            if (latVal && lonVal) {
              if (!hoverMarker) {
                hoverMarker = L.circleMarker([latVal, lonVal], {
                  radius: 7, color: '#dc2626', fillColor: '#ffffff', fillOpacity: 1, weight: 3
                }).addTo(map);
              } else {
                hoverMarker.setLatLng([latVal, lonVal]);
              }
            }
          }
        },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 12 } },
          y: { beginAtZero: false }
        }
      }
    });
  }, 50);
}

function closeElevationPanel() {
  const panel = document.getElementById('elevationPanel');
  if (panel) panel.classList.remove('active');
  
  if (hoverMarker && map) {
    map.removeLayer(hoverMarker);
    hoverMarker = null;
  }
  if (map) setTimeout(() => map.invalidateSize(), 150);
}

function decodeGeoData(maskedGeoData) {
  if (!maskedGeoData) return null;
  try {
    const jsonStr = decodeURIComponent(escape(atob(maskedGeoData)));
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}