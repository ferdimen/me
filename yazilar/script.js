function sayfaDegistir(sayfaNo) {
    // Tüm bölümleri gizle
    const sayfalar = document.querySelectorAll('.tur-sayfasi');
    sayfalar.forEach(sayfa => sayfa.classList.remove('aktif'));

    // Tüm butonların aktiflik tarzını kaldır
    const butonlar = document.querySelectorAll('.pagination li');
    butonlar.forEach(btn => btn.classList.remove('aktif'));

    // Seçilen bölümü göster
    document.getElementById(`bolum-${sayfaNo}`).classList.add('aktif');

    // Seçilen butonun tarzını aktif yap
    butonlar[sayfaNo - 1].classList.add('aktif');

    // Sayfa başına yumuşakça otomatik kaydır
    window.scrollTo({top: 0, behavior: 'smooth'});
}