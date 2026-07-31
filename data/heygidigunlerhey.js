(function () {
    // ==========================================
    // 1. DAHİLİ VARSAYILAN AYARLAR
    // ==========================================
    let CONFIG = {
        POSTS_JSON_URL: './yazilar/yazilar.json',
        POST_DISPLAY_DURATION: 8000
    };

    const CONFIG_URL = './data/bildirimler.json';

    // ==========================================
    // 2. STİL ENJEKSİYONU (SOL TARAF İÇİN KONUMLANDIRMA)
    // ==========================================
    function injectDefaultStyles() {
        if (document.getElementById('history-toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'history-toast-styles';
        style.textContent = `
            #toast-container {
                position: fixed;
                bottom: 20px;
                left: 20px; /* EKRANIN SOL TARAFINDAN ÇIKMASI İÇİN (Sağ için: right: 20px) */
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
                width: calc(100% - 40px);
                pointer-events: none;
            }
            .toast-card {
                pointer-events: auto;
                display: flex;
                align-items: center;
                gap: 12px;
                background: #ffffff;
                color: #1f2937;
                padding: 12px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                text-decoration: none;
                position: relative;
                transition: transform 0.2s ease, opacity 0.2s ease;
                border-left: 4px solid #2563eb;
                font-family: system-ui, -apple-system, sans-serif;
            }
            .toast-card:hover {
                transform: translateY(-2px);
            }
            .toast-img {
                width: 50px;
                height: 50px;
                object-fit: cover;
                border-radius: 6px;
                flex-shrink: 0;
            }
            .toast-content {
                flex-grow: 1;
                overflow: hidden;
            }
            .toast-badge {
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: block;
                margin-bottom: 2px;
            }
            .toast-title {
                margin: 0;
                font-size: 0.9rem;
                font-weight: 600;
                line-height: 1.3;
                color: #111827;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .toast-subtitle {
                font-size: 0.75rem;
                color: #6b7280;
                margin-top: 2px;
            }
            .toast-close {
                background: transparent;
                border: none;
                font-size: 1.2rem;
                line-height: 1;
                color: #9ca3af;
                cursor: pointer;
                padding: 4px;
                margin-left: 4px;
                align-self: flex-start;
            }
            .toast-close:hover {
                color: #4b5563;
            }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // 3. DAHİLİ KAPSAYICI OLUŞTURUCU
    // ==========================================
    function getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    // ==========================================
    // 4. CONFIG YÜKLEME
    // ==========================================
    async function loadConfig() {
        try {
            const response = await fetch(CONFIG_URL);
            if (response.ok) {
                const externalConfig = await response.json();
                CONFIG = { ...CONFIG, ...externalConfig };
            }
        } catch (error) {
            console.warn("[Yazılar History] bildirimler.json yüklenemedi, varsayılan ayarlar kullanılıyor.");
        }
    }

    // ==========================================
    // 5. ANA KONTROL FONKSİYONU
    // ==========================================
    async function checkHistoryPosts() {
        try {
            const response = await fetch(CONFIG.POSTS_JSON_URL);
            if (!response.ok) return;

            const posts = await response.json();
            
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const currentDay = now.getDate();

            const today = new Date(currentYear, currentMonth, currentDay, 0, 0, 0, 0);
            const matchingTourPosts = [];

            posts.forEach(post => {
                if (!post.tarih) return;

                const dateStrings = post.tarih.split(',').map(d => d.trim());
                const startParts = dateStrings[0].split('-');

                if (startParts.length < 3) return;

                const startMonth = parseInt(startParts[1], 10) - 1;
                const startDay = parseInt(startParts[2], 10);

                // A) TARİHTE BUGÜN
                if (startMonth === currentMonth && startDay === currentDay) {
                    createPostToast(post, "Tarihte Bugün", null);
                }

                // B) TURUN X. GÜNÜ HESAPLAMASI
                if (dateStrings.length >= 2) {
                    const endParts = dateStrings[1].split('-');

                    if (endParts.length >= 3) {
                        const endMonth = parseInt(endParts[1], 10) - 1;
                        const endDay = parseInt(endParts[2], 10);

                        const tourStartThisYear = new Date(currentYear, startMonth, startDay, 0, 0, 0, 0);
                        const tourEndThisYear = new Date(currentYear, endMonth, endDay, 0, 0, 0, 0);

                        if (today > tourStartThisYear && today <= tourEndThisYear) {
                            const diffTime = today.getTime() - tourStartThisYear.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            const tourDayNumber = diffDays + 1;

                            matchingTourPosts.push({
                                post: post,
                                badgeTitle: `Hey gidi günler hey!`,
                                subtitleText: `Geçmişte bugün bu turun ${tourDayNumber}. günüydü.`
                            });
                        }
                    }
                }
            });

            // RASTGELE 1 TANE TUR BİLDİRİMİ BAS
            if (matchingTourPosts.length > 0) {
                const randomIndex = Math.floor(Math.random() * matchingTourPosts.length);
                const selectedTour = matchingTourPosts[randomIndex];

                createPostToast(selectedTour.post, selectedTour.badgeTitle, selectedTour.subtitleText);
            }

        } catch (error) {
            console.error("[Yazılar History] Yazılar kontrol edilirken hata oluştu:", error);
        }
    }

    // ==========================================
    // 6. BİLDİRİM KARTI OLUŞTURMA
    // ==========================================
    function createPostToast(post, badgeTitle, subtitleText) {
        injectDefaultStyles();
        const container = getToastContainer();

        const toast = document.createElement('a');
        toast.href = post.url || "#";
        toast.className = 'toast-card';

        const imgHtml = post.kapakresmi 
            ? `<img src="${post.kapakresmi}" alt="${post.baslik || ''}" class="toast-img">` 
            : '';

        toast.innerHTML = `
            ${imgHtml}
            <div class="toast-content">
                <span class="toast-badge" style="color: #2563eb;">${badgeTitle}</span>
                <h4 class="toast-title">${post.baslik || 'Başlıksız Yazı'}</h4>
                ${subtitleText ? `<div class="toast-subtitle">${subtitleText}</div>` : ''}
            </div>
            <button class="toast-close" title="Kapat">&times;</button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.remove();
            });
        }

        const duration = CONFIG.POST_DISPLAY_DURATION || 8000;
        if (duration > 0) {
            setTimeout(() => {
                if (toast && toast.parentNode) {
                    toast.remove();
                }
            }, duration);
        }

        container.appendChild(toast);
    }

    // ==========================================
    // 7. OTOMATİK BAŞLATMA
    // ==========================================
    document.addEventListener("DOMContentLoaded", async () => {
        await loadConfig();
        checkHistoryPosts();
    });

})();