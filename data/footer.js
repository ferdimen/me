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
        const ay = bugun.getMonth() + 1; // 1 = Ocak, 7 = Temmuz

        // Sabit, her gün görünecek varsayılan metniniz
        const varsayilanMesaj = "<b>Ferdimen.</b> Vazgeçtiklerim, sizin bir ömür aradıklarınızdır. | Tüm Hakları Saklıdır.";
        
        let ozelMesaj = "";

        // --- TAKVİM ÖZEL GÜNLERİ ---
        // --- OCAK (Ay: 1) ---		
		if (gun === 1 && ay === 1) {
            ozelMesaj = " - Mutlu Yıllar! Yeni yılınız kutlu olsun. 🎄✨";
        }
		
        else if (gun === 20 && ay === 1) {
            ozelMesaj = " - Bugün Özel Bir Gün! Her gün bir kahraman doğmuyor. 🎄✨";
        }
		
        // --- ŞUBAT (Ay: 2) ---
        else if (gun === 14 && ay === 2) {
            ozelMesaj = " - 14 Şubat Sevgililer Günü Kutlu Olsun! ❤️";
        }

        // --- MART (Ay: 3) ---
        else if (gun === 8 && ay === 3) {
            ozelMesaj = " - 8 Mart Dünya Kadınlar Günü Kutlu Olsun. 💐";
        }
		
        else if (gun === 18 && ay === 3) {
            ozelMesaj = " - 18 Mart Çanakkale Zaferi ve Şehitleri Anma Günü. 🇹🇷";
        }

        // --- NİSAN (Ay: 4) ---
        else if (gun === 23 && ay === 4) {
            ozelMesaj = " - 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı Kutlu Olsun! 🇹🇷🧒";
        }

        // --- MAYIS (Ay: 5) ---
        else if (gun === 1 && ay === 5) {
            ozelMesaj = " - 1 Mayıs Emek ve Dayanışma Günü Kutlu Olsun. 🛠️";
        }
        else if (gun === 19 && ay === 5) {
            ozelMesaj = " - 19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı Kutlu Olsun! 🇹🇷🏃‍♂️";
        }

        // --- HAZİRAN (Ay: 6) ---
 // --- else if (gun === 12 && ay === 6) {
 // --- ozelMesaj = " — Bugün Özel Bir Gün! 🎉";
 // --- }

        // --- TEMMUZ (Ay: 7) ---			
		else if (gun === 20 && ay === 7) {
            ozelMesaj = " — Kıbrıs Barış Harekatı Kutlu Olsun! 🇹🇷✨";
        }

        // --- AĞUSTOS (Ay: 8) ---
        else if (gun === 17 && ay === 8) {
            ozelMesaj = " - Unutmuş olabilirsiniz, 17 Ağustos 1999 depremini hatırlayın!";
        }
		
        else if (gun === 26 && ay === 8) {
            ozelMesaj = " - 26 Ağustos Malazgirt Zaferi ve Büyük Taarruz Kutlu Olsun! 🇹🇷✨";
        }
		
        else if (gun === 30 && ay === 8) {
            ozelMesaj = " - 30 Ağustos Zafer Bayramımız Kutlu Olsun! 🇹🇷✨";
        }
		
		// --- EYLÜL (Ay: 9) ---
        else if (gun === 9 && ay === 9) {
            ozelMesaj = " - İzmir'in Kurtuluşu Kutlu Olsun! 🇹🇷" ;
        }
		
        // --- EKİM (Ay: 10) ---
        else if (gun === 29 && ay === 10) {
            ozelMesaj = " - 29 Ekim Cumhuriyet Bayramımız Kutlu Olsun! 🇹🇷" ;
        }

        // --- KASIM (Ay: 11) ---
        else if (gun === 10 && ay === 11) {
            ozelMesaj = " - Gazi Mustafa Kemal Atatürk'ü Saygı, Özlem ve Minnetle Anıyoruz. 🇹🇷🕯️";
        }
        else if (gun === 24 && ay === 11) {
            ozelMesaj = " - Tüm Öğretmenlerimizin 24 Kasım Öğretmenler Günü Kutlu Olsun! 👩‍🏫👨‍🏫";
        }

        // --- ARALIK (Ay: 11) ---
        else if (gun === 31 && ay === 12) {
            ozelMesaj = " - Yılın son gününden herkese mutlu seneler! 🎆🎉";
        }

        // İlk olarak ana metni ekrana basıyoruz
        textSpan.innerHTML = varsayilanMesaj + ozelMesaj;

        // --- DİNAMİK URL HESAPLAMA ---
        const pathArray = window.location.pathname.split('/');
        const rootPath = window.location.origin + (pathArray[1] && !pathArray[1].includes('.') && pathArray[1] !== 'yazilar' ? '/' + pathArray[1] : '');
        const jsonYolu = rootPath + "https://ferdimen.com/yazilar/yazilar.json";

        fetch(jsonYolu)
            .then(response => {
                if (!response.ok) throw new Error("JSON bulunamadı: " + jsonYolu);
                return response.json();
            })
            .then(yazilar => {
                // Eşleşen tüm yazıları toplamak için boş bir metin alanı oluşturuyoruz
                let eklenecekNostaljiYazilari = "";

                yazilar.forEach(yazi => {
                    if (!yazi.tarih) return; // Tarihi boş olan yazı varsa hata vermesin diye atla

                    const parcalar = yazi.tarih.split("-");
                    const yaziYili = parseInt(parcalar[0]);
                    const yaziAyi = parseInt(parcalar[1]);
                    const yaziGunu = parseInt(parcalar[2]);

                    // Gün ve Ay eşleşiyorsa, aynı zamanda yazı geçmiş bir yıla aitse (farklı yıllar):
                    if (yaziGunu === gun && yaziAyi === ay && yaziYili < currentYear) {
                        const yilFarki = currentYear - yaziYili;
                        const tamUrl = rootPath + "/" + yazi.url;
                        
                        // Her bulunan yazıyı alt alta eklemek için listenin sonuna ekleme yapıyoruz
                        eklenecekNostaljiYazilari += `<br>⏳ <b>Tarihte Bugün:</b> ${yilFarki} yıl önce <b><a href="${tamUrl}" style="color: #ffca28; text-decoration: underline;">${yazi.baslik}</a></b>`;
                    }
                });

                // Döngü bittikten sonra bulunan tüm yazıları tek seferde footer'a ekle
                if (eklenecekNostaljiYazilari !== "") {
                    textSpan.innerHTML += eklenecekNostaljiYazilari;
                }
            })
            .catch(error => {
                console.log("Nostalji Sistemi Durumu:", error.message);
            });
    }
});
