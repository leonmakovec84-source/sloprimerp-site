import "dotenv/config";
import express from "express";
import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const port = Number(process.env.PORT || 3000);
const newsChannelId = process.env.DISCORD_NEWS_CHANNEL_ID || "";
const socialChannelId = process.env.DISCORD_SOCIAL_CHANNEL_ID || "";
const botToken = process.env.DISCORD_BOT_TOKEN || "";
const newsFilePath = path.join(__dirname, "data", "news.json");
const socialFilePath = path.join(__dirname, "data", "social-feed.json");

function ensureNewsStorage() {
  const dataDir = path.dirname(newsFilePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(newsFilePath)) {
    fs.writeFileSync(newsFilePath, "[]", "utf8");
  }
}

function readNews() {
  ensureNewsStorage();

  try {
    const raw = fs.readFileSync(newsFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNews(items) {
  ensureNewsStorage();
  fs.writeFileSync(newsFilePath, JSON.stringify(items, null, 2), "utf8");
}

function readSocialFeed() {
  ensureNewsStorage();

  try {
    if (!fs.existsSync(socialFilePath)) {
      fs.writeFileSync(socialFilePath, "[]", "utf8");
    }

    const raw = fs.readFileSync(socialFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSocialFeed(items) {
  ensureNewsStorage();
  fs.writeFileSync(socialFilePath, JSON.stringify(items, null, 2), "utf8");
}

function removeNewsById(messageId) {
  if (!messageId) {
    return;
  }

  const items = readNews();
  const next = items.filter((item) => item.id !== messageId);
  writeNews(next);
}

function removeSocialById(messageId) {
  if (!messageId) {
    return;
  }

  const items = readSocialFeed();
  const next = items.filter((item) => item.id !== messageId);
  writeSocialFeed(next);
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

function upsertNewsFromMessage(message) {
  if (!message || !message.id) {
    return;
  }

  const items = readNews();
  const entry = mapMessage(message);
  const next = [entry, ...items.filter((item) => item.id !== entry.id)].slice(0, 20);
  writeNews(next);
}

function upsertSocialFromMessage(message) {
  if (!message || !message.id) {
    return;
  }

  const items = readSocialFeed();
  const entry = mapMessage(message);
  const next = [entry, ...items.filter((item) => item.id !== entry.id)].slice(0, 20);
  writeSocialFeed(next);
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
    await syncLatestChannelMessages(client, newsChannelId, writeNews);
    await syncLatestChannelMessages(client, socialChannelId, writeSocialFeed);
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.channelId === newsChannelId) {
      upsertNewsFromMessage(message);
    }
    if (message.channelId === socialChannelId) {
      upsertSocialFromMessage(message);
    }
  });

  client.on(Events.MessageUpdate, (_, newMessage) => {
    if (newMessage.channelId === newsChannelId) {
      upsertNewsFromMessage(newMessage);
    }
    if (newMessage.channelId === socialChannelId) {
      upsertSocialFromMessage(newMessage);
    }
  });

  client.on(Events.MessageDelete, (message) => {
    if (message.channelId === newsChannelId) {
      removeNewsById(message.id);
    }
    if (message.channelId === socialChannelId) {
      removeSocialById(message.id);
    }
  });

  client.login(botToken).catch((error) => {
    console.error("Discord bot login failed:", error.message);
  });
}

ensureNewsStorage();
startDiscordBot();

app.use(express.static(__dirname));

app.get("/api/news", (_req, res) => {
  res.json({ items: readNews() });
});

app.get("/api/social-feed", (_req, res) => {
  res.json({ items: readSocialFeed() });
});

app.listen(port, () => {
  console.log(`SLOPrimeRP web running on http://localhost:${port}`);
});
