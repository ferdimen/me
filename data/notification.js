// --- TARİHTE BUGÜN BİLDİRİMLERİ
// --- AYARLAR ---
const DISPLAY_DURATION = 5000; // Bildirimin ekranda kalma süresi (Milisaniye: 8000 = 8 saniye)
const JSON_URL = 'yazilar/yazilar.json';

document.addEventListener("DOMContentLoaded", () => {
    fetchAndCheckPosts();
});

async function fetchAndCheckPosts() {
    try {
        const response = await fetch(JSON_URL);
        if (!response.ok) return;
        
        const posts = await response.json();
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // JS'de aylar 0-11 arasıdır
        const currentDay = today.getDate();

        // Bugünün gün/ay kombinasyonuna uyan yazıları bul
        const matchingPosts = posts.filter(post => {
            if (!post.tarih) return false;
            
            // "2018-07-2, 2018-07-6" yapısındaki tarihleri ayırır
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

        // Eşleşen her yazı için bildirim göster
        matchingPosts.forEach(post => createToast(post));

    } catch (error) {
        console.error("Yazılar yüklenirken hata oluştu:", error);
    }
}

function createToast(post) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Kart elemanını oluştur
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

    // 'X' Kapatma butonuna tıklama mantığı
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Linke gitmeyi engelle
        e.stopPropagation(); // Karta tıklama olayını engelle
        removeToast(toast);
    });

    container.appendChild(toast);

    // Otomatik kapanma zamanlayıcısı
    let timer = setTimeout(() => {
        removeToast(toast);
    }, DISPLAY_DURATION);

    // Kullanıcı imleci üzerine getirirse zamanlayıcıyı durdur, ayrılınca tekrar başlat
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
        timer = setTimeout(() => removeToast(toast), DISPLAY_DURATION);
    });
}

function removeToast(toast) {
    toast.classList.add('hide');
    // Animasyon tamamlandıktan sonra DOM'dan kaldır
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}
// --- TUR BİLDİRİMLERİ İÇİN  ---
// --- AYARLAR ---
const TOUR_JSON_URL = 'nerdeyim/konum.json';
const DEFAULT_CHAR_LIMIT = 100; // JSON'da "karakter-siniri" bulunamazsa yedek sınır
const TOUR_DISPLAY_DURATION = 10000; // Otomatik kapanma süresi (10 saniye)

document.addEventListener("DOMContentLoaded", () => {
    checkActiveTour();
});

async function checkActiveTour() {
    try {
        const response = await fetch(TOUR_JSON_URL);
        if (!response.ok) return;

        const data = await response.json();

        // Aktif tur kontrolü ("evet" veya "Evet" durumu için)
        if (data.aktifTur && data.aktifTur.toLowerCase() === "evet") {
            createActiveTourToast(data);
        }
    } catch (error) {
        console.error("Konum bilgisi okunamadı:", error);
    }
}

function createActiveTourToast(data) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Karakter Sınırı Kontrolü (JSON'daki değere öncelik verir)
    const charLimit = data["karakter-siniri"] || DEFAULT_CHAR_LIMIT;
    const truncatedDesc = truncateText(data.aciklama || "", charLimit);

    // Kart Elemanı Oluşturma
    const toast = document.createElement('a');
    toast.href = "#takip"; // #takip bölümüne akıcı kaydırma linki
    toast.className = 'toast-card active-tour-card';

    // SVG Konum İkonu ve İçerik Yapısı
    toast.innerHTML = `
        <div class="live-location-icon">
            <div class="live-pulse"></div>
            <svg viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
        </div>
        <div class="toast-content">
            <span class="tour-badge">● ŞU AN YOLDAYIM</span>
            <h4 class="toast-title">${data["tur-adi"] || "Aktif Tur"}</h4>
            ${truncatedDesc ? `<p class="tour-desc">${truncatedDesc}</p>` : ''}
        </div>
        <button class="toast-close" title="Kapat">&times;</button>
    `;

    // 'X' Kapat Butonu Mantığı
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeToast(toast);
    });

    // En üste eklemek için container'ın başına ekliyoruz
    container.insertBefore(toast, container.firstChild);

    // Otomatik kapanma zamanlayıcısı
    let timer = setTimeout(() => {
        removeToast(toast);
    }, TOUR_DISPLAY_DURATION);

    // İmleç üzerindeyken zamanlayıcı durur
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
        timer = setTimeout(() => removeToast(toast), TOUR_DISPLAY_DURATION);
    });
}

// Karakter sınırlama yardımcı fonksiyonu
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