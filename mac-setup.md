# MacBook дээр Docker-оор ажиллуулах заавар

Энэ заавар нь Songolt-ийг шинэ Mac (Intel эсвэл Apple Silicon аль ч байсан) дээр Docker
ашиглан ажиллуулахад зориулагдсан. Docker container дотор бүх зүйл build хийгддэг тул
Node хувилбар зөрөх, `better-sqlite3` native binary эвдрэх зэрэг асуудал гарахгүй.

## 1. Урьдчилсан шаардлага

- **Docker Desktop for Mac** суулгасан, асаалттай байх ([docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)).
  Apple Silicon (M1/M2/M3/M4) болон Intel хоёуланд ажиллана — татахдаа чипийн төрлөө зөв сонго.
- **Git** суулгасан байх (`git --version` — ихэнх Mac дээр Xcode Command Line Tools-той хамт ирдэг,
  байхгүй бол терминал автоматаар суулгахыг санал болгоно).

## 2. Repo-г Mac руу авчрах

Одоогоор энэ repo зөвхөн энэ machine дээр local байгаа тул (git remote тохируулаагүй),
дараах хоёрын аль нэгээр Mac руу шилжүүлнэ:

**A) GitHub-руу түлхэж, тэндээс clone хийх (санал болгож буй арга):**
```bash
# энэ machine дээр — өөрийн GitHub дээр хоосон repo үүсгээд:
git remote add origin git@github.com:<хэрэглэгч>/songolt.git
git push -u origin master

# Mac дээр:
git clone git@github.com:<хэрэглэгч>/songolt.git
cd songolt
```

**B) Шууд хуулах (AirDrop / USB / rsync):**
Repo-г бүхэлд нь хуулж болно, гэхдээ `node_modules/` болон `dist/` фолдеруудыг **бүү хуул** —
эдгээр нь тухайн machine-д зориулж build хийгддэг тул Linux/х86 дээрх хуулбар Mac дээр
ажиллахгүй (яг Docker-ийг ашиглах шалтгаан нь энэ асуудлыг тойрч гарах явдал).

## 3. (Сонголтоор) орчны хувьсагч тохируулах

`docker-compose.yml` нь `ADMIN_TOKEN`-д default утга (`local-dev-admin-token`) ашигладаг тул
шууд ажиллуулж болно. Өөрийн нууц утга ашиглахыг хүсвэл repo-ийн үндсэн хавтсанд `.env`
файл үүсгэ (`docker compose` үүнийг автоматаар уншина):

```bash
cat > .env <<'EOF'
ADMIN_TOKEN=<өөрийн нууц утга>
EOF
```

## 4. Асаах

```bash
cd songolt
docker compose up
```

Анхны удаад `better-sqlite3`-ийг эх кодоос нь build хийдэг тул ~1-2 минут авна
(дараагийн удаа cache-лэгдсэн тул хурдан). Дараах мессежүүд гарвал бэлэн боллоо гэсэн үг:

```
backend-1   | ... "msg":"Server listening with Socket.IO"
frontend-1  | VITE ... ready in ... ms
```

Дэвсгэрт (терминалыг хаахгүй) ажиллуулмаар бол:
```bash
docker compose up -d
```

## 5. Тоглоомоо нээх

Browser-оор: **http://localhost:5173**

## 6. Host code авах (өрөө үүсгэхэд заавал хэрэгтэй)

Өрөө үүсгэхийн өмнө "Хост код" шаардлагатай. Хоёр аргаар авч болно:

**A) Admin panel-оор (хялбар):**
1. **http://localhost:5173/?admin=1** нээ
2. Токеноо оруул (default: `local-dev-admin-token`, эсвэл 3-р алхамд өөрөө тохируулсан утга)
3. "Generate code" дарж шинэ код авна

**B) Терминалаар:**
```bash
curl -X POST http://localhost:3001/api/admin/codes \
  -H "x-admin-token: local-dev-admin-token" \
  -H "Content-Type: application/json" -d '{}'
```

## 7. Зогсоох / дахин асаах

```bash
docker compose down       # зогсоож, container-уудыг устгана (SQLite өгөгдөл volume-д хэвээр үлдэнэ)
docker compose up -d      # дараагийн удаа дахин асаах (rebuild хийхгүй, хурдан)
docker compose up -d --build   # кодоо шинэчилсний дараа image-ийг дахин build хийж асаах
```

## Анхаарах зүйлс / Түгээмэл асуудал

- **Порт эзэлсэн байвал** (`5173` эсвэл `3001`) — `docker compose up` алдаа өгнө. Тухайн
  порт дээр өөр процесс (жишээ нь `npm run dev:all`) ажиллаж байгаа эсэхийг шалга.
- **Docker Desktop асаагаагүй бол** — "Cannot connect to the Docker daemon" алдаа гарна,
  эхлээд Docker Desktop апп-аа асаа.
- **Тоглоомын төгсгөлийн "түүх" feature ажиллахгүй** — энэ нь Mac host дээр ажиллаж буй
  локал Ollama сервер (`localhost:11434`) дуудахаар зохиогдсон бөгөөд container дотроос
  host-ийн `localhost` руу хүрэх боломжгүй тул одоогийн байдлаар Docker orчинд энэ нэг
  feature л ажиллахгүй (бусад бүх тоглоом хэвийн). Ollama-г container болгож нэмэх эсвэл
  `host.docker.internal` руу чиглүүлэх өөрчлөлт хийж болно, хүсвэл хожим тусад нь хийж болно.
- **Өгөгдлөө бүрмөсөн устгах бол:** `docker compose down -v` — энэ нь host code-уудын
  SQLite өгөгдлийг агуулсан volume-ийг устгана, ердийн `down`-д хамаарахгүй.
