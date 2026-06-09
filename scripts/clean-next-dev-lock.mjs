import fs from "node:fs/promises";
import path from "node:path";

const lockPath = path.join(process.cwd(), ".next", "dev", "lock");

async function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  if (process.platform === "linux") {
    try {
      await fs.access(`/proc/${pid}`);
      return true;
    } catch {
      return false;
    }
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

try {
  const raw = await fs.readFile(lockPath, "utf8");
  const lock = JSON.parse(raw);
  const pid = Number(lock?.pid);

  if (await isProcessAlive(pid)) {
    console.log(
      `Next dev lock is already held by PID ${pid}. Stop that server first or use another port.`,
    );
    process.exit(1);
  }

  await fs.rm(lockPath, { force: true });
  console.log(`Removed stale Next dev lock for PID ${Number.isFinite(pid) ? pid : "unknown"}.`);
} catch (error) {
  if (error?.code !== "ENOENT") {
    console.warn(`Could not inspect Next dev lock: ${error.message}`);
  }
}
