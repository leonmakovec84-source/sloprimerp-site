const config = window.SLOPRIME_CONFIG || {};
const revealItems = document.querySelectorAll(".reveal");
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

const statusEl = document.getElementById("server-status");
const playersEl = document.getElementById("server-players");
const ipEl = document.getElementById("server-ip");
const discordTextEl = document.getElementById("server-discord-text");
const connectEl = document.getElementById("server-connect");
const discordLinkEl = document.getElementById("discordLink");
const bottomDiscordLinkEl = document.getElementById("bottomDiscordLink");
const topJoinLinkEl = document.getElementById("topJoinLink");
const heroJoinLinkEl = document.getElementById("heroJoinLink");
const bottomJoinLinkEl = document.getElementById("bottomJoinLink");
const heroBadgeEl = document.getElementById("heroBadge");
const heroTitleEl = document.getElementById("heroTitle");
const heroSubtitleEl = document.getElementById("heroSubtitle");
const serverDescriptionEl = document.getElementById("serverDescription");
const heroEl = document.querySelector(".hero");
const depthItems = document.querySelectorAll("[data-depth]");
const factionLinkEls = document.querySelectorAll("[data-faction-link]");
const siteLoaderEl = document.getElementById("siteLoader");
const newsFeedEl = document.getElementById("newsFeed");
const newsDiscordLinkEl = document.getElementById("newsDiscordLink");

function setText(id, value) {
  if (id) {
    id.textContent = value;
  }
}

