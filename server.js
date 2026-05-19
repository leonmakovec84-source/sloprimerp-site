import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const port = Number(process.env.PORT || 3000);
const newsChannelId = process.env.DISCORD_NEWS_CHANNEL_ID || "";
const socialChannelId = process.env.DISCORD_SOCIAL_CHANNEL_ID || "";
const botToken = process.env.DISCORD_BOT_TOKEN || "";
const mysqlConnectionString = process.env.MYSQL_CONNECTION_STRING || "";
const usersTableName = process.env.FIVEM_USERS_TABLE || "users";
const vehiclesTableName = process.env.FIVEM_VEHICLES_TABLE || "owned_vehicles";

const dataDir = path.join(__dirname, "data");
const newsFilePath = path.join(dataDir, "news.json");
const socialFilePath = path.join(dataDir, "social-feed.json");
const usersFilePath = path.join(dataDir, "users.json");
let mysqlPool = null;

function ensureStorage(filePath, fallback = "[]") {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, fallback, "utf8");
  }
}

function readList(filePath) {
  ensureStorage(filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(filePath, items) {
  ensureStorage(filePath);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseMysqlConnectionString(connectionString) {
  if (!connectionString) {
    return null;
  }

  const normalized = connectionString
    .replace(/^set\s+mysql_connection_string\s+/i, "")
    .replace(/^mysql_connection_string\s+/i, "")
    .replace(/^["']|["']$/g, "");

  const parts = normalized.split(";").map((part) => part.trim()).filter(Boolean);
  const mapped = {};

  for (const part of parts) {
    const [rawKey, ...rawValue] = part.split("=");
    if (!rawKey || !rawValue.length) {
      continue;
    }

    mapped[rawKey.trim().toLowerCase()] = rawValue.join("=").trim();
  }

  return {
    host: mapped.server || mapped.host || "127.0.0.1",
    user: mapped.uid || mapped.user || mapped.username || "",
    password: mapped.password || "",
    database: mapped.database || mapped.db || "",
    port: Number(mapped.port || 3306)
  };
}

async function getMysqlPool() {
  if (mysqlPool !== null) {
    return mysqlPool;
  }

  if (!mysqlConnectionString) {
    mysqlPool = null;
    return mysqlPool;
  }

  try {
    const mysql = await import("mysql2/promise");
    const parsed = parseMysqlConnectionString(mysqlConnectionString);
    if (!parsed?.host || !parsed?.user || !parsed?.database) {
      mysqlPool = null;
      return mysqlPool;
    }

    mysqlPool = mysql.createPool({
      ...parsed,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
    return mysqlPool;
  } catch (error) {
    console.error("MySQL init failed:", error.message);
    mysqlPool = null;
    return mysqlPool;
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email
  };
}

function getUsers() {
  return readList(usersFilePath);
}

function saveUsers(users) {
  writeList(usersFilePath, users);
}

function getNews() {
  return readList(newsFilePath);
}

function saveNews(items) {
  writeList(newsFilePath, items);
}

function getSocialFeed() {
  return readList(socialFilePath);
}

function saveSocialFeed(items) {
  writeList(socialFilePath, items);
}

function defaultDashboard(username) {
  return {
    playerName: username,
    summary: "Account je ustvarjen. Naslednji korak je povezava characterja iz igre za live dashboard podatke.",
    playerId: "--",
    phone: "--",
    money: null,
    bank: null,
    job: "Ni povezano",
    jobRank: "Ni povezano",
    linkedCharacter: false,
    linkToken: randomToken(32),
    inventory: [
      { label: "Inventory sync", value: "Povezi account" },
      { label: "Job sync", value: "Caka na /link" },
      { label: "Character state", value: "Unlinked" },
      { label: "Dashboard access", value: "Basic" }
    ],
    vehicles: [],
    stats: [
      { label: "Link status", value: "Pending" },
      { label: "Database sync", value: "Waiting" },
      { label: "Platform state", value: "Ready" }
    ]
  };
}

function createUser({ username, email, password }) {
  return {
    id: randomToken(8),
    username,
    email,
    passwordHash: hashPassword(password),
    sessionToken: randomToken(20),
    linkedIdentifier: "",
    lastLinkedAt: "",
    dashboard: defaultDashboard(username)
  };
}

function findUserBySession(token) {
  if (!token) {
    return null;
  }

  return getUsers().find((user) => user.sessionToken === token) || null;
}

function normalizeDashboardValue(value, fallback = "--") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return value;
}

async function getLiveDashboardForUser(user) {
  const pool = await getMysqlPool();
  if (!pool || !user.linkedIdentifier) {
    return null;
  }

  try {
    const [userRows] = await pool.query(
      `SELECT identifier, firstname, lastname, money, bank, job, job_grade, accounts, inventory FROM \`${usersTableName}\` WHERE identifier = ? LIMIT 1`,
      [user.linkedIdentifier]
    );

    const playerRow = userRows?.[0];
    if (!playerRow) {
      return null;
    }

    const [vehicleRows] = await pool.query(
      `SELECT plate, vehicle FROM \`${vehiclesTableName}\` WHERE owner = ? LIMIT 12`,
      [user.linkedIdentifier]
    );

    const accounts = Array.isArray(playerRow.accounts)
      ? playerRow.accounts
      : safeJsonParse(playerRow.accounts, []);

    const inventory = Array.isArray(playerRow.inventory)
      ? playerRow.inventory
      : safeJsonParse(playerRow.inventory, []);

    const cashFromAccounts = Array.isArray(accounts)
      ? Number(accounts.find((entry) => entry.name === "money")?.money || 0)
      : 0;

    const bankFromAccounts = Array.isArray(accounts)
      ? Number(accounts.find((entry) => entry.name === "bank")?.money || 0)
      : 0;

    const inventoryPreview = Array.isArray(inventory)
      ? inventory
          .filter((item) => Number(item?.count || item?.amount || 0) > 0)
          .slice(0, 4)
          .map((item) => ({
            label: item.label || item.name || "Item",
            value: String(item.count || item.amount || 0)
          }))
      : [];

    const vehiclesPreview = Array.isArray(vehicleRows)
      ? vehicleRows.slice(0, 6).map((entry) => {
          const vehicleData = safeJsonParse(entry.vehicle, {});
          return {
            plate: entry.plate || "NO PLATE",
            model: vehicleData.model || vehicleData.name || "Registered Vehicle"
          };
        })
      : [];

    const fullName = [playerRow.firstname, playerRow.lastname].filter(Boolean).join(" ").trim();

    return {
      playerName: fullName || user.username,
      summary: "Dashboard je povezan s FiveM accountom in prikazuje live podatke iz baze.",
      playerId: normalizeDashboardValue(playerRow.identifier),
      phone: normalizeDashboardValue(playerRow.phone_number || playerRow.phone),
      money: Number(playerRow.money ?? cashFromAccounts ?? 0),
      bank: Number(playerRow.bank ?? bankFromAccounts ?? 0),
      job: normalizeDashboardValue(playerRow.job, "Unassigned"),
      jobRank: `Grade ${normalizeDashboardValue(playerRow.job_grade, 0)}`,
      linkedCharacter: true,
      linkToken: user.dashboard.linkToken,
      inventory: inventoryPreview.length
        ? inventoryPreview
        : [
            { label: "Inventory", value: "Ni podatkov" },
            { label: "Sync state", value: "Linked" }
          ],
      vehicles: vehiclesPreview.length
        ? vehiclesPreview
        : [
            { plate: "NO DATA", model: "Ni registriranih vozil" }
          ],
      stats: [
        { label: "Link status", value: "Linked" },
        { label: "Database sync", value: "Live" },
        { label: "Owned vehicles", value: String(Array.isArray(vehicleRows) ? vehicleRows.length : 0) }
      ]
    };
  } catch (error) {
    console.error("Live dashboard query failed:", error.message);
    return null;
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  const user = findUserBySession(token);

  if (!user) {
    res.status(401).json({ error: "Nisi prijavljen." });
    return;
  }

  req.user = user;
  next();
}

function extractMessageContent(message) {
  const embedTexts = (message.embeds || [])
    .flatMap((embed) => [
      embed.title,
      embed.description,
      ...(embed.fields || []).flatMap((field) => [field.name, field.value])
    ])
    .filter(Boolean);

  const content = [message.content || "", ...embedTexts]
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return content || "Objava brez dodatnega besedila.";
}

function extractMessageImages(message) {
  const attachmentUrls = [...(message.attachments?.values?.() || [])]
    .map((attachment) => attachment.url)
    .filter(Boolean);

  const embedUrls = (message.embeds || [])
    .flatMap((embed) => [embed.image?.url, embed.thumbnail?.url, embed.url])
    .filter((value) => typeof value === "string" && /^https?:\/\//.test(value));

  return [...new Set([...attachmentUrls, ...embedUrls])];
}

function mapMessage(message) {
  return {
    id: message.id,
    content: extractMessageContent(message),
    author: message.member?.displayName || message.author?.username || "Discord",
    createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
    url: message.url || "",
    attachments: extractMessageImages(message)
  };
}

function upsertFeedEntry(filePath, message) {
  if (!message?.id) {
    return;
  }

  const items = readList(filePath);
  const entry = mapMessage(message);
  const next = [entry, ...items.filter((item) => item.id !== entry.id)].slice(0, 20);
  writeList(filePath, next);
}

function removeFeedEntry(filePath, messageId) {
  if (!messageId) {
    return;
  }

  const items = readList(filePath);
  writeList(filePath, items.filter((item) => item.id !== messageId));
}

async function syncLatestChannelMessages(client, channelId, writer) {
  if (!channelId) {
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const messages = await channel.messages.fetch({ limit: 20 });
    const items = [...messages.values()]
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
      .map(mapMessage);

    writer(items);
  } catch (error) {
    console.error("Discord channel sync failed:", error.message);
  }
}

function startDiscordBot() {
  if (!botToken || (!newsChannelId && !socialChannelId)) {
    console.warn("Discord bot is not fully configured. APIs will serve stored data only.");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.once(Events.ClientReady, async () => {
    console.log(`Discord bot ready as ${client.user?.tag}`);
    await syncLatestChannelMessages(client, newsChannelId, saveNews);
    await syncLatestChannelMessages(client, socialChannelId, saveSocialFeed);
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.channelId === newsChannelId) {
      upsertFeedEntry(newsFilePath, message);
    }
    if (message.channelId === socialChannelId) {
      upsertFeedEntry(socialFilePath, message);
    }
  });

  client.on(Events.MessageUpdate, (_, newMessage) => {
    if (newMessage.channelId === newsChannelId) {
      upsertFeedEntry(newsFilePath, newMessage);
    }
    if (newMessage.channelId === socialChannelId) {
      upsertFeedEntry(socialFilePath, newMessage);
    }
  });

  client.on(Events.MessageDelete, (message) => {
    if (message.channelId === newsChannelId) {
      removeFeedEntry(newsFilePath, message.id);
    }
    if (message.channelId === socialChannelId) {
      removeFeedEntry(socialFilePath, message.id);
    }
  });

  client.login(botToken).catch((error) => {
    console.error("Discord bot login failed:", error.message);
  });
}

ensureStorage(newsFilePath);
ensureStorage(socialFilePath);
ensureStorage(usersFilePath);
startDiscordBot();

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/auth/register", (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    res.status(400).json({ error: "Manjkajo podatki za registracijo." });
    return;
  }

  const users = getUsers();
  const exists = users.some((user) => user.email.toLowerCase() === String(email).toLowerCase());
  if (exists) {
    res.status(409).json({ error: "Account s tem emailom ze obstaja." });
    return;
  }

  const user = createUser({ username, email, password });
  users.push(user);
  saveUsers(users);

  res.json({
    token: user.sessionToken,
    user: sanitizeUser(user)
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const passwordHash = hashPassword(password || "");
  const users = getUsers();
  const user = users.find((entry) =>
    entry.email.toLowerCase() === String(email).toLowerCase() && entry.passwordHash === passwordHash
  );

  if (!user) {
    res.status(401).json({ error: "Napacen email ali geslo." });
    return;
  }

  user.sessionToken = randomToken(20);
  saveUsers(users);

  res.json({
    token: user.sessionToken,
    user: sanitizeUser(user)
  });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const email = req.body?.email;
  if (!email) {
    res.status(400).json({ error: "Email je obvezen." });
    return;
  }

  res.json({
    message: "Reset flow je pripravljen kot osnova. V produkciji ga priklopiva na pravi mail sistem."
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "sloprimerp-site",
    version: "web-link-enabled"
  });
});

app.get("/api/dashboard/overview", requireAuth, (req, res) => {
  getLiveDashboardForUser(req.user)
    .then((liveDashboard) => {
      res.json(liveDashboard || req.user.dashboard);
    })
    .catch(() => {
      res.json(req.user.dashboard);
    });
});

app.post("/api/account/regenerate-link-token", requireAuth, (req, res) => {
  const users = getUsers();
  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    res.status(404).json({ error: "Uporabnik ni najden." });
    return;
  }

  user.dashboard.linkToken = randomToken(32);
  saveUsers(users);

  res.json({ linkToken: user.dashboard.linkToken });
});

app.get("/api/game/link", (_req, res) => {
  res.json({
    ok: true,
    method: "POST required",
    endpoint: "/api/game/link"
  });
});

app.post("/api/game/link", (req, res) => {
  const { token, identifier } = req.body || {};

  if (!token || !identifier) {
    res.status(400).json({ error: "Token in identifier sta obvezna." });
    return;
  }

  const users = getUsers();
  const user = users.find((entry) => entry.dashboard?.linkToken === token);

  if (!user) {
    res.status(404).json({ error: "Link token ni veljaven." });
    return;
  }

  user.linkedIdentifier = String(identifier);
  user.linkedCharacter = true;
  user.lastLinkedAt = new Date().toISOString();
  user.dashboard.linkedCharacter = true;
  user.dashboard.summary = "Character je povezan. Dashboard bo ob naslednjem odpiranju vlekel live podatke iz baze.";
  saveUsers(users);

  res.json({ success: true, username: user.username });
});

app.get("/api/news", (_req, res) => {
  res.json({ items: getNews() });
});

app.get("/api/social-feed", (_req, res) => {
  res.json({ items: getSocialFeed() });
});

app.listen(port, () => {
  console.log(`SLOPrimeRP web running on http://localhost:${port}`);
});
