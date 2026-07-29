// ==========================================
// YEDEK / VARSAYILAN AYARLAR
// ==========================================
let CONFIG = {
    TOUR_JSON_URL: './nerdeyim/konum.json',
    POSTS_JSON_URL: './yazilar/yazilar.json',
    HABER_JSON_URL: './data/haber.json',
    VIDEO_JSON_URL: './data/video.json',
    HABERLER: true,
    VIDEO: true,
    VIDEO_PROMODAY: 1, // 0 = Sadece o gün, 1 = 1 gün önce ve 1 gün sonra
    TOUR_DISPLAY_DURATION: 12000,
    POST_DISPLAY_DURATION: 8000,
    CUSTOM_DISPLAY_DURATION: 10000,
    HABER_DISPLAY_DURATION: 9000,
    VIDEO_DISPLAY_DURATION: 10000,
    DEFAULT_CHAR_LIMIT: 100,
    BILDIRIMLER: []
};

const CONFIG_URL = './data/bildirimler.json';

document.addEventListener("DOMContentLoaded", async () => {
    await loadConfig();
    checkActiveTour();
    checkCustomNotifications();
    checkLatestNews();
    checkVideoNotifications();
    checkHistoryPosts();
});

async function loadConfig() {
    try {
        const response = await fetch(CONFIG_URL);
        if (response.ok) {
            const externalConfig = await response.json();
            CONFIG = { ...CONFIG, ...externalConfig };
        } else {
            console.warn("ayarlar.json bulunamadı, varsayılan ayarlar kullanılıyor.");
        }
    } catch (error) {
        console.warn("Ayarlar dosyası yüklenirken hata oluştu:", error);
    }
}

// ==========================================
// 1. AKTİF TUR BİLDİRİMİ KONTROLÜ
// ==========================================
async function checkActiveTour() {
    try {
        const response = await fetch(CONFIG.TOUR_JSON_URL);
        if (!response.ok) return;

        const data = await response.json();

        if (data.aktifTur && data.aktifTur.toLowerCase() === "evet") {
            createActiveTourToast(data);
        }
    } catch (error) {
        console.error("Konum bilgisi yüklenirken hata oluştu:", error);
    }
}

function createActiveTourToast(data) {
    const container = getOrCreateToastContainer();

    const charLimit = data["karakter-siniri"] || CONFIG.DEFAULT_CHAR_LIMIT;
    const truncatedDesc = truncateText(data.aciklama || "", charLimit);

    const toast = document.createElement('a');
    toast.href = "#takip";
    toast.className = 'toast-card active-tour-card';

    const bgImage = data.kapakresmi || data.arkaplanResmi || data.bgImage;
    if (bgImage) {
        toast.classList.add('has-bg');
        toast.style.backgroundImage = `url('${bgImage}')`;
    }

    if (data.cizgiRengi || data["cizgi-rengi"]) {
        toast.style.borderColor = data.cizgiRengi || data["cizgi-rengi"];
    }

    toast.innerHTML = `
        <div class="live-location-icon">
            <div class="live-pulse"></div>
            <svg viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
        </div>
        <div class="toast-content">
            <span class="tour-badge">● ŞU AN TURDA</span>
            <h4 class="toast-title">${data["tur-adi"] || "Aktif Tur"}</h4>
            ${truncatedDesc ? `<p class="tour-desc">${truncatedDesc}</p>` : ''}
        </div>
        <button class="toast-close" title="Kapat">&times;</button>
    `;

    setupToastEvents(toast, CONFIG.TOUR_DISPLAY_DURATION);
    container.insertBefore(toast, container.firstChild);
}

// ==========================================
// 2. ÖZEL BİLDİRİMLER KONTROLÜ
// ==========================================
function checkCustomNotifications() {
    if (!CONFIG.BILDIRIMLER || !Array.isArray(CONFIG.BILDIRIMLER)) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();

    CONFIG.BILDIRIMLER.forEach(item => {
        if (!item.tarih) return;

        const dates = item.tarih.split(',').map(d => d.trim());
        let shouldShow = false;

        if (dates.length === 1) {
            const targetDate = parseDateString(dates[0]);
            if (targetDate && targetDate.getTime() === today) {
                shouldShow = true;
            }
        } else if (dates.length >= 2) {
            const startDate = parseDateString(dates[0]);
            const endDate = parseDateString(dates[1]);

            if (startDate && endDate) {
                const start = startDate.getTime();
                const end = endDate.getTime();
                if (today >= start && today <= end) {
                    shouldShow = true;
                }
            }
        }

        if (shouldShow) {
            createCustomToast(item);
        }
    });
}

