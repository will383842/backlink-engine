// ---------------------------------------------------------------------------
// Maildir reader — lists and parses messages from the VPS mail spool.
// ---------------------------------------------------------------------------
// Reads /var/mail/<user>/Maildir (mounted read-only from the host) using the
// Dovecot-compatible Maildir++ layout (new/ + cur/). Parses each message with
// mailparser. No IMAP auth needed, no network round-trips.
//
// Mailbox keys map public domain → local unix user:
//   presse@plane-liberty.com     → presse-planeliberty
//   presse@providers-expat.com   → presse-providersexpat
//   presse@emilia-mullerd.com    → presse-emiliamullerd
//   presse@planevilain.com       → presse-planevilain
//   presse@hub-travelers.com     → presse-hubtravelers
//   replies@life-expat.com       → replies
// ---------------------------------------------------------------------------

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { simpleParser, type ParsedMail } from "mailparser";
import { createChildLogger } from "../../utils/logger.js";

const log = createChildLogger("maildir-reader");

const MAIL_ROOT = process.env.MAIL_ROOT ?? "/var/mail";

export interface Mailbox {
  /** Public address shown to users, e.g. "presse@plane-liberty.com". */
  address: string;
  /** Local unix user hosting the Maildir. */
  localUser: string;
  /** Human label for the UI, e.g. "Plane Liberty". */
  label: string;
}

// Public address → local unix user mapping. Kept in one place so the UI and
// the reader agree. The mapping matches /etc/postfix/virtual on the VPS.
export const MAILBOXES: Mailbox[] = [
  { address: "replies@life-expat.com",     localUser: "replies",               label: "Replies (global)" },
  { address: "presse@plane-liberty.com",    localUser: "presse-planeliberty",    label: "Plane Liberty" },
  { address: "presse@providers-expat.com",  localUser: "presse-providersexpat",  label: "Providers Expat" },
  { address: "presse@emilia-mullerd.com",   localUser: "presse-emiliamullerd",   label: "Emilia Mullerd" },
  { address: "presse@planevilain.com",      localUser: "presse-planevilain",     label: "Plane Vilain" },
  { address: "presse@hub-travelers.com",    localUser: "presse-hubtravelers",    label: "Hub Travelers" },
];

export interface MessageSummary {
  id: string;                // Maildir filename (serves as stable UID)
  folder: "new" | "cur";
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  date: string;              // ISO
  preview: string;           // first ~200 chars of text
  isRead: boolean;           // true if file in cur/ (S flag set by Dovecot)
  hasAttachments: boolean;
  sizeBytes: number;
}

export interface MessageDetail extends MessageSummary {
  bodyText: string;
  bodyHtml: string | null;
  headers: Record<string, string>;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
}

function resolveMailbox(address: string): Mailbox {
  const mb = MAILBOXES.find((m) => m.address === address);
  if (!mb) throw new Error(`Unknown mailbox: ${address}`);
  return mb;
}

function maildirPath(mb: Mailbox): string {
  return join(MAIL_ROOT, mb.localUser, "Maildir");
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * List the most recent N messages across new/ + cur/, newest first.
 * Parses headers only (Maildir files with low overhead).
 */
export async function listMessages(address: string, limit = 50): Promise<MessageSummary[]> {
  const mb = resolveMailbox(address);
  const base = maildirPath(mb);

  const [newFiles, curFiles] = await Promise.all([
    safeReaddir(join(base, "new")),
    safeReaddir(join(base, "cur")),
  ]);

  const entries = [
    ...newFiles.map((f) => ({ folder: "new" as const, name: f })),
    ...curFiles.map((f) => ({ folder: "cur" as const, name: f })),
  ];

  // Stat each to get mtime; sort newest first; take top N.
  const stats = await Promise.all(
    entries.map(async (e) => {
      const fullPath = join(base, e.folder, e.name);
      try {
        const st = await fs.stat(fullPath);
        return { ...e, fullPath, mtime: st.mtimeMs, size: st.size };
      } catch {
        return null;
      }
    }),
  );

  const valid = stats.filter((s): s is NonNullable<typeof s> => !!s);
  valid.sort((a, b) => b.mtime - a.mtime);

  const pick = valid.slice(0, limit);

  const parsed = await Promise.all(
    pick.map(async (e) => {
      try {
        const buf = await fs.readFile(e.fullPath);
        const mail = await simpleParser(buf);
        return mapSummary(mail, e);
      } catch (err) {
        log.warn({ err, file: e.name }, "Failed to parse message");
        return null;
      }
    }),
  );

  return parsed.filter((p): p is MessageSummary => !!p);
}

export async function getMessage(address: string, id: string): Promise<MessageDetail | null> {
  const mb = resolveMailbox(address);
  const base = maildirPath(mb);

  // id could be in new/ or cur/ — try both
  for (const folder of ["new", "cur"] as const) {
    const fullPath = join(base, folder, id);
    try {
      const buf = await fs.readFile(fullPath);
      const mail = await simpleParser(buf);
      const st = await fs.stat(fullPath);
      return mapDetail(mail, { folder, name: id, fullPath, mtime: st.mtimeMs, size: st.size });
    } catch {
      /* try next */
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal mappers
// ---------------------------------------------------------------------------

interface Entry {
  folder: "new" | "cur";
  name: string;
  fullPath: string;
  mtime: number;
  size: number;
}

function addressText(addr: ParsedMail["from"] | undefined): { text: string; name: string | null } {
  if (!addr) return { text: "", name: null };
  const text = addr.text ?? "";
  const first = addr.value?.[0];
  return { text, name: first?.name || null };
}

function addressListText(addr: ParsedMail["to"] | undefined): string {
  if (!addr) return "";
  if (Array.isArray(addr)) return addr.map((a) => a.text).join(", ");
  return addr.text ?? "";
}

function mapSummary(mail: ParsedMail, e: Entry): MessageSummary {
  const { text: fromText, name: fromName } = addressText(mail.from);
  const text = mail.text ?? "";
  return {
    id: e.name,
    folder: e.folder,
    from: fromText,
    fromName,
    to: addressListText(mail.to),
    subject: mail.subject ?? "(no subject)",
    date: (mail.date ?? new Date(e.mtime)).toISOString(),
    preview: text.slice(0, 200).replace(/\s+/g, " ").trim(),
    // Dovecot marks read messages by adding `,S` to the filename in cur/.
    // Simple heuristic: in cur AND filename contains "S" in the info flags.
    isRead: e.folder === "cur" && /,S/.test(e.name),
    hasAttachments: (mail.attachments?.length ?? 0) > 0,
    sizeBytes: e.size,
  };
}

function mapDetail(mail: ParsedMail, e: Entry): MessageDetail {
  const summary = mapSummary(mail, e);
  const headers: Record<string, string> = {};
  mail.headers.forEach((value, key) => {
    headers[key] = typeof value === "string" ? value : JSON.stringify(value);
  });
  return {
    ...summary,
    bodyText: mail.text ?? "",
    bodyHtml: mail.html || null,
    headers,
    messageId: mail.messageId ?? null,
    inReplyTo: (mail.inReplyTo as string | undefined) ?? null,
    references: Array.isArray(mail.references) ? mail.references.join(" ") : (mail.references ?? null),
  };
}
