const loadingConfig = window.SLOPRIME_LOADING_CONFIG || {};
const socialFeedEl = document.getElementById("socialFeed");
const newsFeedEl = document.getElementById("newsFeed");
const socialChannelLinkEl = document.getElementById("socialChannelLink");
const newsChannelLinkEl = document.getElementById("newsChannelLink");
const serverNameEl = document.getElementById("serverName");
const serverSubtitleEl = document.getElementById("serverSubtitle");
const staffListEl = document.getElementById("staffList");
const bar = document.getElementById("bar");
const loadingPercentEl = document.getElementById("loadingPercent");
const music = document.getElementById("music");
const volumeSliderEl = document.getElementById("volumeSlider");
const musicPlayEl = document.getElementById("musicPlay");
const musicPauseEl = document.getElementById("musicPause");

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function setProgress(percent) {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    if (bar) {
        bar.style.width = `${safePercent}%`;
    }
    if (loadingPercentEl) {
        loadingPercentEl.textContent = String(safePercent);
    }
}

function renderFeed(target, items, emptyTitle, emptyText) {
    if (!target) {
        return;
    }

    if (!items.length) {
        target.innerHTML = `
            <div class="feed-card">
                <strong>${emptyTitle}</strong>
                <p>${emptyText}</p>
            </div>
        `;
        return;
    }

    target.innerHTML = items.map((item) => `
        <div class="feed-card">
            <strong>${escapeHtml(item.author || "Discord")}</strong>
            <p>${escapeHtml(item.content || "Nova objava.").replaceAll("\n", "<br>")}</p>
        </div>
    `).join("");
}

function applyLoadingConfig() {
    if (socialChannelLinkEl && loadingConfig.socialChannelUrl) {
        socialChannelLinkEl.href = loadingConfig.socialChannelUrl;
    }

    if (newsChannelLinkEl && loadingConfig.newsChannelUrl) {
        newsChannelLinkEl.href = loadingConfig.newsChannelUrl;
    }

    if (serverNameEl && loadingConfig.serverName) {
        serverNameEl.textContent = loadingConfig.serverName;
    }

    if (serverSubtitleEl && loadingConfig.serverSubtitle) {
        serverSubtitleEl.textContent = loadingConfig.serverSubtitle;
    }

    if (staffListEl && Array.isArray(loadingConfig.staffMembers)) {
        staffListEl.innerHTML = loadingConfig.staffMembers.map((member) => `
            <div class="staff-member">
                <strong>${escapeHtml(member.role || "Staff")}</strong>
                <span>${escapeHtml(member.name || "SLOPrimeRP")}</span>
            </div>
        `).join("");
    }
}

async function loadFeed(apiUrl, target, emptyTitle, emptyText, errorText) {
    if (!target || !apiUrl) {
        return;
    }

    try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Feed error");
        }

        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items.slice(0, 3) : [];
        renderFeed(target, items, emptyTitle, emptyText);
    } catch (error) {
        target.innerHTML = `
            <div class="feed-card">
                <strong>Feed ni dosegljiv</strong>
                <p>${errorText}</p>
            </div>
        `;
    }
}

function initMusicControls() {
    if (!music) {
        return;
    }

    music.volume = Number(volumeSliderEl?.value || 0.5);

    volumeSliderEl?.addEventListener("input", () => {
        music.volume = Number(volumeSliderEl.value);
    });

    musicPlayEl?.addEventListener("click", async () => {
        await music.play().catch(() => {
            console.log("Autoplay blocked");
        });
    });

    musicPauseEl?.addEventListener("click", () => {
        music.pause();
    });
}

applyLoadingConfig();
loadFeed(
    loadingConfig.newsApiUrl,
    newsFeedEl,
    "Ni novic",
    "Ko bodo objavljene Discord novice, se bodo prikazale tukaj.",
    "Preveri povezavo z news API-jem."
);
loadFeed(
    loadingConfig.socialApiUrl,
    socialFeedEl,
    "Ni stream objav",
    "Ko bodo youtuberji objavili stream v social-media kanal, se bodo objave prikazale tukaj.",
    "Preveri povezavo z social-media API-jem."
);
initMusicControls();
setProgress(0);

setTimeout(() => {
    document.getElementById("intro").style.display = "none";
    document.getElementById("main").classList.remove("hidden");

    if (music) {
        music.volume = Number(volumeSliderEl?.value || 0.5);
        music.play().catch(() => {
            console.log("Autoplay blocked");
        });
    }
}, 3000);

let width = 0;
setInterval(() => {
    if (width < 100) {
        width++;
        setProgress(width);
    }
}, 100);

window.addEventListener("message", (e) => {
    if (e.data.eventName === "loadProgress") {
        setProgress((e.data.loadFraction || 0) * 100);
    }
});
