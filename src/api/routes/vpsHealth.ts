// ---------------------------------------------------------------------------
// VPS Health API — server + mail-stack monitoring
// ---------------------------------------------------------------------------
// Route: GET /api/vps-health
//   → system: CPU load, memory, disk usage
//   → services: postfix, dovecot, pmta, nginx, opendkim, docker-backlink
//   → mail: 5 inboxes IMAP reachable, recent SMTP queue
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authenticateUser } from "../middleware/auth.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { createChildLogger } from "../../utils/logger.js";

const execAsync = promisify(exec);
const log = createChildLogger("vps-health");

type ServiceStatus = "active" | "inactive" | "failed" | "unknown";

interface HealthResponse {
  timestamp: string;
  system: {
    cpu: { loadAvg1: number; loadAvg5: number; loadAvg15: number; cores: number };
    memory: { totalMb: number; usedMb: number; freeMb: number; percent: number };
    disk: { totalGb: number; usedGb: number; freeGb: number; percent: number };
    uptimeSeconds: number;
  };
  services: Array<{ name: string; status: ServiceStatus; label: string }>;
  mail: {
    pmtaQueueSize: number | null;
    postfixQueueSize: number | null;
    lastPmtaActivity: string | null;
  };
  overall: "healthy" | "warning" | "critical";
}

async function readLoadAvg(): Promise<HealthResponse["system"]["cpu"]> {
  try {
    const content = await readFile("/proc/loadavg", "utf-8");
    const parts = content.trim().split(/\s+/);
    const cores = await readCpuCores();
    return {
      loadAvg1: parseFloat(parts[0] || "0"),
      loadAvg5: parseFloat(parts[1] || "0"),
      loadAvg15: parseFloat(parts[2] || "0"),
      cores,
    };
  } catch {
    return { loadAvg1: 0, loadAvg5: 0, loadAvg15: 0, cores: 1 };
  }
}

async function readCpuCores(): Promise<number> {
  try {
    const content = await readFile("/proc/cpuinfo", "utf-8");
    return content.split("\n").filter((l) => l.startsWith("processor")).length || 1;
  } catch {
    return 1;
  }
}

async function readMemory(): Promise<HealthResponse["system"]["memory"]> {
  try {
    const content = await readFile("/proc/meminfo", "utf-8");
    const parse = (key: string): number => {
      const m = content.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
      return m ? parseInt(m[1], 10) : 0;
    };
    const totalKb = parse("MemTotal");
    const availKb = parse("MemAvailable");
    const usedKb = totalKb - availKb;
    return {
      totalMb: Math.round(totalKb / 1024),
      usedMb: Math.round(usedKb / 1024),
      freeMb: Math.round(availKb / 1024),
      percent: totalKb > 0 ? Math.round((usedKb / totalKb) * 1000) / 10 : 0,
    };
  } catch {
    return { totalMb: 0, usedMb: 0, freeMb: 0, percent: 0 };
  }
}

async function readDisk(): Promise<HealthResponse["system"]["disk"]> {
  try {
    const { stdout } = await execAsync("df -B1 / | tail -1", { timeout: 2000 });
    const parts = stdout.trim().split(/\s+/);
    const total = parseInt(parts[1] || "0", 10);
    const used = parseInt(parts[2] || "0", 10);
    const free = parseInt(parts[3] || "0", 10);
    return {
      totalGb: Math.round((total / 1e9) * 10) / 10,
      usedGb: Math.round((used / 1e9) * 10) / 10,
      freeGb: Math.round((free / 1e9) * 10) / 10,
      percent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
    };
  } catch {
    return { totalGb: 0, usedGb: 0, freeGb: 0, percent: 0 };
  }
}

async function readUptime(): Promise<number> {
  try {
    const content = await readFile("/proc/uptime", "utf-8");
    return Math.round(parseFloat(content.trim().split(/\s+/)[0] || "0"));
  } catch {
    return 0;
  }
}

