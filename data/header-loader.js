document.addEventListener("DOMContentLoaded", function () {
    const headerContainer = document.querySelector(".main-header");
    if (!headerContainer) return;

    // Tam sayfa yolunu al (örn: "/", "/index.html", "/yazilar/", "/yazilar/1.html")
    const pathName = window.location.pathname;
    
    // Yolu parçala ve boş elemanları temizle (örn: ["yazilar", "1.html"])
    const pathSegments = pathName.split("/").filter(Boolean);

    // Gerçek Ana Sayfa Tespiti:
    // Sadece sitenin en üst kök dizini (/) veya kökteki index.html ana sayfadır.
    // Alt klasörler (/yazilar/, /ekipman/ vb.) kesinlikle ana sayfa değildir.
    const isHomePage = (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === "index.html"));

    const lastSegment = pathSegments[pathSegments.length - 1] || "";
    const fileName = lastSegment.includes(".") ? lastSegment : "index.html";

    // Sunucu kök dizinindeki JSON dosyasının yolu
    const jsonPath = "/data/main-header.json";

    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error("JSON yüklenemedi (" + response.status + "): " + jsonPath);
            }
            return response.json();
        })
        .then(data => {
            // 1. Logo
            const logoHtml = `
                <div class="logo-group">
                    <a href="${data.logo.link}">
                        <img src="${data.logo.img}" alt="${data.logo.alt}">
                    </a>
                </div>
            `;

            // 2. Menü Elemanları
            let menuListHtml = "";

            data.menu.forEach(item => {
                // Sayfaya özel gizleme kontrolü (Klasör adı veya dosya adı uyuşuyorsa)
                if (item.hideOn) {
                    const shouldHide = item.hideOn.some(hidePath => 
                        pathName.includes(hidePath) || fileName === hidePath
                    );
                    if (shouldHide) return;
                }

                let finalHref = item.href;

                // Ana sayfada değilsek ve otherHref tanımlıysa (/izle.html veya /ekipman.html) onu kullan
                if (!isHomePage && item.otherHref) {
                    finalHref = item.otherHref;
                } 
                // Section içi linklerin kontrolü (#haberler -> /index.html#haberler)
                else if (item.isSection) {
                    if (item.alwaysAnchor) {
                        finalHref = item.href;
                    } else if (!isHomePage) {
                        finalHref = "/index.html" + item.href;
                    }
                }

                menuListHtml += `<li><a href="${finalHref}">${item.title}</a></li>`;
            });

            // 3. Sosyal Medya
            let socialsHtml = "";
            data.socials.forEach(social => {
                socialsHtml += `
                    <a href="${social.url}" target="_blank" title="${social.name}">
                        ${social.svg}
                    </a>
                `;
            });

            // HTML'e Render Et
            headerContainer.innerHTML = `
                <div class="container nav-bar">
                    ${logoHtml}
                    <div class="nav-right-container">
                        <nav>
                            <ul class="nav-menu">
                                ${menuListHtml}
                            </ul>
                        </nav>
                        <div class="header-socials">
                            ${socialsHtml}
                        </div>
                    </div>
                </div>
            `;
        })
        .catch(error => console.error("Header Yükleme Hatası:", error));
});