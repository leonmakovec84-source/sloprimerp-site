# Discord novice -> spletna stran

Ta projekt zdaj podpira:

- Discord bot za spremljanje `novice` kanala
- API `GET /api/news`
- prikaz novic na `novice.html`

## 1. Ustvari Discord bota

V Discord Developer Portalu:

1. ustvari aplikacijo
2. dodaj bota
3. vklopi `MESSAGE CONTENT INTENT`

Bot potrebuje vsaj pravice:

- View Channels
- Read Message History

## 2. Ustvari `.env`

Skopiraj `.env.example` v `.env` in izpolni:

```env
PORT=3000
DISCORD_BOT_TOKEN=...
DISCORD_NEWS_CHANNEL_ID=...
DISCORD_GUILD_ID=...
```

## 3. Namesti pakete

```bash
npm install
```

## 4. Zazeni

```bash
npm start
```

## 5. Povezi Discord channel link na frontend

V `config.js` popravi:

```js
news: {
  apiUrl: "/api/news",
  discordChannelUrl: "https://discord.com/channels/YOUR_GUILD_ID/YOUR_CHANNEL_ID"
}
```

Ko objavis sporocilo v nastavljenem Discord news kanalu:

1. bot zazna sporocilo
2. shrani objavo v `data/news.json`
3. `novice.html` jo prikaze na spletni strani
