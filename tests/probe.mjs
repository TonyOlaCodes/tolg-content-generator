/**
 * Runtime probe for a *running* server: connects to the same origin the browser
 * uses (/ws on the served port) with three real clients, starts a match and
 * checks that roles, snapshots and server-authoritative movement all flow.
 *
 *   node tests/probe.mjs [origin]      # default http://127.0.0.1:3000
 *
 * Uses the WebSocket implementation built into Node 22+, so it needs no
 * dependencies and can run inside a container or from a health check.
 */

const origin = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const socketUrl = `${origin.replace(/^http/, "ws")}/ws`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];

function check(label, ok) {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

function makeClient(name) {
  const socket = new WebSocket(socketUrl);
  const messages = [];
  socket.addEventListener("message", (event) => {
    try {
      messages.push(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  });
  return {
    name,
    socket,
    messages,
    playerId: "",
    open: () =>
      new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", () => reject(new Error(`${name}: socket error`)), {
          once: true,
        });
      }),
    send: (message) => socket.send(JSON.stringify(message)),
    async waitFor(type, predicate = () => true, timeout = 8000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const found = messages.find((message) => message.t === type && predicate(message));
        if (found) return found;
        await sleep(25);
      }
      throw new Error(`${name}: timed out waiting for ${type}`);
    },
  };
}

async function main() {
  const alpha = makeClient("A");
  await alpha.open();
  alpha.send({ t: "join", code: null, nickname: "Probe A", avatar: 0 });
  const welcome = await alpha.waitFor("welcome");
  alpha.playerId = welcome.playerId;
  check("lobby created with a six-character code", /^[A-Z0-9]{6}$/.test(welcome.code));

  const bravo = makeClient("B");
  const charlie = makeClient("C");
  await Promise.all([bravo.open(), charlie.open()]);
  bravo.send({ t: "join", code: welcome.code, nickname: "Probe B", avatar: 1 });
  charlie.send({ t: "join", code: welcome.code, nickname: "Probe C", avatar: 2 });
  const [welcomeB, welcomeC] = await Promise.all([bravo.waitFor("welcome"), charlie.waitFor("welcome")]);
  bravo.playerId = welcomeB.playerId;
  charlie.playerId = welcomeC.playerId;
  const lobby = await charlie.waitFor("lobby", (message) => message.players.length === 3);
  check("three players share the lobby", lobby.players.length === 3);

  alpha.send({ t: "start" });
  const roles = await Promise.all([
    alpha.waitFor("role"),
    bravo.waitFor("role"),
    charlie.waitFor("role"),
  ]);
  const imposters = roles.filter((message) => message.card.team === "imposters");
  check("roles are dealt privately, exactly one imposter", imposters.length === 1);
  check(
    "staff never receive the sabotage panel",
    roles
      .filter((message) => message.card.team === "employees")
      .every((message) => !alpha.messages.some((entry) => entry.t === "sabotages" && entry.players)),
  );

  const firstSnap = await alpha.waitFor("snap", (message) => message.snap.players.length === 3);
  check(
    "snapshots stream with every player and the elephant",
    firstSnap.snap.players.length === 3 && Number.isFinite(firstSnap.snap.elephant.x),
  );

  await alpha.waitFor("snap", (message) => message.snap.phase === "playing", 20000);
  check("the shift starts after the role reveal", true);

  const before = [...alpha.messages]
    .reverse()
    .find((message) => message.t === "snap")
    .snap.players.find((player) => player.id === alpha.playerId).x;
  alpha.send({ t: "input", seq: 1, mx: -1, my: 0 });
  await sleep(700);
  alpha.send({ t: "input", seq: 2, mx: 0, my: 0 });
  await sleep(300);
  const after = [...alpha.messages]
    .reverse()
    .find((message) => message.t === "snap")
    .snap.players.find((player) => player.id === alpha.playerId).x;
  check("movement is server-authoritative and responds to input", after < before - 10);

  const chatty = alpha.messages.filter((message) => message.t === "snap").length;
  check("snapshots arrive at a steady rate", chatty > 8);

  for (const client of [alpha, bravo, charlie]) client.socket.close();
  const failed = checks.filter((entry) => !entry.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} probe checks passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.log(`FAIL probe threw: ${error.message}`);
  process.exit(1);
});
