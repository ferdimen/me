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
    
    // Ana sayfa kontrolü
    const isHomePage = (pathName === basePath || pathName === basePath + mainPageFile || fileName === mainPageFile);

    // JSON verisini doğrudan JavaScript nesnesi olarak tanımlıyoruz.
    const data = {
      "logo": {
        "img": "img/logo.png",
        "alt": "Ferdimen Logo",
        "link": ""
      },
      "menu": [
        { "title": "Hakkımda", "href": "#hakkimda", "isSection": true },
        { "title": "Ferdigram", "href": "gram.html", "isSection": false, "hideOn": ["gram.html"] },
        { "title": "Yazılar", "href": "yazilar.html", "isSection": false, "hideOn": ["yazilar", "yazilar.html"] },
        { "title": "Haberler", "href": "#haberler", "isSection": true },
        { "title": "Harita", "href": "#harita", "isSection": true },
        { "title": "Videolar", "href": "#videolar", "otherHref": "/izle.html", "isSection": false, "hideOn": ["izle", "izle.html"] },
        { "title": "Kronoloji", "href": "#kronoloji", "isSection": true },
        { "title": "Dosyalar", "href": "#dosyalar", "isSection": true },
        { "title": "Ekipman", "href": "ekipman.html", "otherHref": "/ekipman.html", "isSection": false, "hideOn": ["ekipman", "ekipman.html"] },
        { "title": "Rotalar", "href": "rotalar.html", "otherHref": "/rotalar.html", "isSection": false, "hideOn": ["rotalar", "rotalar.html"] },          
        { "title": "S.S.S.", "href": "#faq", "isSection": true },
        { "title": "Vasiyet", "href": "#sablon", "isSection": true },
        { "title": "Destek", "href": "#destek", "isSection": true },
        { "title": "İletişim", "href": "#iletisim", "isSection": true, "alwaysAnchor": true }
      ],
      "socials": [
        {
          "name": "YouTube",
          "url": "https://www.ferdimen.com/youtube",
          "svg": "<svg viewBox=\"0 0 24 24\"><path d=\"M21.543 6.498C22 8.21 22 12 22 12s0 3.79-.457 5.502A2.752 2.752 0 0 1 19.617 19.43C17.904 20 12 20 12 20s-5.904 0-7.617-.57a2.752 2.752 0 0 1-1.926-1.928C2 15.79 2 12 2 12s0-3.79.457-5.502A2.752 2.752 0 0 1 4.383 4.57C6.096 4 12 4 12 4s5.904 0 7.617.57a2.752 2.752 0 0 1 1.926 1.928zM10 15.5l5.5-3.5L10 8.5v7z\"/></svg>"
        },
        {
          "name": "Polarsteps",
          "url": "https://ferdimen.com/polarsteps",
          "svg": "<svg viewBox=\"0 0 48 48\"><path d=\"M22.8 21.2c1-.4 2.1-.3 3 .3c.2.1.4.2.6.1l2.4-1c.5-.2.7-.9.3-1.3L18.8 8.9c-.7-.7-2-.2-2 .8l.2 14.5c0 .6.6 1 1.1.7l2.4-1c.2-.1.3-.3.4-.5c.2-.9.9-1.8 1.9-2.2Zm2.4 5.6c1-.4 1.7-1.3 1.8-2.4c0-.2.2-.4.4-.5l2.4-1c.5-.2 1.1.2 1.1.7l.2 14.5c0 1-1.2 1.6-2 .8L19 28.8c-.4-.4-.3-1.1.3-1.3l2.4-1c.2-.1.4 0 .6.1c.8.5 1.9.7 2.9.2Z\"/></svg>"
        }
      ]
    };

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
        // Section içi linklerin kontrolü
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
});
