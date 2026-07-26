document.addEventListener("DOMContentLoaded", function() {
    const headerElement = document.getElementById('site-header');
    if (!headerElement) return;

    headerElement.className = "main-header";
    headerElement.innerHTML = `
        <div class="container nav-bar">
            <div class="logo-group">
                <a href="https://www.ferdimen.com">
                    <img src="https://www.ferdimen.com/img/logo.png" alt="Ferdimen Logo">
                </a>
            </div>
            <div class="nav-right-container">
                <nav>
                    <ul class="nav-menu">
                        <li><a href="../#hakkimda">Hakkımda</a></li>
                        <li><a href="../gram.html">Ferdigram</a></li>
                        <li><a href="../yazilar.html">Yazilar</a></li>
                        <li><a href="../#harita">Gittim Gördüm</a></li>
                        <li><a href="../izle.html">Videolar</a></li>
                        <li><a href="../#kronoloji">Kronoloji</a></li>
                        <li><a href="../#dosyalar">Dosyalar</a></li>
                        <li><a href="../ekipman.html">Ekipman</a></li>
                        <li><a href="../#faq">S.S.S.</a></li>
                        <li><a href="../#sablon">Vasiyet</a></li>
                        <li><a href="../#destek">Destek Ol</a></li>
                        <li><a href="#iletisim">İletişim</a></li>
                    </ul>
                </nav>
                <div class="header-socials">
                    <a href="https://www.ferdimen.com/youtube" target="_blank" title="YouTube">
                        <svg viewBox="0 0 24 24"><path d="M21.543 6.498C22 8.21 22 12 22 12s0 3.79-.457 5.502A2.752 2.752 0 0 1 19.617 19.43C17.904 20 12 20 12 20s-5.904 0-7.617-.57a2.752 2.752 0 0 1-1.926-1.928C2 15.79 2 12 2 12s0-3.79.457-5.502A2.752 2.752 0 0 1 4.383 4.57C6.096 4 12 4 12 4s5.904 0 7.617.57a2.752 2.752 0 0 1 1.926 1.928zM10 15.5l5.5-3.5L10 8.5v7z"/></svg>
                    </a>
                    <a href="https://www.ferdimen.com/polarsteps" target="_blank" title="Polarsteps">
                        <svg viewBox="0 0 48 48"><path d="M22.8 21.2c1-.4 2.1-.3 3 .3c.2.1.4.2.6.1l2.4-1c.5-.2.7-.9.3-1.3L18.8 8.9c-.7-.7-2-.2-2 .8l.2 14.5c0 .6.6 1 1.1.7l2.4-1c.2-.1.3-.3.4-.5c.2-.9.9-1.8 1.9-2.2Zm2.4 5.6c1-.4 1.7-1.3 1.8-2.4c0-.2.2-.4.4-.5l2.4-1c.5-.2 1.1.2 1.1.7l.2 14.5c0 1-1.2 1.6-2 .8L19 28.8c-.4-.4-.3-1.1.3-1.3l2.4-1c.2-.1.4 0 .6.1c.8.5 1.9.7 2.9.2Z"/></svg>
                    </a>
                </div>
            </div>
        </div>
    `;
});
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

