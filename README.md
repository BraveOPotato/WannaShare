# WannaSend

Peer-to-peer file and message sharing in the browser. Two devices connect
directly over WebRTC — files and chat flow **device-to-device**, not through a
server. The backend only helps the two peers find each other; it never sees
your data.

Modeled as a self-hosted stack: you run the coordination services yourself in
Docker, and deploy the static frontend to Cloudflare Pages (or any static host).

---

## Features

- **Send / Receive** flow with a friendly, editable device name.
- **6-digit connection codes** — the receiver shows a code, the sender types it.
- **QR codes** — scan in-app, or point a phone camera to deep-link straight in.
- **On this network** — devices sharing your public IP appear automatically.
- **Favorites** — star a device once; it reconnects by a stable device id even
  if either side is renamed, and one tap re-dials it.
- **Accept / decline** — incoming connections show a request modal; nothing
  connects silently.
- **Files of any size** — chunked transfer with backpressure, per-file progress,
  cancel, and retry. **Chat is ephemeral** (in memory only, never persisted).
- **Custom ICE servers** — override the built-in STUN/TURN from within the app.
- **TURN is last-resort** — direct connectivity is always preferred; the relay
  only carries media when a direct path can't be established.

---

## Architecture

```
                       ┌─────────────────────────────────────────┐
   Browser A           │            Backend (Docker)             │            Browser B
 (Cloudflare Pages)    │                                         │      (Cloudflare Pages)
        │              │  signaling container (one node process) │              │
        │  :9000 /peerjs  ┌───────────────────────────────────┐  │  :9000 /peerjs
        ├───────────────► │ PeerJS broker  (WebRTC signaling) │ ◄──────────────┤
        │              │  └───────────────────────────────────┘  │              │
        │  :9001 /ws      ┌───────────────────────────────────┐  │  :9001 /ws
        ├───────────────► │ presence + short-code WebSocket   │ ◄──────────────┤
        │              │  └───────────────────────────────────┘  │              │
        │              │                                         │              │
        │              │  coturn container                       │              │
        │  :3478          ┌───────────────────────────────────┐  │  :3478
        └───────────────► │ STUN + TURN (last-resort relay)   │ ◄──────────────┘
                       │  └───────────────────────────────────┘  │
                       └─────────────────────────────────────────┘

        A ⇄ B  actual files + chat travel directly, peer-to-peer (WebRTC)
```

**Why two ports on one process.** The backend runs a single Node process that
listens on two ports: `:9000` serves the PeerJS broker plus a `/health`
endpoint, and `:9001` serves the presence / short-code WebSocket at `/ws`. They
are deliberately separate because multiple WebSocket servers sharing one HTTP
server's `upgrade` event fight over connections whose path doesn't match. Behind
a reverse proxy you can route both under a single public hostname.

**Stable identity vs session identity.** Each browser keeps a persistent
`deviceId` (a UUID in `localStorage` that survives renames and reloads). Each
session also gets a `peerId` assigned by the PeerServer, which changes every
time. The presence server maps `deviceId → current peerId`, which is what makes
favorites reconnect reliably even though the underlying peer id keeps rotating.

**What the servers do — and don't.** The PeerJS broker relays the initial
offer/answer/ICE handshake. The presence server groups devices by public IP,
issues short codes, and tracks which favorites are currently online. coturn
relays media only if a direct peer connection can't be formed. None of them
touch message or file contents — that's all end-to-end over the WebRTC data
channel.

---

## Repository layout

```
wannasend/
├── frontend/                 React + TypeScript + Vite (static site)
│   ├── src/
│   │   ├── components/        UI, screens, modals
│   │   ├── state/             React context providers (session, identity, …)
│   │   ├── lib/               peer client, signaling client, file transfer, QR
│   │   └── config.ts          reads VITE_* env
│   └── .env.example
├── backend/                  Node coordination services (Docker)
│   ├── src/
│   │   ├── server.ts          entrypoint — the two listeners
│   │   ├── peerServer.ts      PeerJS broker mount
│   │   ├── signaling.ts       presence WebSocket server
│   │   ├── registry.ts        in-memory presence registry
│   │   ├── codes.ts           6-digit code store
│   │   └── protocol.ts        WS message types (mirror of the frontend's)
│   ├── coturn/turnserver.conf coturn config (edit before deploying)
│   └── Dockerfile
├── docker-compose.yml         coturn + signaling
└── .gitignore
```

The wire protocols are defined in two mirrored files that **must stay in
sync**: `backend/src/protocol.ts` (presence WebSocket) and the peer-to-peer
message format in `frontend/src/lib/wire.ts`.

---

## Prerequisites

- **Node.js 20+** (22 recommended) and npm — for the frontend, and for running
  the backend outside Docker.
- **Docker + Docker Compose** — for the backend stack.
- **For TURN to actually work:** a host with a real, routable **public IP**.
  TURN cannot relay from behind NAT without port forwarding. STUN + direct
  connections work fine on a LAN without any of this.

---

## Quick start (local development)

### 1. Backend

```bash
# from the repo root
docker compose up --build
```

This starts:
- PeerJS broker + health on **:9000**
- presence WebSocket on **:9001**
- coturn on **:3478** (STUN works locally; TURN relay needs a public IP)

Health check: `curl http://localhost:9000/health` → `{"ok":true,...}`.