function createCustomToast(item) {
    const container = getOrCreateToastContainer();

    const toast = document.createElement('a');
    toast.href = item.url || "#";
    toast.className = 'toast-card';

    if (item.kapakresmi) {
        toast.classList.add('has-bg', 'active-tour-card');
        toast.style.backgroundImage = `url('${item.kapakresmi}')`;
    }

    if (item.renk) {
        toast.style.borderColor = item.renk;
    }

    const categoryBadge = item.kategori ? item.kategori : 'Duyuru';
    const badgeStyle = item.renk ? `style="color: ${item.renk};"` : '';

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-badge" ${badgeStyle}>${categoryBadge}</span>
            <h4 class="toast-title">${item.baslik}</h4>
            ${item.aciklama ? `<p class="tour-desc">${item.aciklama}</p>` : ''}
        </div>
        <button class="toast-close" title="Kapat">&times;</button>
    `;

    setupToastEvents(toast, CONFIG.CUSTOM_DISPLAY_DURATION);
    container.appendChild(toast);
}

// ==========================================
// 3. SON HABER BİLDİRİMİ KONTROLÜ
// ==========================================
async function checkLatestNews() {
    if (!CONFIG.HABERLER) return;

    try {
        const response = await fetch(CONFIG.HABER_JSON_URL);
        if (!response.ok) return;

        const newsList = await response.json();
        
        if (Array.isArray(newsList) && newsList.length > 0) {
            const latestNews = newsList[0];
            createNewsToast(latestNews);
        }
    } catch (error) {
        console.error("Haberler yüklenirken hata oluştu:", error);
    }
}

function createNewsToast(news) {
    const container = getOrCreateToastContainer();

    const toast = document.createElement('div');
    toast.className = 'toast-card news-toast-card';

    if (news.resim) {
        toast.classList.add('has-bg');
        toast.style.backgroundImage = `url('${news.resim}')`;
    }

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-badge" style="color: #059669;">Haber ${news.meta ? `• ${news.meta}` : ''}</span>
            <h4 class="toast-title">${news.baslik}</h4>
            ${news.aciklama ? `<p class="tour-desc">${news.aciklama}</p>` : ''}
            ${news.linkUrl ? `<a href="${news.linkUrl}" class="toast-link" style="display:inline-block; margin-top:5px; font-weight:bold; color:#059669;">${news.linkMetni || 'Detaylar'} &rarr;</a>` : ''}
        </div>
        <button class="toast-close" title="Kapat">&times;</button>
    `;

    setupToastEvents(toast, CONFIG.HABER_DISPLAY_DURATION || 9000);
    container.appendChild(toast);
}

// ==========================================
// 4. VİDEO BİLDİRİMİ KONTROLÜ (DİNAMİK ID DESTEKLİ)
// ==========================================
async function checkVideoNotifications() {
    if (!CONFIG.VIDEO) return;

    try {
        const response = await fetch(CONFIG.VIDEO_JSON_URL);
        if (!response.ok) return;

        const videos = await response.json();
        if (!Array.isArray(videos) || videos.length === 0) return;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const totalVideos = videos.length;

        // video: Mevcut eleman, index: Dizideki sırası (0, 1, 2...)
        videos.forEach((video, index) => {
            if (!video.date) return;

            const videoDate = parseDateString(video.date);
            if (!videoDate) return;

            const diffTime = videoDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            const margin = CONFIG.VIDEO_PROMODAY !== undefined ? CONFIG.VIDEO_PROMODAY : 1;

            // En alttaki eleman (en yeni) = 1, bir üstündeki = 2 olacak şekilde ID hesabı
            const videoId = totalVideos - index;

            // 1. TAM YAYIN GÜNÜ (Bugün)
            if (diffDays === 0) {
                createVideoToast(video, "YENİ VİDEO YAYINDA", "", videoId);
            }
            // 2. YAYINDAN ÖNCEKİ BİLDİRİM (Gelecek)
            else if (margin > 0 && diffDays > 0 && diffDays <= margin) {
                const promoText = diffDays === 1 ? "Yarın yayında" : `${diffDays} gün sonra yayında`;
                createVideoToast(video, "YAKINDA YAYINDA", promoText, videoId);
            }
            // 3. YAYINDAN SONRAKİ BİLDİRİM (Geçmiş)
            else if (margin > 0 && diffDays < 0 && Math.abs(diffDays) <= margin) {
                const pastDays = Math.abs(diffDays);
                const promoText = pastDays === 1 ? "Dün yayınlandı" : `${pastDays} gün önce yayınlandı`;
                createVideoToast(video, "YENİ VİDEO", promoText, videoId);
            }
        });

    } catch (error) {
        console.error("Video bilgisi yüklenirken hata oluştu:", error);
    }
}

