/* ==========================================================================
   HIZLI GEZİNTİ OK SİSTEMİ (pagination.js)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    // Ok buton kapsayıcısını dinamik olarak HTML'e enjekte ediyoruz
    const navBox = document.createElement("div");
    navBox.className = "side-nav-arrows";
    navBox.innerHTML = `
        <button id="btnScrollUp" title="En Yukarı Git">
            <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
        </button>
        <button id="btnScrollDown" title="Sayfalamaya Git">
            <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
        </button>
    `;
    document.body.appendChild(navBox);

    const btnUp = document.getElementById("btnScrollUp");
    const btnDown = document.getElementById("btnScrollDown");

    // Sayfa kaydırıldıkça "Yukarı Git" butonunun görünürlüğünü kontrol etme
    window.addEventListener("scroll", function() {
        if (window.scrollY > 300) {
            btnUp.classList.add("visible");
        } else {
            btnUp.classList.remove("visible");
        }
    });

    // Yukarı Git butonuna tıklama aksiyonu
    btnUp.addEventListener("click", function() {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });

    // Aşağı Git (Pagination alanına git) butonuna tıklama aksiyonu
    btnDown.addEventListener("click", function() {
        const paginationTarget = document.querySelector(".pagination");
        if (paginationTarget) {
            paginationTarget.scrollIntoView({
                behavior: "smooth",
                block: "center" // Sayfalama menüsünü ekranın ortasına getirecek şekilde odaklar
            });
        } else {
            // Eğer sayfada .pagination bulunamazsa en aşağıya kaydırır
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: "smooth"
            });
        }
    });
});