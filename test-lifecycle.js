// End-to-end lifecycle test: admin creates room, 2 players join, game starts, hands dealt.
import { io } from "./node_modules/socket.io-client/build/esm/index.js";

const URL = "http://localhost:3001";
const OPTS = { path: "/api/socket.io", transports: ["websocket"] };

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else            { console.log(`  ✗ ${label}`); failed++; }
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const s = io(URL, OPTS);
    s.once("connect", () => resolve(s));
    s.once("connect_error", err => { console.error(`${name} connect error:`, err.message); process.exit(1); });
  });
}

// Register room_update listener BEFORE emitting, then emit.
// Server now sends room_update before ack, so the listener must be ready first.
function emitAndWaitForUpdate(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event}: timeout`)), 5000);
    let ackRes = null;
    let roomRes = null;
    function tryResolve() {
      if (ackRes && roomRes) { clearTimeout(timer); resolve({ ack: ackRes, room: roomRes }); }
    }
    socket.once("room_update", room => { roomRes = room; tryResolve(); });
    socket.emit(event, payload, res => { ackRes = res; tryResolve(); });
  });
}

async function run() {
  console.log("=== Lifecycle Test ===\n");

  // --- Step 1: Admin creates room ---
  console.log("1. Admin creates room");
  const admin = await connect("admin");
  const { ack: createAck, room: adminRoom1 } = await emitAndWaitForUpdate(admin, "create_room", {
    playerName: "Админ", playerKey: "pk_admin", hostCode: "TEST123",
  });
  assert("create_room succeeds", createAck.success === true);
  assert("roomId returned (4 chars)", typeof createAck.roomId === "string" && createAck.roomId.length === 4);
  assert("playerId is stable id (not socket.id)", createAck.playerId?.startsWith("pk_"));
  assert("room status is lobby", adminRoom1.status === "lobby");
  assert("1 player in room", adminRoom1.players.length === 1);
  assert("admin is host", adminRoom1.players[0].isHost === true);
  const { roomId, playerId: adminId } = createAck;
  console.log(`   roomId=${roomId}  playerId=${adminId}\n`);

  // --- Step 2: Player 1 joins ---
  console.log("2. Player 1 joins");
  const p1 = await connect("player1");
  const adminRoom2Promise = new Promise(r => admin.once("room_update", r));
  const { ack: join1Ack, room: p1Room1 } = await emitAndWaitForUpdate(p1, "join_room", {
    roomId, playerName: "Тоглогч1", playerKey: "pk_p1",
  });
  const adminRoom2 = await adminRoom2Promise;
  assert("join_room succeeds", join1Ack.success === true);
  assert("playerId is stable id", join1Ack.playerId?.startsWith("pk_"));
  assert("p1 sees 2 players", p1Room1.players.length === 2);
  assert("admin sees 2 players", adminRoom2.players.length === 2);
  const p1Id = join1Ack.playerId;

  // --- Step 3: Player 2 joins ---
  console.log("\n3. Player 2 joins");
  const p2 = await connect("player2");
  const adminRoom3Promise = new Promise(r => admin.once("room_update", r));
  const { ack: join2Ack, room: p2Room1 } = await emitAndWaitForUpdate(p2, "join_room", {
    roomId, playerName: "Тоглогч2", playerKey: "pk_p2",
  });
  const adminRoom3 = await adminRoom3Promise;
  assert("join_room succeeds", join2Ack.success === true);
  assert("p2 sees 3 players", p2Room1.players.length === 3);
  assert("admin sees 3 players", adminRoom3.players.length === 3);
  const p2Id = join2Ack.playerId;
  console.log(`   Players: ${adminRoom3.players.map(p => p.name).join(", ")}\n`);

  // --- Step 4: Admin starts game ---
  console.log("4. Admin starts game");
  const updates = {};
  const waitAll = Promise.all([
    new Promise(r => admin.once("room_update", r)).then(r => { updates.admin = r; }),
    new Promise(r => p1.once("room_update", r)).then(r => { updates.p1 = r; }),
    new Promise(r => p2.once("room_update", r)).then(r => { updates.p2 = r; }),
  ]);

  const startAck = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("start_game timeout")), 5000);
    admin.emit("start_game", {}, r => { clearTimeout(t); res(r); });
  });
  assert("start_game succeeds", startAck.success === true);

  await waitAll;
  assert("admin gets playing room_update", updates.admin?.status === "playing");
  assert("p1 gets playing room_update", updates.p1?.status === "playing");
  assert("p2 gets playing room_update", updates.p2?.status === "playing");

  // --- Step 5: Verify hands ---
  console.log("\n5. Verify card hands");
  const findPlayer = (snapshot, id) => snapshot?.players.find(p => p.id === id);

  const adminInAdmin = findPlayer(updates.admin, adminId);
  assert("admin sees own hand", adminInAdmin?.hand !== null);
  assert("admin hand has all 10 categories", adminInAdmin?.hand && [
    "profession","health","ageGender","hobby","personality",
    "specialCard1","specialCard2","phobia","extraInfo","bagItem",
  ].every(k => !!adminInAdmin.hand[k]));

  assert("p1 sees own hand", findPlayer(updates.p1, p1Id)?.hand !== null);
  assert("p2 sees own hand", findPlayer(updates.p2, p2Id)?.hand !== null);

  assert("admin cannot see p1's hand", findPlayer(updates.admin, p1Id)?.hand === null);
  assert("p1 cannot see admin's hand", findPlayer(updates.p1, adminId)?.hand === null);

  assert("disaster card present", !!updates.admin?.disaster?.name);
  assert("bunker description present", !!updates.admin?.bunker?.description);
  console.log(`   Disaster: ${updates.admin?.disaster?.name}`);
  console.log(`   Bunker:   ${updates.admin?.bunker?.description}`);

  // --- Step 6: Admin reconnect ---
  console.log("\n6. Admin reconnects (simulates page refresh)");
  admin.disconnect();
  await new Promise(r => setTimeout(r, 300));

  const admin2 = await connect("admin2");
  const { ack: rejoinAck, room: rejoinRoom } = await emitAndWaitForUpdate(admin2, "join_room", {
    roomId, playerName: "Админ", playerKey: "pk_admin",
  });
  assert("rejoin succeeds", rejoinAck.success === true);
  assert("same playerId after reconnect", rejoinAck.playerId === adminId);
  assert("room still playing after reconnect", rejoinRoom.status === "playing");
  assert("hand intact after reconnect", findPlayer(rejoinRoom, adminId)?.hand !== null);
  console.log(`   Reconnect playerId: ${rejoinAck.playerId}`);

  // --- Summary ---
  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
  admin2.disconnect(); p1.disconnect(); p2.disconnect();
  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 200);
}

run().catch(err => { console.error("Test crashed:", err); process.exit(1); });
