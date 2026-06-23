import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io, type Socket } from "socket.io-client";
import { readFileSync } from "node:fs";

const OPTS = { path: "/api/socket.io", transports: ["websocket"] as const };

function connect(url: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, OPTS);
    s.once("connect", () => resolve(s));
    s.once("connect_error", (err) => reject(err));
  });
}

// Emit and wait for both the ack and the resulting room_update broadcast.
// Resolves immediately on ack failure — no room_update follows an error.
function emitAndWaitForUpdate(socket: Socket, event: string, payload: unknown) {
  return new Promise<{ ack: any; room: any }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event}: timeout`)), 8000);
    let ackRes: any = null;
    let roomRes: any = null;
    const tryResolve = () => {
      if (ackRes && roomRes) { clearTimeout(timer); resolve({ ack: ackRes, room: roomRes }); }
      if (ackRes?.success === false) { clearTimeout(timer); resolve({ ack: ackRes, room: null }); }
    };
    socket.once("room_update", (room) => { roomRes = room; tryResolve(); });
    socket.emit(event, payload, (res: any) => { ackRes = res; tryResolve(); });
  });
}

describe("songolt lifecycle", () => {
  let url: string;
  let hostCode: string;
  let admin: Socket, p1: Socket, p2: Socket;
  let roomId: string, adminId: string, p1Id: string, p2Id: string;

  beforeAll(() => {
    const cfg = JSON.parse(readFileSync("/tmp/songolt-test-config.json", "utf-8"));
    url = cfg.backendUrl;
    hostCode = cfg.hostCode;
  });

  afterAll(() => {
    admin?.disconnect();
    p1?.disconnect();
    p2?.disconnect();
  });

  it("admin creates a room", async () => {
    admin = await connect(url);
    const { ack, room } = await emitAndWaitForUpdate(admin, "create_room", {
      playerName: "Админ", playerKey: "pk_admin", hostCode,
    });

    expect(ack.success, `create_room failed: ${ack.error}`).toBe(true);
    expect(typeof ack.roomId).toBe("string");
    expect(ack.roomId.length).toBe(6);    // generateRoomId: Math.random().toString(36).substring(2, 8)
    expect(typeof ack.playerId).toBe("string"); // socket.id, not playerKey
    expect(room.status).toBe("lobby");
    expect(room.players).toHaveLength(1);
    expect(room.players[0].isHost).toBe(true);

    roomId = ack.roomId;
    adminId = ack.playerId;
  });

  it("player 1 joins", async () => {
    p1 = await connect(url);
    const adminUpdatePromise = new Promise<any>((r) => admin.once("room_update", r));
    const { ack, room: p1Room } = await emitAndWaitForUpdate(p1, "join_room", {
      roomId, playerName: "Тоглогч1", playerKey: "pk_p1",
    });
    const adminRoom = await adminUpdatePromise;

    expect(ack.success, `join_room p1 failed: ${ack.error}`).toBe(true);
    expect(p1Room.players).toHaveLength(2);
    expect(adminRoom.players).toHaveLength(2);

    p1Id = ack.playerId;
  });

  it("player 2 joins", async () => {
    p2 = await connect(url);
    const adminUpdatePromise = new Promise<any>((r) => admin.once("room_update", r));
    const { ack, room: p2Room } = await emitAndWaitForUpdate(p2, "join_room", {
      roomId, playerName: "Тоглогч2", playerKey: "pk_p2",
    });
    const adminRoom = await adminUpdatePromise;

    expect(ack.success, `join_room p2 failed: ${ack.error}`).toBe(true);
    expect(p2Room.players).toHaveLength(3);
    expect(adminRoom.players).toHaveLength(3);

    p2Id = ack.playerId;
  });

  it("admin starts the game and all players get hands (fog of war)", async () => {
    const updates: Record<string, any> = {};
    const allUpdated = Promise.all([
      new Promise<void>((r) => admin.once("room_update", (u) => { updates.admin = u; r(); })),
      new Promise<void>((r) => p1.once("room_update", (u) => { updates.p1 = u; r(); })),
      new Promise<void>((r) => p2.once("room_update", (u) => { updates.p2 = u; r(); })),
    ]);

    const startAck = await new Promise<any>((res, rej) => {
      const t = setTimeout(() => rej(new Error("start_game timeout")), 8000);
      admin.emit("start_game", {}, (r: any) => { clearTimeout(t); res(r); });
    });

    expect(startAck.success, `start_game failed: ${startAck.error}`).toBe(true);
    await allUpdated;

    const findPlayer = (snap: any, id: string) => snap?.players.find((p: any) => p.id === id);
    const HAND_KEYS = ["profession","health","ageGender","hobby","personality","specialCard1","specialCard2","phobia","extraInfo","bagItem"];

    // All players see the game as "playing"
    expect(updates.admin?.status).toBe("playing");
    expect(updates.p1?.status).toBe("playing");
    expect(updates.p2?.status).toBe("playing");

    // Each player's own hand is populated with all 10 categories
    const adminInAdmin = findPlayer(updates.admin, adminId);
    expect(adminInAdmin?.hand, "admin should see own hand").not.toBeNull();
    expect(HAND_KEYS.every((k) => !!adminInAdmin?.hand?.[k])).toBe(true);

    expect(findPlayer(updates.p1, p1Id)?.hand, "p1 should see own hand").not.toBeNull();
    expect(findPlayer(updates.p2, p2Id)?.hand, "p2 should see own hand").not.toBeNull();

    // Cross-player hands must be null (fog of war enforced server-side)
    expect(findPlayer(updates.admin, p1Id)?.hand, "admin must not see p1 hand").toBeNull();
    expect(findPlayer(updates.p1, adminId)?.hand, "p1 must not see admin hand").toBeNull();

    // Disaster and bunker are set
    expect(updates.admin?.disaster?.name, "disaster must be set").toBeTruthy();
    expect(updates.admin?.bunker?.description, "bunker must be set").toBeTruthy();
  });

  it("admin reconnects and retains their position", async () => {
    admin.disconnect();
    await new Promise((r) => setTimeout(r, 300));

    const admin2 = await connect(url);
    const { ack, room } = await emitAndWaitForUpdate(admin2, "join_room", {
      roomId, playerName: "Админ", playerKey: "pk_admin",
    });

    expect(ack.success, `reconnect failed: ${ack.error}`).toBe(true);
    expect(ack.reconnected).toBe(true);
    expect(room.status).toBe("playing");

    // Find admin by name since socket.id changed
    const adminPlayer = room.players.find((p: any) => p.name === "Админ");
    expect(adminPlayer?.hand, "admin hand intact after reconnect").not.toBeNull();

    admin = admin2;
  });
});
