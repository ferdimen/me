// ==========================================
// AYARLAR & DOSYA YOLLARI
// ==========================================
const TOUR_JSON_URL = './nerdeyim/konum.json';
const POSTS_JSON_URL = './yazilar/yazilar.json';

const TOUR_DISPLAY_DURATION = 12000; // Tur bildirimi ekranda kalma süresi (12 saniye)
const POST_DISPLAY_DURATION = 8000;   // Yazı bildirimi ekranda kalma süresi (8 saniye)
const DEFAULT_CHAR_LIMIT = 100;      // Tur açıklaması için varsayılan karakter sınırı

// Sayfa yüklendiğinde her iki kontrolü de çalıştır
document.addEventListener("DOMContentLoaded", () => {
    checkActiveTour();
    checkHistoryPosts();
});

// ==========================================
// 1. AKTİF TUR BİLDİRİMİ KONTROLÜ
// ==========================================
async function checkActiveTour() {
    try {
        const response = await fetch(TOUR_JSON_URL);
        if (!response.ok) return;

        const data = await response.json();

        // Aktif tur kontrolü ("evet" durumu için)
        if (data.aktifTur && data.aktifTur.toLowerCase() === "evet") {
            createActiveTourToast(data);
        }
    } catch (error) {
        console.error("Konum bilgisi yüklenirken hata oluştu:", error);
    }
}

function createActiveTourToast(data) {
    const container = getOrCreateToastContainer();

    const charLimit = data["karakter-siniri"] || DEFAULT_CHAR_LIMIT;
    const truncatedDesc = truncateText(data.aciklama || "", charLimit);

    const toast = document.createElement('a');
    toast.href = "#takip";
    toast.className = 'toast-card active-tour-card';

    // Arka Plan Resmi Kontrolü
    const bgImage = data.kapakresmi || data.arkaplanResmi || data.bgImage;
    if (bgImage) {
        toast.classList.add('has-bg');
        toast.style.backgroundImage = `url('${bgImage}')`;
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

    setupToastEvents(toast, TOUR_DISPLAY_DURATION);
    
    // Aktif Tur bildirimini en üste ekle
    container.insertBefore(toast, container.firstChild);
}

// ==========================================
// 2. TARİHTE BUGÜN YAZILARI KONTROLÜ
// ==========================================
async function checkHistoryPosts() {
    try {
        const response = await fetch(POSTS_JSON_URL);
        if (!response.ok) return;
        
        const posts = await response.json();
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();

        // Bugünün gün/ay kombinasyonuna uyan yazıları bul
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

    setupToastEvents(toast, POST_DISPLAY_DURATION);
    container.appendChild(toast);
}

// ==========================================
// YARDIMCI FONKSİYONLAR
// ==========================================

// Kapanma ve Hover Mantığını Yönetir
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

// Konteyner yoksa otomatik oluşturur
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
