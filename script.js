const config = window.SLOPRIME_CONFIG || {};
const authStorageKey = "sloprimerp_auth_token";

function setText(el, value) {
  if (el) {
    el.textContent = value;
  }
}

function setHref(el, value) {
  if (el && value) {
    el.href = value;
  }
}

function currency(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function getAuthToken() {
  return window.localStorage.getItem(authStorageKey) || "";
}

function setAuthToken(token) {
  if (!token) {
    window.localStorage.removeItem(authStorageKey);
    return;
  }

  window.localStorage.setItem(authStorageKey, token);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function initNavbar() {
  const navbar = document.getElementById("topbar");
  const menuButton = document.getElementById("menuButton");
  const menuClose = document.getElementById("menuClose");
  const mobileMenu = document.getElementById("mobileMenu");

  if (navbar) {
    const syncScroll = () => {
      navbar.classList.toggle("is-scrolled", window.scrollY > 14);
    };

    syncScroll();
    window.addEventListener("scroll", syncScroll, { passive: true });
  }

  if (menuButton && mobileMenu) {
    menuButton.addEventListener("click", () => {
      mobileMenu.classList.add("is-open");
      mobileMenu.setAttribute("aria-hidden", "false");
    });
  }

  if (menuClose && mobileMenu) {
    menuClose.addEventListener("click", () => {
      mobileMenu.classList.remove("is-open");
      mobileMenu.setAttribute("aria-hidden", "true");
    });
  }
}

function initReveal() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!revealItems.length) {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  revealItems.forEach((item) => observer.observe(item));
}

function applyBranding() {
  const branding = config.branding || {};
  const links = config.links || {};

  setText(document.getElementById("heroBadge"), branding.heroBadge);
  setText(document.getElementById("heroTitle"), branding.heroTitle);
  setText(document.getElementById("heroSubtitle"), branding.heroSubtitle);
  setText(document.getElementById("communityTitle"), branding.communityTitle);
  setText(document.getElementById("communityText"), branding.communityText);
  setHref(document.getElementById("discordLink"), links.discord || "#");
  setHref(document.getElementById("discordSectionLink"), links.discord || "#");
  setHref(document.getElementById("footerDiscordLink"), links.discord || "#");
  setHref(document.getElementById("connectLink"), links.join || "#");
  setHref(document.getElementById("connectLinkStep"), links.join || "#");
  setHref(document.getElementById("tebexLink"), links.tebex || "#");
  setText(document.getElementById("server-ip"), links.websiteIpText || "--");
}

function renderGallery() {
  const galleryGrid = document.getElementById("galleryGrid");
  const items = config.gallery || [];

  if (!galleryGrid || !items.length) {
    return;
  }

  galleryGrid.innerHTML = items.map((item) => `
    <article class="gallery-card premium-panel reveal is-visible">
      <div class="gallery-card-content">
        <span class="section-tag">Visual</span>
        <h3>${item.title}</h3>
        <p>${item.text}</p>
      </div>
    </article>
  `).join("");
}

function setServerStatus(state, label) {
  const statusText = document.getElementById("server-status");
  const dot = document.getElementById("statusDot");

  setText(statusText, label);

  if (dot) {
    dot.classList.toggle("is-offline", state !== "online");
  }
}

async function loadServerData() {
  const playersEl = document.getElementById("server-players");
  const endpoint = config.server?.endpoint;

  if (!playersEl || !endpoint) {
    return;
  }

  try {
    setServerStatus("loading", "Nalagam...");

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
      throw new Error("Offline");
    }

    const playerCount = Array.isArray(players) ? players.length : Number(dynamic?.clients || 0);
    const maxPlayers =
      Number(dynamic?.sv_maxclients) ||
      Number(info?.vars?.sv_maxClients) ||
      Number(config.server?.maxPlayers) ||
      0;

    setServerStatus("online", "Online");
    setText(playersEl, `${playerCount} / ${maxPlayers || "--"}`);
  } catch {
    setServerStatus("offline", "Offline");
    setText(playersEl, `0 / ${config.server?.maxPlayers || "--"}`);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const messageEl = document.getElementById("authMessage");
  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    const data = await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setAuthToken(data.token);
    messageEl.className = "form-message is-success";
    messageEl.textContent = "Prijava uspesna. Preusmerjam na dashboard...";
    window.setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 700);
  } catch (error) {
    messageEl.className = "form-message is-error";
    messageEl.textContent = error.message;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const messageEl = document.getElementById("authMessage");
  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    const data = await requestJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password })
    });

    setAuthToken(data.token);
    messageEl.className = "form-message is-success";
    messageEl.textContent = "Registracija uspesna. Preusmerjam na dashboard...";
    window.setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 700);
  } catch (error) {
    messageEl.className = "form-message is-error";
    messageEl.textContent = error.message;
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const messageEl = document.getElementById("authMessage");

  try {
    const data = await requestJson("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: form.email.value.trim() })
    });
    messageEl.className = "form-message is-success";
    messageEl.textContent = data.message || "Zahteva poslana.";
  } catch (error) {
    messageEl.className = "form-message is-error";
    messageEl.textContent = error.message;
  }
}

