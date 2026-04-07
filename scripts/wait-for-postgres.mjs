import net from "node:net";

const host = process.env.PGHOST || "localhost";
const port = Number(process.env.PGPORT || 5432);
const timeoutMs = Number(process.env.PG_WAIT_MS || 60000);
const deadline = Date.now() + timeoutMs;

function tryOnce() {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port }, () => {
      s.end();
      resolve();
    });
    s.on("error", reject);
    s.setTimeout(2000, () => {
      s.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function main() {
  process.stdout.write(`Waiting for Postgres at ${host}:${port}…`);
  while (Date.now() < deadline) {
    try {
      await tryOnce();
      console.log(" ready.");
      return;
    } catch {
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  console.error(
    "\nPostgres did not become reachable. Start Docker Desktop, then run: npm run db:up",
  );
  process.exit(1);
}

main();
