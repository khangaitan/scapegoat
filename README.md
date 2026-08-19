# Сонголт (Songolt)

Монгол хэлний олон тоглогчтой **"Бункер"** survival тоглоом. Тоглогч бүр нуугдмал 10 карт
(мэргэжил, эрүүл мэнд, зан чанар, фоби гэх мэт) авч, гамшгийн дараа бункерт орох "эрхээ"
бусдад ярианы аргаар батлах ёстой — санал хураалтаар аажмаар хасагдаж, эцэст нь хагас нь
амьд үлдэнэ. Бүрэн дүрэм апп дотор (`src/lib/rules.ts`) байдаг.

## Архитектур

- **Frontend** (`src/`) — React + Vite + TypeScript, Tailwind CSS v4. Цэвэр client апп;
  бүх тоглоомын логик тусдаа backend дээр Socket.IO-оор ажилладаг.
- **Backend** (`backend/`) — Express + Socket.IO, SQLite (Drizzle ORM). Сервер authoritative
  — клиент зөвхөн `room_update` эвентээр state хүлээж авдаг.
- **`shared/`** — frontend/backend хоёрын хуваалцдаг TypeScript төрлүүд.

Дэлгэрэнгүй техникийн баримт бичиг: [CLAUDE.md](CLAUDE.md).

## Хурдан эхлэх

### Docker-оор (санал болгож буй арга)

```bash
docker compose up
```

Дараа нь [http://localhost:5173](http://localhost:5173). Mac дээр анх удаа тохируулах бол
[mac-setup.md](mac-setup.md)-г үз.

### npm-ээр (Node локал суулгасан бол)

```bash
npm install
npm --prefix backend install
npm run dev:all      # backend (3001) + Vite (5173) хамт асаана
```

Backend-д зориулж SQLite DB автоматаар үүснэ (`backend/data/songolt.db`); host code
үүсгэх зэрэг admin эрхийн үйлдэлд `ADMIN_TOKEN` тохируулах шаардлагатай
(`backend/.env`, эсвэл `docker-compose.yml`-ийн default утга).

## Deploy

Production-д гаргах заавар: [deploy.md](deploy.md) — Netlify (frontend) + Railway/Render/Fly.io
зэрэг тусдаа PaaS (backend).
