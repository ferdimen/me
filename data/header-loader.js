document.addEventListener("DOMContentLoaded", function () {
    const headerContainer = document.querySelector(".main-header");
    if (!headerContainer) return;

    // Ana sayfanın dosya adı
    const mainPageFile = "";

    // Çalışılan kök dizin yolunu dinamik bul (örn: "/me/")
    const pathName = window.location.pathname;
    const pathSegments = pathName.split("/").filter(Boolean);
    
    let basePath = "/";
    if (pathSegments.length > 0 && pathSegments[0] === "me") {
        basePath = "/me/";
    }

    const lastSegment = pathSegments[pathSegments.length - 1] || "";
    const fileName = lastSegment.includes(".") ? lastSegment : mainPageFile;
    
    // Ana sayfa kontrolü (deneme.html veya doğrudan /me/ klasör kökü)
    const isHomePage = (pathName === basePath || pathName === basePath + mainPageFile || fileName === mainPageFile);

    // JSON yolunu oluştur
    const jsonPath = basePath + "data/main-header.json";

    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error("JSON yüklenemedi (" + response.status + "): " + jsonPath);
            }
            return response.json();
        })
        .then(data => {
            // 1. Logo
            const logoLink = data.logo.link.startsWith("/") ? basePath + data.logo.link.substring(1) : basePath + data.logo.link;
            const logoImg = data.logo.img.startsWith("/") ? basePath + data.logo.img.substring(1) : basePath + data.logo.img;

            const logoHtml = `
                <div class="logo-group">
                    <a href="${logoLink}">
                        <img src="${logoImg}" alt="${data.logo.alt}">
                    </a>
                </div>
            `;

            // 2. Menü Elemanları
            let menuListHtml = "";

            data.menu.forEach(item => {
                // Sayfaya özel gizleme kontrolü
                if (item.hideOn) {
                    const shouldHide = item.hideOn.some(hidePath => 
                        pathName.includes(hidePath) || fileName === hidePath
                    );
                    if (shouldHide) return;
                }

                let finalHref = item.href;

                // Köklü linklerin başına basePath ekle
                if (finalHref.startsWith("/") && !finalHref.startsWith(basePath)) {
                    finalHref = basePath + finalHref.substring(1);
                }

                // Ana sayfa dışındakiler için Videolar -> /me/izle.html gibi özel yönlendirme
                if (!isHomePage && item.otherHref) {
                    finalHref = item.otherHref.startsWith("/") ? basePath + item.otherHref.substring(1) : item.otherHref;
                } 
                // Section içi linklerin kontrolü (#haberler -> /me/deneme.html#haberler)
                else if (item.isSection) {
                    if (item.alwaysAnchor) {
                        finalHref = item.href;
                    } else if (!isHomePage) {
                        finalHref = basePath + mainPageFile + item.href;
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

            // Render Et
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