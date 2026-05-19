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

const dataDir = path.join(__dirname, "data");
const newsFilePath = path.join(dataDir, "news.json");
const socialFilePath = path.join(dataDir, "social-feed.json");
const usersFilePath = path.join(dataDir, "users.json");

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
    summary: "Pregled roleplay financ, vozil, inventarja in osnovnega account statusa.",
    playerId: `SLP-${Math.floor(1000 + Math.random() * 9000)}`,
    phone: `070 ${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`,
    money: 24500,
    bank: 148200,
    job: "Police Sergeant",
    jobRank: "Rank 3",
    linkedCharacter: false,
    linkToken: randomToken(32),
    inventory: [
      { label: "Cash Wallet", value: "$ 24,500" },
      { label: "Radio", value: "Connected" },
      { label: "Weapons", value: "2 Registered" },
      { label: "Keys", value: "5 Active" }
    ],
    vehicles: [
      { plate: "PRIME 001", model: "Bravado Buffalo STX" },
      { plate: "PRIME 019", model: "Vapid Scout" },
      { plate: "PRIME 204", model: "Ubermacht Rhinehart" }
    ],
    stats: [
      { label: "Hours played", value: "186h" },
      { label: "Completed sessions", value: "74" },
      { label: "Roleplay score", value: "High" }
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
    dashboard: defaultDashboard(username)
  };
}

function findUserBySession(token) {
  if (!token) {
    return null;
  }

  return getUsers().find((user) => user.sessionToken === token) || null;
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

app.get("/api/dashboard/overview", requireAuth, (req, res) => {
  res.json(req.user.dashboard);
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

app.get("/api/news", (_req, res) => {
  res.json({ items: getNews() });
});

app.get("/api/social-feed", (_req, res) => {
  res.json({ items: getSocialFeed() });
});

app.listen(port, () => {
  console.log(`SLOPrimeRP web running on http://localhost:${port}`);
});
