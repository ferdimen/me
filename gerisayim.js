// 1. Geri Sayım Mantığı (Hedef: 26 Şubat 2027 11:59)
const targetDate = new Date('2027-02-26T11:59:00').getTime();

const countdownInterval = setInterval(function() {
    const now = new Date().getTime();
    const difference = targetDate - now;

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    if(document.getElementById('days')) {
        document.getElementById('days').innerHTML = String(days).padStart(2, '0');
        document.getElementById('hours').innerHTML = String(hours).padStart(2, '0');
        document.getElementById('minutes').innerHTML = String(minutes).padStart(2, '0');
        document.getElementById('seconds').innerHTML = String(seconds).padStart(2, '0');
    }

    if (difference < 0) {
        clearInterval(countdownInterval);
    }
}, 1000);

// 2. Kapatma Butonu Mantığı
window.addEventListener('DOMContentLoaded', (event) => {
    const closeBtn = document.getElementById('close-overlay');
    const overlay = document.getElementById('countdown-overlay');

    if (closeBtn && overlay) {
        closeBtn.addEventListener('click', () => {
            overlay.classList.add('hidden');
            setTimeout(() => {
                clearInterval(countdownInterval);
            }, 500);
        });
    }
});