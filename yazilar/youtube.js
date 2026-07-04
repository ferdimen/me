/* ==========================================================================
   [youtube] YOUTUBE EMBED DÖNÜŞTÜRÜCÜ MOTORU (data/video.js)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    // Yazılarınızın yer aldığı ana div/section alanını buluyoruz
    const yaziAlani = document.getElementById("yazi");
    if (!yaziAlani) return;

    // [youtube] URL [/youtube] kalıbını tarayan düzenli ifade (Regex)
    const regex = /\[youtube\]\s*(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11}))\s*\[\/youtube\]/g;

    let icerik = yaziAlani.innerHTML;

    // Bulunan kısa kodları 16:9 kilitli HTML çerçevesine dönüştür
    icerik = icerik.replace(regex, function(match, url, videoId) {
        // YouTube'dan 16:9 oranına en uygun hqdefault kapak resmini çeker
        const kapakResmi = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        
        return `
            <div class="custom-youtube-box">
                <div class="youtube-poster" style="background-image: url('${kapakResmi}');" onclick="oynatYoutubeVideo(this, '${videoId}')">
                    <div class="youtube-play-btn">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
            </div>
        `;
    });

    yaziAlani.innerHTML = icerik;
});

// Tıklandığında boyutu milimetrik koruyarak oynatan global fonksiyon
function oynatYoutubeVideo(element, videoId) {
    const kapsayici = element.parentElement;
    
    // Çerçevenin içindeki poster kodunu silip yerine boyutları kilitli iframe basıyoruz
    kapsayici.innerHTML = `
        <iframe 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
            title="YouTube video player" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
        </iframe>
    `;
}