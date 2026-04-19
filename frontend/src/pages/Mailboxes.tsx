// ---------------------------------------------------------------------------
// Mailboxes — unified inbox + compose/reply across the 5 sending mailboxes
// ---------------------------------------------------------------------------

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Send,
  RefreshCw,
  Paperclip,
  X,
  ArrowLeft,
  Reply,
  PenSquare,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

interface MailboxInfo {
  address: string;
  localUser: string;
  label: string;
  canSend: boolean;
}

interface MessageSummary {
  id: string;
  folder: "new" | "cur";
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  date: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
  sizeBytes: number;
}

interface MessageDetail extends MessageSummary {
  bodyText: string;
  bodyHtml: string | null;
  headers: Record<string, string>;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isSameDay = d.toDateString() === now.toDateString();
  if (isSameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isSameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    ...(isSameYear ? {} : { year: "numeric" }),
  });
}

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match?.[1] ?? raw.trim();
}

// ---------------------------------------------------------------------------
// Compose modal
// ---------------------------------------------------------------------------

function ComposeModal({
  mailbox,
  defaults,
  onClose,
  onSent,
}: {
  mailbox: MailboxInfo;
  defaults?: { to?: string; subject?: string; body?: string; inReplyTo?: string; references?: string };
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(defaults?.to ?? "");
  const [subject, setSubject] = useState(defaults?.subject ?? "");
  const [body, setBody] = useState(defaults?.body ?? "");

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/mailboxes/${encodeURIComponent(mailbox.address)}/send`, {
        to,
        subject,
        body,
        inReplyTo: defaults?.inReplyTo,
        references: defaults?.references,
      });
    },
    onSuccess: () => {
      toast.success(`Email envoyé depuis ${mailbox.address}`);
      onSent();
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      toast.error(e.response?.data?.message ?? e.response?.data?.error ?? "Erreur SMTP");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-surface-900">
            {defaults?.inReplyTo ? "Répondre" : "Nouvel email"} — depuis {mailbox.address}
          </h3>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-700">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-surface-700">À</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="destinataire@example.com"
            className="input-field"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-surface-700">Sujet</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Sujet de l'email"
            className="input-field"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-surface-700">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="input-field font-mono text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-surface-300 px-3 py-1.5 text-sm hover:bg-surface-50">
            Annuler
          </button>
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !to.trim() || !subject.trim() || !body.trim()}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Send size={14} />
            {sendMutation.isPending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message viewer panel (right)
// ---------------------------------------------------------------------------

function MessageViewer({
  mailbox,
  messageId,
  onBack,
  onReply,
}: {
  mailbox: MailboxInfo;
  messageId: string;
  onBack: () => void;
  onReply: (defaults: { to: string; subject: string; body: string; inReplyTo?: string; references?: string }) => void;
}) {
  const { data, isLoading } = useQuery<{ data: MessageDetail }>({
    queryKey: ["mailbox-message", mailbox.address, messageId],
    queryFn: async () =>
      (await api.get(`/mailboxes/${encodeURIComponent(mailbox.address)}/messages/${encodeURIComponent(messageId)}`)).data,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
        Chargement…
      </div>
    );
  }

  const msg = data?.data;
  if (!msg) {
    return <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">Message introuvable</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-surface-200 p-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-surface-600 hover:text-surface-900 sm:hidden">
          <ArrowLeft size={14} /> Retour
        </button>
        <button
          onClick={() => {
            const quoted = msg.bodyText
              .split("\n")
              .map((l) => "> " + l)
              .join("\n");
            onReply({
              to: extractEmail(msg.from),
              subject: msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`,
              body: `\n\nLe ${new Date(msg.date).toLocaleString()}, ${msg.from} a écrit :\n${quoted}\n`,
              inReplyTo: msg.messageId ?? undefined,
              references: msg.references ?? msg.messageId ?? undefined,
            });
          }}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          <Reply size={14} /> Répondre
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <h2 className="text-lg font-semibold text-surface-900">{msg.subject}</h2>
        <div className="text-xs text-surface-500 space-y-0.5">
          <div><strong>De :</strong> {msg.from}</div>
          <div><strong>À :</strong> {msg.to}</div>
          <div><strong>Date :</strong> {new Date(msg.date).toLocaleString()}</div>
          {msg.hasAttachments && (
            <div className="flex items-center gap-1 text-amber-600"><Paperclip size={12} /> Pièces jointes présentes</div>
          )}
        </div>

        <div className="border-t border-surface-200 pt-3">
          {msg.bodyHtml ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-surface-800">{msg.bodyText}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Mailboxes() {
  const queryClient = useQueryClient();
  const [activeMailbox, setActiveMailbox] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{ to?: string; subject?: string; body?: string; inReplyTo?: string; references?: string } | undefined>(undefined);

  const mailboxesQuery = useQuery<{ data: MailboxInfo[] }>({
    queryKey: ["mailboxes"],
    queryFn: async () => (await api.get("/mailboxes")).data,
  });

  const mailboxes = mailboxesQuery.data?.data ?? [];
  const current = useMemo(
    () => mailboxes.find((m) => m.address === activeMailbox) ?? mailboxes[0],
    [mailboxes, activeMailbox],
  );

  const messagesQuery = useQuery<{ data: MessageSummary[] }>({
    queryKey: ["mailbox-messages", current?.address],
    queryFn: async () =>
      (await api.get(`/mailboxes/${encodeURIComponent(current!.address)}/messages?limit=100`)).data,
    enabled: !!current,
    refetchInterval: 60_000,
  });

  const messages = messagesQuery.data?.data ?? [];
  const unreadCount = messages.filter((m) => !m.isRead).length;

  const openCompose = (defaults?: typeof composeDefaults) => {
    setComposeDefaults(defaults);
    setComposeOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm">
      {/* Left panel: list of mailboxes */}
      <aside className="w-56 shrink-0 border-r border-surface-200 bg-surface-50 overflow-y-auto">
        <div className="p-3 border-b border-surface-200">
          <button
            onClick={() => current && openCompose(undefined)}
            disabled={!current?.canSend}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <PenSquare size={14} /> Nouvel email
          </button>
        </div>
        <ul className="py-2">
          {mailboxes.map((mb) => {
            const active = mb.address === current?.address;
            return (
              <li key={mb.address}>
                <button
                  onClick={() => {
                    setActiveMailbox(mb.address);
                    setSelectedId(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition ${
                    active ? "bg-white border-l-4 border-brand-600 font-medium text-surface-900" : "hover:bg-surface-100 text-surface-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate">{mb.label}</span>
                  </div>
                  <div className="text-xs text-surface-400 truncate mt-0.5">{mb.address}</div>
                  {!mb.canSend && (
                    <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <AlertCircle size={10} /> Sans domaine actif
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Middle + right: message list + viewer */}
      {current ? (
        <>
          <section className={`${selectedId ? "hidden sm:flex" : "flex"} w-full sm:w-96 flex-col border-r border-surface-200`}>
            <header className="flex items-center justify-between p-3 border-b border-surface-200 bg-white">
              <div>
                <h2 className="text-sm font-semibold text-surface-900">{current.label}</h2>
                <p className="text-xs text-surface-500">
                  {messages.length} messages · {unreadCount} non lus
                </p>
              </div>
              <button
                onClick={() => messagesQuery.refetch()}
                disabled={messagesQuery.isFetching}
                className="text-surface-500 hover:text-surface-900 disabled:opacity-50"
                title="Rafraîchir"
              >
                <RefreshCw size={16} className={messagesQuery.isFetching ? "animate-spin" : ""} />
              </button>
            </header>

            <ul className="flex-1 overflow-y-auto">
              {messagesQuery.isLoading && (
                <li className="p-4 text-sm text-surface-400 text-center">Chargement…</li>
              )}
              {!messagesQuery.isLoading && messages.length === 0 && (
                <li className="p-4 text-sm text-surface-400 text-center">Boîte vide</li>
              )}
              {messages.map((m) => {
                const active = m.id === selectedId;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left p-3 border-b border-surface-100 text-xs transition ${
                        active ? "bg-brand-50" : "hover:bg-surface-50"
                      } ${!m.isRead ? "font-semibold" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-surface-900">{m.fromName ?? extractEmail(m.from)}</span>
                        <span className="shrink-0 text-[10px] text-surface-400">{formatDate(m.date)}</span>
                      </div>
                      <div className="truncate text-surface-800 mt-0.5">{m.subject}</div>
                      <div className="truncate text-[11px] text-surface-500 mt-0.5 font-normal">{m.preview}</div>
                      {m.hasAttachments && <Paperclip size={10} className="inline text-surface-400" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={`${selectedId ? "flex" : "hidden sm:flex"} flex-1 flex-col`}>
            {selectedId ? (
              <MessageViewer
                mailbox={current}
                messageId={selectedId}
                onBack={() => setSelectedId(null)}
                onReply={(d) => openCompose(d)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
                Sélectionne un message pour le lire
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-surface-400 text-sm">
          {mailboxesQuery.isLoading ? "Chargement des boîtes…" : "Aucune boîte configurée"}
        </div>
      )}

      {composeOpen && current && (
        <ComposeModal
          mailbox={current}
          defaults={composeDefaults}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ["mailbox-messages", current.address] });
          }}
        />
      )}
    </div>
  );
}