function setHref(el, value) {
  if (el && value) {
    el.href = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function applyBranding() {
  const branding = config.branding || {};
  const links = config.links || {};
  const serverCfg = config.serverCfg || {};
  const factionLinks = config.factionLinks || {};
  const news = config.news || {};

  setText(heroBadgeEl, branding.heroBadge || "FiveM roleplay server");
  setText(heroTitleEl, branding.heroTitle || "VSTOPI V MESTO");
  setText(heroSubtitleEl, branding.heroSubtitle || "Tvoja zgodba. Tvoja pravila. Tvoj dom.");
  setText(serverDescriptionEl, branding.description || "Dobrodosel na roleplay server.");
  setText(ipEl, links.websiteIpText || "--");
  setText(discordTextEl, serverCfg.discordText || links.discord || "--");
  setText(connectEl, links.join ? links.join.replace("https://", "") : "--");

  setHref(discordLinkEl, links.discord || "#");
  setHref(bottomDiscordLinkEl, links.discord || "#");
  setHref(topJoinLinkEl, links.join || "#kontakt-panel");
  setHref(heroJoinLinkEl, links.join || "#kontakt-panel");
  setHref(bottomJoinLinkEl, links.join || "#kontakt-panel");
  setHref(newsDiscordLinkEl, news.discordChannelUrl || links.discord || "#");

  factionLinkEls.forEach((el) => {
    const key = el.getAttribute("data-faction-link");
    if (key && factionLinks[key]) {
      el.href = factionLinks[key];
    }
  });
}

async function loadNewsFeed() {
  if (!newsFeedEl || !config.news?.apiUrl) {
    return;
  }

  try {
    const response = await fetch(config.news.apiUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("News API error");
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    if (!items.length) {
      newsFeedEl.innerHTML = `
        <article class="info-panel">
          <h3>Ni se novic</h3>
          <p>Bot se se ni sinhroniziral z Discord news kanalom ali pa v kanalu se ni objav.</p>
        </article>
      `;
      return;
    }

    newsFeedEl.innerHTML = items.map((item) => {
      const date = new Date(item.createdAt);
      const formattedDate = Number.isNaN(date.getTime()) ? "Discord objava" : date.toLocaleString("sl-SI");
      const content = item.content
        ? escapeHtml(item.content).replaceAll("\n", "<br>")
        : "Objava brez dodatnega besedila.";
      const attachment = item.attachments?.[0]
        ? `<img class="news-image" src="${item.attachments[0]}" alt="Discord novica">`
        : "";
      const link = item.url
        ? `<a class="news-link" href="${item.url}" target="_blank" rel="noreferrer">Odpri objavo na Discordu</a>`
        : "";

      return `
        <article class="info-panel">
          <h3>${escapeHtml(item.author || "Discord")}</h3>
          <p class="news-meta">${formattedDate}</p>
          <p>${content}</p>
          ${attachment}
          ${link}
        </article>
      `;
    }).join("");
  } catch (error) {
    newsFeedEl.innerHTML = `
      <article class="info-panel">
        <h3>Napaka pri nalaganju novic</h3>
        <p>Preveri ali backend in Discord bot teceta pravilno.</p>
      </article>
    `;
  }
}

function setStatus(state, label) {
  if (!statusEl) {
    return;
  }

  statusEl.classList.remove("status-online", "status-offline", "status-loading");
  statusEl.classList.add(state);
  statusEl.textContent = label;
}

async function loadServerData() {
  const server = config.server || {};
  const endpoint = server.endpoint;

  if (!endpoint) {
    setStatus("status-offline", "Ni nastavljen");
    return;
  }

  try {
    setStatus("status-loading", "Nalagam...");

    const responses = await Promise.allSettled([
      fetch(`${endpoint}/dynamic.json`, { cache: "no-store" }),
      fetch(`${endpoint}/info.json`, { cache: "no-store" }),
      fetch(`${endpoint}/players.json`, { cache: "no-store" })
    ]);

    const [dynamicResult, infoResult, playersResult] = responses;

    const dynamic =
      dynamicResult.status === "fulfilled" && dynamicResult.value.ok
        ? await dynamicResult.value.json()
        : null;

    const info =
      infoResult.status === "fulfilled" && infoResult.value.ok
        ? await infoResult.value.json()
        : null;

    const players =
      playersResult.status === "fulfilled" && playersResult.value.ok
        ? await playersResult.value.json()
        : null;

    if (!dynamic && !info && !players) {
      throw new Error("Noben FiveM endpoint ni vrnil podatkov.");
    }

    const playerCount = Array.isArray(players)
      ? players.length
      : Number(dynamic?.clients || 0);

    const maxPlayers =
      Number(dynamic?.sv_maxclients) ||
      Number(info?.vars?.sv_maxClients) ||
      Number(server.maxPlayers) ||
      0;

    setStatus("status-online", "Online");
    setText(playersEl, `${playerCount || 0} / ${maxPlayers || "--"}`);

    const endpointText = endpoint.replace(/^https?:\/\//, "");
    setText(ipEl, (config.links && config.links.websiteIpText) || endpointText);

    const discordFromInfo = info?.vars?.Discord || info?.vars?.discord;
    if (discordFromInfo) {
      setText(discordTextEl, discordFromInfo);
      setHref(discordLinkEl, discordFromInfo);
      setHref(bottomDiscordLinkEl, discordFromInfo);
    }
  } catch (error) {
    const fallbackOnline = Boolean(config.server?.fallbackOnline);
    setStatus(fallbackOnline ? "status-online" : "status-offline", fallbackOnline ? "Online" : "Offline");
    setText(playersEl, `0 / ${config.server?.maxPlayers || "--"}`);
  }
}

function initMenu() {
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("is-open");
    });
  }
}

function initReveal() {
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
}

function initParallax() {
  if (!heroEl || window.innerWidth < 900) {
    return;
  }

  heroEl.addEventListener("mousemove", (event) => {
    const rect = heroEl.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    depthItems.forEach((item) => {
      const depth = Number(item.getAttribute("data-depth")) || 0.1;
      const moveX = px * 30 * depth;
      const moveY = py * 24 * depth;
      item.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
    });
  });

  heroEl.addEventListener("mouseleave", () => {
    depthItems.forEach((item) => {
      item.style.transform = "";
    });
  });
}

function initLoader() {
  if (!siteLoaderEl) {
    return;
  }

  window.setTimeout(() => {
    siteLoaderEl.classList.add("is-hidden");
  }, 900);
}

applyBranding();
initMenu();
initReveal();
initParallax();
initLoader();
loadServerData();
loadNewsFeed();

const refreshInterval = Number(config.server?.refreshIntervalMs) || 30000;
window.setInterval(loadServerData, refreshInterval);
