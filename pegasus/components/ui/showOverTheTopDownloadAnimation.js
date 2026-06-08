export default function showOverTheTopDownloadAnimation() {
    if(typeof document === "undefined") {
        return;
    }

    const existing = document.querySelector(".over-the-top-download-animation");
    if(existing) {
        existing.remove();
    }

    const root = document.createElement("div");
    root.className = "over-the-top-download-animation animation-hidden";
    root.innerHTML = `
        <div>
            <div class="animation-ring-3"></div>
            <div class="animation-ring-2"></div>
            <div class="animation-ring-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4"></path>
                </svg>
            </div>
        </div>
    `;

    document.body.appendChild(root);

    window.requestAnimationFrame(() => {
        root.classList.remove("animation-hidden");
    });

    window.setTimeout(() => {
        root.classList.add("animation-hidden");
    }, 2000);

    window.setTimeout(() => {
        root.remove();
    }, 2300);
}