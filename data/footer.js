document.addEventListener("DOMContentLoaded", function () {
    // 1. Yılı otomatik yazdır
    const currentYear = new Date().getFullYear();
    const yearSpan = document.getElementById("footer-year");
    if (yearSpan) yearSpan.textContent = currentYear;

    // 2. Mesajların ekleneceği ana alan
    const textSpan = document.getElementById("footer-dynamic-text");
    if (textSpan) {
        const bugun = new Date();
        const gun = bugun.getDate();
        const ay = bugun.getMonth() + 1;

        // Dinamik yolları hesapla
        const pathArray = window.location.pathname.split('/');
        const rootPath = window.location.origin + (pathArray[1] && !pathArray[1].includes('.') && pathArray[1] !== 'yazilar' ? '/' + pathArray[1] : '');
        
        const footerJsonYolu = rootPath + "/data/footer.json";
        const jsonYolu = rootPath + "/yazilar/yazilar.json";

        // Önce Alt Bilgi (Footer) Mesajlarını Yükle
        fetch(footerJsonYolu)
            .then(res => res.json())
            .then(data => {
                let varsayilanMesaj = data.varsayilanMesaj || "<b>Ferdimen.</b> Tüm Hakları Saklıdır.";
                let ozelMesaj = "";

                // Bugün ile eşleşen özel bir gün var mı bul
                if (data.ozelGunler && Array.isArray(data.ozelGunler)) {
                    const eslesenGun = data.ozelGunler.find(d => parseInt(d.gun) === gun && parseInt(d.ay) === ay);
                    if (eslesenGun) {
                        ozelMesaj = eslesenGun.mesaj;
                    }
                }

                // Ekrana bas
                textSpan.innerHTML = varsayilanMesaj + ozelMesaj;

                // Tarihte Bugün Nostalji Sistemini Çalıştır
                return fetch(jsonYolu);
            })
            .then(response => {
                if (!response || !response.ok) return;
                return response.json();
            })
            .then(yazilar => {
                if(!yazilar) return;
                let eklenecekNostaljiYazilari = "";

                yazilar.forEach(yazi => {
                    if (!yazi.tarih) return;
                    const parcalar = yazi.tarih.split("-");
                    const yaziYili = parseInt(parcalar[0]);
                    const yaziAyi = parseInt(parcalar[1]);
                    const yaziGunu = parseInt(parcalar[2]);

                    if (yaziGunu === gun && yaziAyi === ay && yaziYili < currentYear) {
                        const yilFarki = currentYear - yaziYili;
                        const tamUrl = rootPath + "/" + yazi.url;
                        eklenecekNostaljiYazilari += `<br>⏳ <b>Tarihte Bugün:</b> ${yilFarki} yıl önce <b><a href="${tamUrl}" style="color: #ffca28; text-decoration: underline;">${yazi.baslik}</a></b>`;
                    }
                });

                if (eklenecekNostaljiYazilari !== "") {
                    textSpan.innerHTML += eklenecekNostaljiYazilari;
                }
            })
            .catch(error => {
                console.log("Footer/Nostalji Motoru Hatası:", error.message);
            });
    }
});