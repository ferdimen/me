// Popup içindeki "Devamını Oku / Kapat" tetikleyicisi global fonksiyon olarak kalmalıdır
function togglePopupText(element) {
    const container = element.parentNode;
    const moreText = container.querySelector('.ps-more-text');
    const dots = container.querySelector('.ps-dots');
    
    if (moreText && moreText.style.display === 'inline') {
        moreText.style.display = 'none';
        dots.style.display = 'inline';
        element.textContent = "Devamını Oku"; 
    } else if (moreText) {
        moreText.style.display = 'inline';
        dots.style.display = 'none';
        element.textContent = " Kapat"; 
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const rootContainer = document.getElementById("polarsteps-tracker-root");
    
    function utf8Decode(str) {
        if (!str) return "";
        try { return decodeURIComponent(escape(str)); } catch (e) { return str; }
    }

    function polarstepsApiUrlOlustur(url) {
        if (!url || url.trim() === "") return null;
        const temizUrl = url.trim().replace(/\/$/, ""); 
        const parcalar = temizUrl.split('/');
        const tripSlug = parcalar[parcalar.length - 1];
        if (!tripSlug || temizUrl.indexOf("polarsteps.com") === -1) return null;
        const tripId = tripSlug.split('-')[0];
        return `https://api.polarsteps.com/trips/${tripId}`;
    }

    function LeafletGarantisi(callback) {
        if (typeof L !== 'undefined') { callback(); return; }
        const lCss = document.createElement('link'); lCss.rel = 'stylesheet'; lCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(lCss);
        const lScript = document.createElement('script'); lScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        lScript.onload = callback;
        lScript.onerror = function() { rootContainer.innerHTML = ''; };
        document.body.appendChild(lScript);
    }

    function aktifTurYokEkraniBas() {
        rootContainer.innerHTML = `
            <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 40px 20px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 600px; margin: 40px auto;">
                <div style="width: 60px; height: 60px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;">
                    <svg style="width: 30px; height: 30px; fill: #9ca3af;" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>
                <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 1.2rem; font-weight: bold;">Aktif Tur Bulunmuyor</h3>
                <p style="margin: 0; color: #6b7280; font-size: 0.95rem; line-height: 1.5;">Şu anda herkese açık olarak paylaşılan canlı bir seyahat veya bisiklet turu bulunmamaktadır. <a href="https://www.polarsteps.com/ferdimen" target="_blank">Yeni rotalarda</a> görüşmek üzere!</p>
            </div>
        `;
    }

    function tamamenGizle() {
        rootContainer.innerHTML = ''; 
    }

    const iconFullscreen = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
    const iconExitFullscreen = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;

    // 1. Yerel Ayar Dosyasını Oku
    fetch('nerdeyim/konum.json?v=' + new Date().getTime())
	.then(res => {
            if (!res.ok) throw new Error("JSON_DOSYASI_BULUNAMADI");
            return res.json();
        })
        .then(localData => {
            const isTourActive = (localData.aktifTur || "evet").toLowerCase() === "evet";
            const pLink = localData.canliTakipUrl;
            
// --- GÜNCELLENEN KISIM: BAĞIMSIZ LİNK OLARAK PİN EKLEME ---
            const polarstepsIcon = document.querySelector('.header-socials a[title="Polarsteps"]');
            if (polarstepsIcon) {
                // Mükerrer eklemeyi önlemek için üst kapsayıcıdaki eski pini temizle
                const parentContainer = polarstepsIcon.parentNode;
                const eskiPin = parentContainer.querySelector('.nav-live-link');
                if (eskiPin) eskiPin.remove();

                if (isTourActive) {
                    // Pini Polarsteps ikonunun dışına, bağımsız bir <a> etiketi olarak ekliyoruz  <a href="/#takip" class="nav-live-link" title="Canlı Tur Takibi">
                    const pinHTML = `
					<a href="${pLink}" class="nav-live-link" title="Canlı Tur Takibi">
                            <span class="nav-live-pin-container">
                                <span class="nav-live-pin"></span>
                                <span class="nav-live-pulse"></span>
                            </span>
                        </a>
                    `;
                    // İkonun hemen sağına yerleştir
                    polarstepsIcon.insertAdjacentHTML('afterend', pinHTML);
                }
            }
            // -------------------------------------------------------------
            
            if (!pLink || pLink.trim() === "") {
                aktifTurYokEkraniBas();
                return null;
            }

            if (!isTourActive) {
                tamamenGizle();
                return null;
            }

            const apiUrl = polarstepsApiUrlOlustur(pLink);
            if (!apiUrl) {
                aktifTurYokEkraniBas();
                return null;
            }

            // JSON Ayarlarını Global Değişkenlere Ata
            window.customTurAdi = localData["tur-adi"] || "Bisiklet Turu";
            window.customAciklama = localData["aciklama"] || "";
            window.rotaGoster = (localData["rota"] || "evet").toLowerCase() === "evet";
            window.gunleriGoster = localData["gunleri-goster"] || "hepsi"; 
            window.karakterSiniri = parseInt(localData["karakter-siniri"]) || 100;
            window.filtreYazi = (localData["yazi"] || "evet").toLowerCase() === "evet";
            window.zoomSeviyesi = parseInt(localData["zoom-seviyesi"]) || 9;
            window.cizgiRengi = localData["cizgi-rengi"] || "#dc2626";
            window.aracListesi = localData["araclar"] || {};

            // Arayüzü İnşa Et
            rootContainer.innerHTML = `
                <h2 style="font-size: 1.5rem; font-weight: bold; color: #0f0f0f; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                    <span style="display:inline-block; width:12px; height:12px; background-color:#22c55e; border-radius:50%; animation: livePulse 1.5s infinite;"></span>
                    Neredeyim? / CANLI Rota Takibi
                </h2>
                <div style="display: flex; flex-wrap: wrap; gap: 20px; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div id="live-map-container" style="flex: 1 1 600px; height: 460px; position: relative; background: #eee;">
                        <div id="live-map" style="width: 100%; height: 100%;"></div>
                        <div id="map-loader" style="position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#666; font-weight:bold; z-index:1000;">Yollar ve konumlar işleniyor...</div>
                    </div>
                    <div style="flex: 1 1 350px; padding: 25px; display: flex; flex-direction: column; justify-content: space-between; background: #f9f9f9;">
                        <div>
                            <span id="tracker-tour-name" style="display: inline-block; background: #0f0f0f; color: #fff; font-size: 0.75rem; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 10px;">${window.customTurAdi}</span>
                            <p id="tracker-status" style="font-size: 0.95rem; line-height: 1.5; color: #555; margin: 0 0 15px 0; font-weight: normal;">${window.customAciklama}</p>
                            
                            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eaeaea; margin-bottom: 15px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02); text-align: center;">
                                <span style="font-size: 0.75rem; color: #777; display: block; text-transform: uppercase;">Toplam Mesafe</span>
                                <div id="tracker-stats-string" style="font-size: 1.6rem; font-weight: bold; color: #dc2626; line-height: 1.3; margin-top: 2px;">-</div>
                            </div>

                            <div id="route-cities-container" style="display:none; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #eaeaea; margin-bottom: 15px; max-height: 85px; overflow-y: auto;">
                                <span style="font-size: 0.72rem; color: #888; display: block; text-transform: uppercase; margin-bottom: 4px; font-weight: bold;">Geçilen Rota</span>
                                <div id="route-cities-list" style="font-size: 0.85rem; color: #333; line-height: 1.4; word-break: break-word;"></div>
                            </div>

                            <div style="background: #fff; padding: 8px 12px; border-radius: 8px; border: 1px solid #eaeaea; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.75rem; color: #777; text-transform: uppercase;">Son Güncelleme</span>
                                <b id="tracker-time" style="font-size: 0.85rem; color: #0f0f0f;">-</b>
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <a id="tracker-polarsteps-btn" href="${pLink}" target="_blank" style="flex: 1; text-align: center; background: #009688; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; text-decoration: none;">Rota Sayfasına Git</a>
                        </div>
                    </div>
                </div>
            `;

            return fetch(apiUrl);
        })
        .then(res => {
            if (!res) return null; 
            if (!res.ok) throw new Error("POLARSTEPS_API_HATASI");
            return res.json();
        })
        .then(data => {
            if (!data) return;

            const totalKm = data.total_km ? Math.round(data.total_km) : 0;
            document.getElementById("tracker-stats-string").textContent = `${totalKm} Km`;

            const tumAdimlar = data.all_steps || [];
            if (tumAdimlar.length === 0) throw new Error("ROTA_YOK");

            tumAdimlar.sort((a, b) => (a.start_time || 0) - (b.start_time || 0));

            const sonAdim = tumAdimlar[tumAdimlar.length - 1];
            const suan = new Date().getTime() / 1000;
            const sonGuncellemeZamani = sonAdim.start_time || suan;
            document.getElementById("tracker-time").textContent = new Date(sonGuncellemeZamani * 1000).toLocaleString('tr-TR', {hour: '2-digit', minute:'2-digit', day:'numeric', month:'short'});

            // Rota Filtreleme ve İl/İlçe Listesini Oluşturma
            const birGunSaniye = 24 * 60 * 60;
            let zamanLimiti = 0;
            if (window.gunleriGoster !== "hepsi") {
                const gunSayisi = parseInt(window.gunleriGoster) || 1;
                zamanLimiti = sonGuncellemeZamani - (gunSayisi * birGunSaniye);
            }

            if (window.rotaGoster) {
                const durakIsimleri = [];
                tumAdimlar.forEach((a) => {
                    if (a.location?.name) {
                        const adimZamani = a.start_time || 0;
                        if (window.gunleriGoster !== "hepsi" && adimZamani < zamanLimiti) return;
                        
                        const hasDescription = a.description && a.description.trim().length > 0;
                        if (window.filtreYazi && !hasDescription && a !== sonAdim) return;

                        const temizIsim = utf8Decode(a.location.name).split(',')[0].trim();
                        if (temizIsim && durakIsimleri[durakIsimleri.length - 1] !== temizIsim) {
                            durakIsimleri.push(temizIsim);
                        }
                    }
                });
                if (durakIsimleri.length > 0) {
                    document.getElementById("route-cities-container").style.display = "block";
                    document.getElementById("route-cities-list").textContent = durakIsimleri.join(" > ");
                }
            }

            LeafletGarantisi(function() {
                const loader = document.getElementById("map-loader");
                if(loader) loader.remove();

                const sonLat = sonAdim.location?.lat;
                const sonLng = sonAdim.location?.lon;
                
                const liveMap = L.map('live-map', { scrollWheelZoom: false }).setView([sonLat, sonLng], window.zoomSeviyesi);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap | &copy;  <a href="https://ferdimen.com/" target="_blank">Neredeyim? Canlı Rota Takip Sistemi</a>'
                }).addTo(liveMap);

                // Tam Ekran Kontrolü
                const FullscreenControl = L.Control.extend({
                    options: { position: 'topleft' },
                    onAdd: function () {
                        const container = L.DomUtil.create('div', 'leaflet-control-fullscreen-btn');
                        container.innerHTML = iconFullscreen;
                        L.DomEvent.on(container, 'click', function (e) {
                            L.DomEvent.stopPropagation(e);
                            const mapDiv = document.getElementById('live-map-container');
                            if (!document.fullscreenElement) {
                                if (mapDiv.requestFullscreen) mapDiv.requestFullscreen();
                                mapDiv.classList.add('leaflet-fullscreen-mode');
                                container.innerHTML = iconExitFullscreen;
                            } else {
                                if (document.exitFullscreen) document.exitFullscreen();
                                mapDiv.classList.remove('leaflet-fullscreen-mode');
                                container.innerHTML = iconFullscreen;
                            }
                            setTimeout(() => { liveMap.invalidateSize(); }, 250);
                        });
                        return container;
                    }
                });
                liveMap.addControl(new FullscreenControl());

                // Çizgi Çizimi
                for (let i = 1; i < tumAdimlar.length; i++) {
                    const p1 = tumAdimlar[i - 1];
                    const p2 = tumAdimlar[i];
                    
                    if (p1.location?.lat && p1.location?.lon && p2.location?.lat && p2.location?.lon) {
                        const adimZamani = p2.start_time || 0;
                        if (window.gunleriGoster !== "hepsi" && adimZamani < zamanLimiti) continue;

                        const tType = p2.transport_type || "bike";
                        const aracAyari = window.aracListesi[tType] || window.aracListesi["other"] || { renk: window.cizgiRengi };

                        L.polyline([[p1.location.lat, p1.location.lon], [p2.location.lat, p2.location.lon]], {
                            color: aracAyari.renk || window.cizgiRengi,
                            weight: 3.5,
                            opacity: 0.85,
                            dashArray: tType === 'foot' ? '2, 5' : '3, 6',
                            lineJoin: 'round'
                        }).addTo(liveMap);
                    }
                }

                // Pinleri Yerleştirme
                tumAdimlar.forEach((adim, index) => {
                    const lat = adim.location?.lat;
                    const lng = adim.location?.lon;
                    const adimZamani = adim.start_time || 0;

                    if (lat && lng) {
                        const isSonKonum = (index === tumAdimlar.length - 1);
                        if (window.gunleriGoster !== "hepsi" && adimZamani < zamanLimiti && !isSonKonum) return;

                        const hasDescription = adim.description && adim.description.trim().length > 0;
                        
                        let pinKoyulsunMu = false;
                        if (window.filtreYazi && hasDescription) pinKoyulsunMu = true;
                        if (isSonKonum) pinKoyulsunMu = true; 

                        if (pinKoyulsunMu) {
                            const adimBaslik = utf8Decode(adim.location?.name || "Durak");
                            const tamAciklama = adim.description ? utf8Decode(adim.description) : "";
                            let adimAciklamaHtml = tamAciklama;
                            
                            if (tamAciklama.length > window.karakterSiniri) {
                                const ilkKisim = tamAciklama.substring(0, window.karakterSiniri);
                                const kalanKisim = tamAciklama.substring(window.karakterSiniri);
                                adimAciklamaHtml = `${ilkKisim}<span class="ps-dots">...</span><span class="ps-more-text">${kalanKisim}</span><span class="ps-trigger-span" onclick="togglePopupText(this)">Devamını Oku</span>`;
                            }

                            let popupHtml = `<div style="font-family:Arial; font-size:12px; max-width:220px;"><b>${adimBaslik}</b>`;
                            if (tamAciklama) popupHtml += `<p style="margin:5px 0; color:#333; line-height:1.4; font-size:11.5px;">${adimAciklamaHtml}</p>`;
                            popupHtml += `</div>`;

                            const tType = adim.transport_type || "bike";
                            const polarstepsIconUrl = `https://www.polarsteps.com/assets/img/transport-types/${tType}-white.svg`;

                            if (isSonKonum) {
                                const liveIcon = L.divIcon({
                                    className: 'custom-live-marker',
                                    html: `<div style="position: relative; width: 22px; height: 22px; background: #dc2626; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;"><img src="${polarstepsIconUrl}" class="ps-map-icon-img-white" onerror="this.style.display='none'" /><div style="position: absolute; top: -6px; left: -6px; width: 32px; height: 32px; border: 1px solid #dc2626; border-radius: 50%; animation: markerPulse 1.5s infinite;"></div></div>`,
                                    iconSize: [22, 22],
                                    iconAnchor: [11, 11]
                                });
                                L.marker([lat, lng], { icon: liveIcon }).addTo(liveMap).bindPopup(popupHtml).openPopup();
                            } else {
                                const araIcon = L.divIcon({
                                    className: 'history-marker',
                                    html: `<div style="width: 18px; height: 18px; background: #e2e8f0; border: 2px solid #94a3b8; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center;"><img src="${polarstepsIconUrl}" class="ps-map-icon-img" onerror="this.style.display='none'" /></div>`,
                                    iconSize: [18, 18],
                                    iconAnchor: [9, 9]
                                });
                                L.marker([lat, lng], { icon: araIcon }).addTo(liveMap).bindPopup(popupHtml);
                            }
                        }
                    }
                });

            });
        })
        .catch(err => {
            console.error("Hata Kontrolü:", err);
            aktifTurYokEkraniBas();
        });
});