function createVideoToast(video, badgeTitle, promoSubtitle, videoId) {
    const container = getOrCreateToastContainer();

    const toast = document.createElement('a');
    // En alttan yukarıya doğru hesaplanan ID ile dinamik yönlendirme
    toast.href = `izle.html?v=${videoId}`;
    toast.className = 'toast-card video-toast-card animated-video-toast';

    // --- YOUTUBE KAPAK RESMİ URL'Sİ OLUŞTURMA ---
    let thumbnailUrl = "";
    if (video.url) {
        const match = video.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (match && match[1]) {
            thumbnailUrl = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
        }
    }

    const charLimit = CONFIG.DEFAULT_CHAR_LIMIT || 100;
    const truncatedDesc = truncateText(video.description || "", charLimit);

    const thumbHtml = thumbnailUrl 
        ? `<div class="toast-thumb-container">
            <img src="${thumbnailUrl}" alt="${video.title || 'Video Kapak'}" class="toast-thumb-img" />
           </div>` 
        : '';

    toast.innerHTML = `
        ${thumbHtml}
        <div class="toast-content">
            <span class="toast-badge" style="color: #dc2626;">▶ ${badgeTitle}</span>
            <h4 class="toast-title">${video.title}</h4>
            ${truncatedDesc ? `<p class="tour-desc">${truncatedDesc}</p>` : ''}
            ${promoSubtitle ? `<div style="font-size:0.85rem; font-weight:bold; color:#f59e0b; margin-top:4px;">⏳ ${promoSubtitle}</div>` : ''}
        </div>
        <button class="toast-close" title="Kapat">&times;</button>
    `;

    setupToastEvents(toast, CONFIG.VIDEO_DISPLAY_DURATION || 10000);
    container.appendChild(toast);
}

// ==========================================
// 5. TARİHTE BUGÜN YAZILARI KONTROLÜ
// ==========================================
async function checkHistoryPosts() {
    try {
        const response = await fetch(CONFIG.POSTS_JSON_URL);
        if (!response.ok) return;

        const posts = await response.json();
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        const matchingPosts = posts.filter(post => {
            if (!post.tarih) return false;

            const dateStrings = post.tarih.split(',').map(d => d.trim());
            return dateStrings.some(dateStr => {
                const parts = dateStr.split('-');
                if (parts.length >= 3) {
                    const month = parseInt(parts[1], 10);
                    const day = parseInt(parts[2], 10);
                    return month === currentMonth && day === currentDay;
                }
                return false;
            });
        });

        matchingPosts.forEach(post => createPostToast(post));

    } catch (error) {
        console.error("Yazılar yüklenirken hata oluştu:", error);
    }
}

function createPostToast(post) {
    const container = getOrCreateToastContainer();

    const toast = document.createElement('a');
    toast.href = post.url;
    toast.className = 'toast-card';

    toast.innerHTML = `
        <img src="${post.kapakresmi}" alt="${post.baslik}" class="toast-img">
        <div class="toast-content">
            <span class="toast-badge">Tarihte Bugün</span>
            <h4 class="toast-title">${post.baslik}</h4>
        </div>
        <button class="toast-close" title="Kapat">&times;</button>
    `;

    setupToastEvents(toast, CONFIG.POST_DISPLAY_DURATION);
    container.appendChild(toast);
}

// ==========================================
// YARDIMCI FONKSİYONLAR
// ==========================================

function parseDateString(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        
        // Zaman dilimi sorununu engellemek için tam 00:00:00 alıyoruz
        return new Date(year, month, day, 0, 0, 0, 0);
    }
    return null;
}

function setupToastEvents(toast, duration) {
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeToast(toast);
    });

    let timer = setTimeout(() => removeToast(toast), duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
        timer = setTimeout(() => removeToast(toast), duration);
    });
}

function getOrCreateToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function truncateText(text, limit) {
    if (text.length <= limit) return text;
    return text.slice(0, limit).trim() + '...';
}

function removeToast(toast) {
    toast.classList.add('hide');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}