async function loadDashboard() {
  if (!document.body.classList.contains("dashboard-page")) {
    return;
  }

  const token = getAuthToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const profile = await requestJson("/api/dashboard/overview", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    setText(document.getElementById("dashboardPlayerName"), profile.playerName);
    setText(document.getElementById("dashboardSummary"), profile.summary);
    setText(document.getElementById("dashboardPlayerId"), profile.playerId);
    setText(document.getElementById("dashboardPhone"), profile.phone);
    setText(document.getElementById("dashboardMoney"), currency(profile.money));
    setText(document.getElementById("dashboardBank"), currency(profile.bank));
    setText(document.getElementById("dashboardJob"), profile.job);
    setText(document.getElementById("dashboardJobRank"), profile.jobRank);
    setText(document.getElementById("linkTokenValue"), profile.linkToken);
    setText(document.getElementById("linkTokenCommand"), `/link ${profile.linkToken}`);
    setText(
      document.getElementById("accountLinkTitle"),
      profile.linkedCharacter ? "Account Linked" : "Account Not Linked"
    );
    setText(
      document.getElementById("accountLinkDescription"),
      profile.linkedCharacter
        ? "Character je uspesno povezan. Dashboard zdaj prikazuje podatke iz baze, ko so na voljo."
        : "Povezi svoj SLOPrimeRP character za dostop do player data, financ, vozil in naprednega dashboard pregleda."
    );

    const inventoryList = document.getElementById("inventoryList");
    const vehicleList = document.getElementById("vehicleList");
    const statList = document.getElementById("statList");

    inventoryList.innerHTML = profile.inventory.map((item) => `
      <div class="inventory-item">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </div>
    `).join("");

    vehicleList.innerHTML = (profile.vehicles || []).length ? profile.vehicles.map((vehicle) => `
      <div class="vehicle-item">
        <span>${vehicle.plate}</span>
        <strong>${vehicle.model}</strong>
      </div>
    `).join("") : `
      <div class="vehicle-item">
        <span>Status</span>
        <strong>Povezi character za prikaz vozil</strong>
      </div>
    `;

    statList.innerHTML = profile.stats.map((item) => `
      <div class="stat-item">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </div>
    `).join("");
  } catch (error) {
    setAuthToken("");
    window.location.href = "login.html";
  }
}

async function regenerateLinkToken() {
  const token = getAuthToken();
  if (!token) {
    return;
  }

  try {
    const data = await requestJson("/api/account/regenerate-link-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    setText(document.getElementById("linkTokenValue"), data.linkToken);
    setText(document.getElementById("linkTokenCommand"), `/link ${data.linkToken}`);
  } catch (error) {
    console.error(error);
  }
}

function initAuthPages() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const logoutButton = document.getElementById("logoutButton");
  const regenLinkTokenButton = document.getElementById("regenLinkTokenButton");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", handleForgotPassword);
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      setAuthToken("");
      window.location.href = "login.html";
    });
  }

  if (regenLinkTokenButton) {
    regenLinkTokenButton.addEventListener("click", regenerateLinkToken);
  }
}

applyBranding();
initNavbar();
initReveal();
renderGallery();
initAuthPages();
loadDashboard();
loadServerData();
window.setInterval(loadServerData, Number(config.server?.refreshIntervalMs) || 30000);
