# SLOPrimeRP povezava s FiveM serverjem

Glavne nastavitve urejas v datoteki `config.js`.

## 1. Osnovni linki

V `config.js` zamenjaj:

```js
links: {
  discord: "https://discord.gg/sloprimerp",
  join: "https://cfx.re/join/abc123",
  websiteIpText: "connect.sloprimerp.si"
}
```

- `discord`: pravi Discord invite
- `join`: tvoj `cfx.re/join/...` link
- `websiteIpText`: tekst, ki se pokaze na strani kot IP ali connect domena

## 2. FiveM endpoint

V `config.js` zamenjaj:

```js
server: {
  endpoint: "http://127.0.0.1:30120",
  maxPlayers: 250,
  refreshIntervalMs: 30000,
  fallbackOnline: false
}
```

- `endpoint` naj kaze na tvoj FiveM host, npr. `http://123.123.123.123:30120`
- iz tega endpointa stran bere:
  - `/info.json`
  - `/players.json`
  - `/dynamic.json`

## 3. Kaj mora biti v server.cfg

Primer uporabnih vrstic:

```cfg
sv_hostname "SLOPrimeRP"
sets locale "sl-SI"
sets Discord "https://discord.gg/sloprimerp"
sets tags "slovenia,roleplay,seriousrp"
```

Po zelji lahko dodas se svoje custom info:

```cfg
sets SLOPrimeRP_Economy "Realistic"
sets SLOPrimeRP_Whitelist "Open"
```

## 4. Pomembno glede dostopa

Ce spletna stran ne prikaze live podatkov, sta navadno tezavi ti dve:

1. `sv_requestParanoia` je previsok
2. host blokira CORS ali javni dostop do JSON endpointov

Ce imas v `server.cfg` to:

```cfg
sv_requestParanoia 2
```

ali:

```cfg
sv_requestParanoia 3
```

potem `info.json`, `dynamic.json` in `players.json` ne bodo delovali za spletno stran.

## 5. Najbolj varen setup za hosting

Ce bos stran gostoval na drugem hostu kot FiveM server, je najbolj zanesljivo:

1. narediti mali backend/proxy
2. backend bere FiveM `players.json`, `info.json`, `dynamic.json`
3. frontend bere samo tvoj backend

Ce hoces, ti lahko naslednjic naredim tudi:

- `Node.js` backend proxy
- `Express` API `/api/server-status`
- pripravljeno za deployment
