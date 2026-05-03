const loadingConfig = window.SLOPRIME_LOADING_CONFIG || {};
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

function applyLoadingConfig() {
    if (serverNameEl && loadingConfig.serverName) {
        serverNameEl.textContent = loadingConfig.serverName;
    }

    if (serverSubtitleEl && loadingConfig.serverSubtitle) {
        serverSubtitleEl.textContent = loadingConfig.serverSubtitle;
    }

    if (staffListEl && Array.isArray(loadingConfig.staffMembers)) {
        let personIndex = 0;

        staffListEl.innerHTML = loadingConfig.staffMembers.map((member) => {
            const people = Array.isArray(member.people) && member.people.length
                ? member.people
                : [{ name: member.name || "SLOPrimeRP", aliases: member.aliases || [] }];
            const showStatus = member.showStatus !== false;

            const peopleMarkup = people.map((person) => {
                const currentIndex = personIndex;
                if (showStatus) {
                    personIndex += 1;
                }

                return `
                    <div class="staff-person">
                        <span>${escapeHtml(person.name || "SLOPrimeRP")}</span>
                        ${showStatus ? `<span class="staff-status offline" id="staffStatus-${currentIndex}">Offline</span>` : ""}
                    </div>
                `;
            }).join("");

            return `
            <div class="staff-member">
                <strong>${escapeHtml(member.role || "Staff")}</strong>
                ${peopleMarkup}
            </div>
        `;
        }).join("");
    }
}

function getPeopleList() {
    if (!Array.isArray(loadingConfig.staffMembers)) {
        return [];
    }

    return loadingConfig.staffMembers.flatMap((member) => {
        if (member.showStatus === false) {
            return [];
        }

        if (Array.isArray(member.people) && member.people.length) {
            return member.people;
        }

        return [{
            name: member.name || "SLOPrimeRP",
            aliases: member.aliases || []
        }];
    });
}

function getMemberAliases(member) {
    const aliases = Array.isArray(member.aliases) ? member.aliases : [];
    return [member.name, ...aliases]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
}

function setStaffStatus(index, isOnline, playerName = "") {
    const statusEl = document.getElementById(`staffStatus-${index}`);
    if (!statusEl) {
        return;
    }

    statusEl.textContent = isOnline ? `Online${playerName ? ` - ${playerName}` : ""}` : "Offline";
    statusEl.classList.toggle("online", isOnline);
    statusEl.classList.toggle("offline", !isOnline);
}

async function loadStaffStatuses() {
    const people = getPeopleList();

    if (!staffListEl || !people.length || !loadingConfig.serverEndpoint) {
        return;
    }

    try {
        const response = await fetch(`${loadingConfig.serverEndpoint}/players.json`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Players endpoint error");
        }

        const players = await response.json();
        const normalizedPlayers = Array.isArray(players)
            ? players.map((player) => ({
                ...player,
                normalizedName: String(player?.name || "").trim().toLowerCase()
            }))
            : [];

        people.forEach((member, index) => {
            const aliases = getMemberAliases(member);
            const matchingPlayer = normalizedPlayers.find((player) => aliases.includes(player.normalizedName));
            setStaffStatus(index, Boolean(matchingPlayer), matchingPlayer?.name || "");
        });
    } catch (error) {
        people.forEach((member, index) => {
            setStaffStatus(index, false);
        });
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
loadStaffStatuses();
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

setInterval(loadStaffStatuses, 30000);