> Prefer running the Node service without Docker? `cd backend && npm install &&
> npm run dev` (uses `tsx watch`). You'd then run coturn separately, or just
> rely on STUN for local testing.

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # the defaults already point at localhost:9000/9001
npm install
npm run dev               # Vite dev server, usually http://localhost:5173
```

Open the app in two browser windows (or two devices on the same network) to try
sending between them.

---

## Configuration

### Frontend (`frontend/.env`)

| Variable | Purpose | Local default |
| --- | --- | --- |
| `VITE_PEER_HOST` | PeerServer host | `localhost` |
| `VITE_PEER_PORT` | PeerServer port (broker) | `9000` |
| `VITE_PEER_PATH` | PeerServer mount path | `/peerjs` |
| `VITE_PEER_SECURE` | `true` when served over HTTPS/WSS | `false` |
| `VITE_SIGNALING_URL` | presence WebSocket URL (note port **9001**) | `ws://localhost:9001/ws` |
| `VITE_STUN_URLS` | comma-separated STUN URLs | `stun:localhost:3478` |
| `VITE_TURN_URLS` | comma-separated TURN URLs | `turn:localhost:3478` |
| `VITE_TURN_USERNAME` | TURN username | `wannasend` |
| `VITE_TURN_CREDENTIAL` | TURN password | — |
| `VITE_PUBLIC_APP_URL` | origin embedded in QR codes | window origin |

The broker (`9000`) and presence WebSocket (`9001`) are **different ports**.
Users can override the STUN/TURN values in-app (saved to `localStorage`); the
env values are only the fallback defaults.

### Backend (environment, see `docker-compose.yml`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | broker + health port | `9000` |
| `SIGNAL_PORT` | presence WebSocket port | `9001` |
| `PEER_PATH` | broker mount path | `/peerjs` |
| `WS_PATH` | presence WebSocket path | `/ws` |
| `TRUST_PROXY` | read `X-Forwarded-For` for the client IP | `false` |
| `CODE_TTL_MS` | how long a code stays valid | `600000` (10 min) |
| `ALLOW_ORIGIN` | CORS origin for the broker HTTP | `*` |

Enable `TRUST_PROXY` **only** behind a reverse proxy you control that sets
`X-Forwarded-For`. Otherwise "On this network" would lump everyone behind the
proxy's single IP together.

### coturn (`backend/coturn/turnserver.conf`)

Edit before deploying:
- `external-ip` → your server's public IPv4 (`PUBLIC/PRIVATE` if behind 1:1 NAT).
- `user=wannasend:...` → set a strong secret, and use the **same** values for
  `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`.
- `realm` → your domain.
- Open the `min-port`–`max-port` UDP range (default `49160`–`49200`) plus `3478`
  on your firewall / security group.

---

## Deploying

### Frontend → Cloudflare Pages

1. Push this repo to GitHub/GitLab and create a Pages project from it.
2. Build settings:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Add the `VITE_*` variables in the Pages dashboard, pointing at your public
   backend. In production these must be **secure**:
   - `VITE_PEER_SECURE=true`
   - `VITE_SIGNALING_URL=wss://your-backend-host/ws`
   - `VITE_PEER_HOST=your-backend-host` (and `VITE_PEER_PORT=443` if proxied)
   - `turns:`/`wss:` everywhere — an HTTPS page cannot open insecure `ws://` or
     talk to a non-secure peer broker (mixed content).

The app uses `HashRouter`, so it works on static hosting without any SPA
rewrite rules.

### Backend → a host with a public IP

1. Set the coturn placeholders and backend env as above.
2. `docker compose up -d --build`.
3. Put a TLS-terminating reverse proxy (Caddy, nginx, Cloudflare Tunnel) in
   front so the browser can reach the broker and presence WebSocket over
   `https`/`wss`. Route `/peerjs` → `:9000` and `/ws` → `:9001`, or expose them
   as two hostnames — whichever matches your `VITE_*` values. Set
   `TRUST_PROXY=true` if the proxy sets `X-Forwarded-For`.
4. coturn is easiest with `network_mode: host` (already set). If you can't use
   host networking, switch to the commented port mapping in
   `docker-compose.yml` and keep the range aligned with `turnserver.conf`.

---

## How connecting works

- **By code:** the receiver opens **Receive** and shows a 6-digit code (valid 10
  minutes); the sender types it. The code resolves to the receiver's current
  peer id and dials it.
- **By QR:** the same handshake, but the code + peer id are embedded in a
  deep-link URL. Scan it in-app, or with a phone camera to open the app already
  pointed at the peer.
- **On this network:** devices registered from the same public IP list each
  other automatically on the Receive screen — tap to connect.
- **Favorites:** starring a device stores its stable `deviceId` with a name you
  choose. Online favorites appear at the top of Receive; one tap re-dials, and
  it still works after either side renames.

In every case the other device sees an **incoming request** and must accept
before anything connects. Requests auto-decline after 30 seconds.

---

## Security notes

- Message and file contents are never sent to the servers — they travel
  peer-to-peer over the WebRTC data channel (DTLS-encrypted by the browser).
- Chat history is in memory only and disappears when the tab closes.
- coturn is configured to refuse relaying to private/loopback/multicast ranges
  and includes per-user and total quotas. Change the default TURN secret.
- Short codes are single-purpose, unique, expire after 10 minutes, and rotate
  per device.

---

## Notes & limitations

- Presence and codes are held **in memory**. Restarting the signaling service
  drops active codes and presence (peers simply re-register on reconnect); this
  is intentional for a small personal deployment.
- TURN requires a public IP, as noted above. Without it you get STUN + direct
  connections, which covers most same-network and many cross-network cases.
- This project was assembled as a complete source tree. Install dependencies
  (`npm install` in `frontend/` and `backend/`, or via the Docker build) and run
  it in your own environment; it has not been exercised against a live browser
  session here.