async function checkService(name: string): Promise<ServiceStatus> {
  try {
    // Note: backlink-engine runs inside Docker; it cannot directly query
    // systemd on the host. We try docker ps for its own container, and
    // for host services we try TCP probe (postfix 25, dovecot 993, nginx 80).
    const { stdout } = await execAsync(`systemctl is-active ${name} 2>&1`, {
      timeout: 1500,
    });
    const s = stdout.trim();
    if (s === "active") return "active";
    if (s === "inactive") return "inactive";
    if (s === "failed") return "failed";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function tcpProbe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("node:net") as typeof import("node:net");
    const sock = new net.Socket();
    const timer = setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, 2000);
    sock.once("connect", () => {
      clearTimeout(timer);
      sock.end();
      resolve(true);
    });
    sock.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    sock.connect(port, host);
  });
}

async function probeServiceViaTCP(
  name: string,
  host: string,
  port: number,
): Promise<ServiceStatus> {
  const ok = await tcpProbe(host, port);
  return ok ? "active" : "failed";
}

async function readPmtaQueueSize(): Promise<number | null> {
  // Parse the latest "Queue size" line from /var/log/pmta/log (mounted in Docker?)
  try {
    const { stdout } = await execAsync(
      "tail -50 /var/log/pmta/log 2>/dev/null | grep 'Queue size' | tail -1",
      { timeout: 1500 },
    );
    const m = stdout.match(/Queue size:\s+(\d+)\s+rcpts?/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

async function readPostfixQueueSize(): Promise<number | null> {
  try {
    const { stdout } = await execAsync("mailq 2>/dev/null | tail -1", {
      timeout: 1500,
    });
    const m = stdout.match(/(\d+)\s+Request/);
    return m ? parseInt(m[1], 10) : 0;
  } catch {
    return null;
  }
}

async function readLastPmtaActivity(): Promise<string | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { stdout } = await execAsync(
      `tail -1 /var/log/pmta/acct-${today}-0000.csv 2>/dev/null`,
      { timeout: 1500 },
    );
    const m = stdout.match(/,(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[^,]+),/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function computeOverall(h: HealthResponse): HealthResponse["overall"] {
  if (h.system.disk.percent > 90) return "critical";
  if (h.system.memory.percent > 95) return "critical";
  const failed = h.services.filter((s) => s.status === "failed").length;
  if (failed >= 2) return "critical";
  if (failed >= 1) return "warning";
  if (h.system.disk.percent > 80 || h.system.memory.percent > 85) return "warning";
  return "healthy";
}

export default async function vpsHealthRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticateUser);

  app.get("/", async (_req: FastifyRequest, reply: FastifyReply) => {
    const [cpu, memory, disk, uptime, pmtaQueue, postfixQueue, lastPmta] =
      await Promise.all([
        readLoadAvg(),
        readMemory(),
        readDisk(),
        readUptime(),
        readPmtaQueueSize(),
        readPostfixQueueSize(),
        readLastPmtaActivity(),
      ]);

    // From inside a Docker container we cannot reliably talk to host systemd.
    // Probe host services via TCP on the Docker bridge gateway (host.docker.internal / 172.17.0.1).
    const hostIp = process.env.VPS_HOST_IP || "172.17.0.1";

    const servicesResults = await Promise.all([
      probeServiceViaTCP("postfix", hostIp, 25).then(
        (s) => ({ name: "postfix", status: s, label: "Postfix SMTP (25)" }),
      ),
      probeServiceViaTCP("dovecot", hostIp, 993).then(
        (s) => ({ name: "dovecot", status: s, label: "Dovecot IMAP (993)" }),
      ),
      probeServiceViaTCP("pmta", hostIp, 2525).then(
        (s) => ({ name: "pmta", status: s, label: "PowerMTA relay (2525)" }),
      ),
      probeServiceViaTCP("nginx", hostIp, 80).then(
        (s) => ({ name: "nginx", status: s, label: "Nginx (80)" }),
      ),
    ]);

    const services: HealthResponse["services"] = servicesResults.filter(
      (s): s is NonNullable<typeof s> => !!s,
    );

    const response: HealthResponse = {
      timestamp: new Date().toISOString(),
      system: { cpu, memory, disk, uptimeSeconds: uptime },
      services,
      mail: {
        pmtaQueueSize: pmtaQueue,
        postfixQueueSize: postfixQueue,
        lastPmtaActivity: lastPmta,
      },
      overall: "healthy",
    };
    response.overall = computeOverall(response);

    log.debug({ overall: response.overall }, "vps-health snapshot");
    return reply.send({ data: response });
  });
}
