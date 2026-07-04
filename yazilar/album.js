// album.js
(function() {
    const KOLON_SAYISI = 5; // İstediğiniz kolon sayısı
    let tumBuyukResimler = []; 
    let mevcutIndex = 0;
    let slaytZamanlayici = null;
    const SLAYT_SURESI = 3000; 

    function guvenliAlbumSisteminiKur() {
        // Tüm sayfa metnini al
        const htmlIcerik = document.body.innerHTML;
        
        // Gizli satır başları, <p> veya <br> etiketleri olsa bile esnekçe yakalayan yeni Regex
        const regex = /\[fotoalbum\]([\s\S]*?)\[\/fotoalbum\]/g;
        
        // Sayfada [fotoalbum] yoksa hiç çalışma
        if (!htmlIcerik.match(regex)) return;

        // Sayfa HTML'ini bozmadan sadece metin üzerinden güvenli arama yapıyoruz
        let degismisHtml = htmlIcerik.replace(regex, function(match, icerik) {
            // Etiketlerin arasındaki HTML nesnelerini güvenli bir sanal hafızaya al
            const sanalDiv = document.createElement('div');
            sanalDiv.innerHTML = icerik;
            
            const nesneler = Array.from(sanalDiv.getElementsByTagName('object'));
            if (nesneler.length === 0) return '';

            let kartlarHtml = `<div class="album-grid" style="grid-template-columns: repeat(${KOLON_SAYISI}, minmax(0, 1fr)) !important;">`;
            
            nesneler.forEach(function(nesne) {
                const hamUrl = nesne.getAttribute('data');
                if (hamUrl) {
                    // Google URL parametrelerini kesin olarak temizle ve sabitle
                    const temizUrl = hamUrl.split('=')[0]; 
                    let kucukResimUrl = temizUrl + '=w150-h100';
                    let buyukResimUrl = temizUrl + '=w1920-h1080';

                    tumBuyukResimler.push(buyukResimUrl);
                    const fotoIndex = tumBuyukResimler.length - 1;

                    kartlarHtml += `
                        <div class="album-card" onclick="albumPopupAc(${fotoIndex})">
                            <object data="${kucukResimUrl}" type="image/jpeg" loading="lazy" width="320" height="200"></object>
                        </div>
                    `;
                }
            });
            
            kartlarHtml += '</div>';
            return kartlarHtml;
        });
        
        // Sayfayı tek seferde ve güvenle güncelle
        document.body.innerHTML = degismisHtml;

        // Ortak Popup Modülünü Sona Ekle
        if (!document.getElementById('albumPopupOverlay')) {
            const popupIskelet = document.createElement('div');
            popupIskelet.id = 'albumPopupOverlay';
            popupIskelet.className = 'album-popup-overlay';
            popupIskelet.innerHTML = `
                <div class="album-popup-controls">
                    <span id="albumFullscreenBtn" class="album-control-btn" onclick="albumTamEkranTetikle()" title="Tam Ekran">⛶</span>
                    <span id="albumSlideBtn" class="album-control-btn" onclick="albumSlaytDurdurBaslat()" title="Slayt Gösterisi Yap">▶</span>
                    <span class="album-control-btn close-btn" onclick="albumPopupKapat()" title="Kapat">×</span>
                </div>
                <span class="album-nav-arrow arrow-left" onclick="albumGeriGit(event)">‹</span>
                <object id="albumPopupContent" class="album-popup-content" data="" type="image/jpeg"></object>
                <span class="album-nav-arrow arrow-right" onclick="albumIleriGit(event)">›</span>
            `;
            document.body.appendChild(popupIskelet);

            popupIskelet.addEventListener('click', function(e) {
                if (e.target === popupIskelet) albumPopupKapat();
            });

            document.addEventListener('keydown', function(e) {
                const overlay = document.getElementById('albumPopupOverlay');
                if (overlay && overlay.classList.contains('active')) {
                    if (e.key === "ArrowRight") albumIleriGit();
                    if (e.key === "ArrowLeft") albumGeriGit();
                    if (e.key === "Escape" && !document.fullscreenElement) albumPopupKapat();
                }
            });

            document.addEventListener('fullscreenchange', function() {
                const btn = document.getElementById('albumFullscreenBtn');
                if (!document.fullscreenElement && btn) btn.innerHTML = "⛶";
            });
        }
    }

    // Küresel Fonksiyonları Tarayıcıya Tanıt
    window.albumPopupAc = function(index) {
        mevcutIndex = index;
        const overlay = document.getElementById('albumPopupOverlay');
        const popupContent = document.getElementById('albumPopupContent');
        if (overlay && popupContent) {
            popupContent.setAttribute('data', tumBuyukResimler[mevcutIndex]);
            overlay.classList.add('active');
        }
    };

    window.albumPopupKapat = function() {
        albumSlaytDurdur();
        if (document.fullscreenElement) document.exitFullscreen().catch(function() {});
        const overlay = document.getElementById('albumPopupOverlay');
        const popupContent = document.getElementById('albumPopupContent');
        if (overlay && popupContent) {
            overlay.classList.remove('active');
            popupContent.setAttribute('data', '');
        }
    };

    window.albumIleriGit = function(e) {
        if (e) e.stopPropagation();
        if (tumBuyukResimler.length === 0) return;
        mevcutIndex = (mevcutIndex + 1) % tumBuyukResimler.length;
        document.getElementById('albumPopupContent').setAttribute('data', tumBuyukResimler[mevcutIndex]);
    };

    window.albumGeriGit = function(e) {
        if (e) e.stopPropagation();
        if (tumBuyukResimler.length === 0) return;
        mevcutIndex = (mevcutIndex - 1 + tumBuyukResimler.length) % tumBuyukResimler.length;
        document.getElementById('albumPopupContent').setAttribute('data', tumBuyukResimler[mevcutIndex]);
    };

    window.albumTamEkranTetikle = function() {
        const overlay = document.getElementById('albumPopupOverlay');
        const btn = document.getElementById('albumFullscreenBtn');
        if (!document.fullscreenElement) {
            overlay.requestFullscreen().then(function() { btn.innerHTML = "↙↘"; });
        } else {
            document.exitFullscreen().then(function() { btn.innerHTML = "⛶"; });
        }
    };

    window.albumSlaytDurdurBaslat = function() {
        const btn = document.getElementById('albumSlideBtn');
        if (slaytZamanlayici === null) {
            albumIleriGit(); 
            slaytZamanlayici = setInterval(albumIleriGit, SLAYT_SURESI);
            btn.innerHTML = "⏸";
        } else {
            albumSlaytDurdur();
        }
    };

    function albumSlaytDurdur() {
        const btn = document.getElementById('albumSlideBtn');
        if (slaytZamanlayici !== null) {
            clearInterval(slaytZamanlayici);
            slaytZamanlayici = null;
            if (btn) btn.innerHTML = "▶";
        }
    }

    // Sayfa tamamen hazır olduğunda sistemi çalıştır
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", guvenliAlbumSisteminiKur);
    } else {
        // Dinamik tek sayfa geçişleri veya anlık yüklemeler için doğrudan tetikleme
        setTimeout(guvenliAlbumSisteminiKur, 100);
    }
})();