import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  ShieldAlert,
  Globe,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormProspect {
  id: number;
  domain: string;
  category: string;
  language: string | null;
  country: string | null;
  contactFormUrl: string;
  contactFormFields: Record<string, boolean> | null;
  hasCaptcha: boolean | null;
  score: number;
  tier: number;
  status: string;
  contacts: { email: string; firstName: string | null; lastName: string | null; name: string | null }[];
}

interface GeneratedMessage {
  subject: string;
  body: string;
  language: string;
  contactFormUrl: string;
  hasCaptcha: boolean | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  blogger: "Blogueur",
  influencer: "Influenceur",
  media: "Presse",
  partner: "Partenaire",
  other: "Autre",
};

const CATEGORY_COLORS: Record<string, string> = {
  blogger: "bg-indigo-100 text-indigo-700",
  influencer: "bg-pink-100 text-pink-700",
  media: "bg-cyan-100 text-cyan-700",
  partner: "bg-teal-100 text-teal-700",
  other: "bg-surface-100 text-surface-600",
};

function getCountryFlag(code: string): string {
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch { return code; }
}

// ---------------------------------------------------------------------------
// Prospect Card
// ---------------------------------------------------------------------------

function ProspectCard({
  prospect,
  onDone,
}: {
  prospect: FormProspect;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [generated, setGenerated] = useState<GeneratedMessage | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);
  const [editing, setEditing] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/prospects/${prospect.id}/generate-form-message`);
      return res.data?.data as GeneratedMessage;
    },
    onSuccess: (data) => {
      setGenerated(data);
      setEditedSubject(data.subject);
      setEditedBody(data.body);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? "Erreur lors de la generation";
      if (err.response?.data?.error === "already_contacted") {
        toast.error("Ce prospect a deja ete contacte !");
      } else {
        toast.error(msg);
      }
    },
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/prospects/${prospect.id}/manual-contact`);
    },
    onSuccess: () => {
      toast.success(`${prospect.domain} remis en non contacte`);
      queryClient.invalidateQueries({ queryKey: ["formQueue"] });
    },
    onError: () => toast.error("Impossible d'annuler"),
  });

  const openAndSendMutation = useMutation({
    mutationFn: async () => {
      // Optimistically log the manual contact. The external form is opened
      // in a new tab synchronously so the browser doesn't block the popup.
      window.open(prospect.contactFormUrl, "_blank");
      await api.post(`/prospects/${prospect.id}/log-manual-contact`, {
        message: editedBody || generated?.body || "(message non enregistre)",
        method: "contact_form",
        nextFollowupDays: 7,
      });
    },
    onSuccess: () => {
      toast(
        (t) => (
          <span className="flex items-center gap-3">
            <span>
              <strong>{prospect.domain}</strong> marque comme contacte
            </span>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                undoMutation.mutate();
              }}
              className="rounded bg-white px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
            >
              Annuler
            </button>
          </span>
        ),
        { icon: "✓", duration: 8000 },
      );
      queryClient.invalidateQueries({ queryKey: ["formQueue"] });
      onDone();
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const copyToClipboard = async (text: string, type: "subject" | "body") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(type === "subject" ? "Sujet copie" : "Message copie");
    setTimeout(() => setCopied(null), 2000);
  };

  const fieldList = prospect.contactFormFields
    ? Object.entries(prospect.contactFormFields).filter(([, v]) => v).map(([k]) => k)
    : [];

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold text-surface-900">{prospect.domain}</span>
        <span className={`badge text-xs ${CATEGORY_COLORS[prospect.category] ?? "bg-surface-100 text-surface-600"}`}>
          {CATEGORY_LABELS[prospect.category] ?? prospect.category}
        </span>
        {prospect.country && <span className="text-sm">{getCountryFlag(prospect.country)}</span>}
        {prospect.language && <span className="text-xs text-surface-400 uppercase">{prospect.language}</span>}
        {prospect.hasCaptcha && (
          <span className="badge bg-orange-100 text-orange-700 text-xs flex items-center gap-1">
            <ShieldAlert size={12} /> CAPTCHA
          </span>
        )}
        <div className="flex-1" />
        <span className="text-xs text-surface-400">Score: {prospect.score} | T{prospect.tier}</span>
      </div>

      {/* Form URL + fields */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-surface-600">
        <a
          href={prospect.contactFormUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-brand-600 hover:underline"
        >
          <Globe size={14} /> {prospect.contactFormUrl.replace(/^https?:\/\//, "").slice(0, 60)}
        </a>
        {fieldList.length > 0 && (
          <span className="text-xs text-surface-400">
            Champs : {fieldList.join(", ")}
          </span>
        )}
      </div>

      {/* Contact info */}
      {prospect.contacts[0]?.email && (
        <p className="text-xs text-surface-500">
          Contact : {prospect.contacts[0].firstName ?? prospect.contacts[0].name ?? ""} — {prospect.contacts[0].email}
        </p>
      )}

      {/* Step 1: Generate message */}
      {!generated && (
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {generateMutation.isPending ? (
            <><Loader2 size={16} className="animate-spin" /> Generation en cours...</>
          ) : (
            <><FileText size={16} /> Generer le message</>
          )}
        </button>
      )}

      {/* Step 2: Preview + copy + open form */}
      {generated && (
        <div className="space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4">
          {/* Subject */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-surface-400">Sujet</label>
              <button
                onClick={() => copyToClipboard(editing ? editedSubject : generated.subject, "subject")}
                className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                {copied === "subject" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "subject" ? "Copie !" : "Copier"}
              </button>
            </div>
            {editing ? (
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
              />
            ) : (
              <p className="mt-1 text-sm font-medium text-surface-900">{generated.subject}</p>
            )}
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-surface-400">Message</label>
              <button
                onClick={() => copyToClipboard(editing ? editedBody : generated.body, "body")}
                className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                {copied === "body" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "body" ? "Copie !" : "Copier"}
              </button>
            </div>
            {editing ? (
              <textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={8}
                className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm font-mono"
              />
            ) : (
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-surface-700 border border-surface-100">
                {generated.body}
              </div>
            )}
          </div>

          {/* Edit toggle */}
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-surface-500 hover:text-surface-700"
          >
            {editing ? "Terminer l'edition" : "Modifier le message"}
          </button>

          {/* Action button — single step: opens tab + logs contact atomically.
              An "Annuler" button appears in the success toast for 8 s in case
              the form wasn't actually submitted. */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-surface-200">
            <button
              onClick={() => openAndSendMutation.mutate()}
              disabled={openAndSendMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              <ExternalLink size={16} />
              {openAndSendMutation.isPending ? "En cours..." : "Ouvrir et envoyer"}
            </button>

            <p className="text-xs text-surface-400 flex items-center gap-1">
              <AlertTriangle size={12} /> Le formulaire s'ouvre, le prospect est marque comme contacte. Clique "Annuler" dans la notification si tu n'as finalement pas envoye.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FormOutreach() {
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{
    data: FormProspect[];
    total: number;
    alreadyContactedCount: number;
  }>({
    queryKey: ["formQueue", filterLanguage, filterCategory],
    queryFn: async () => {
      const params: Record<string, string> = { limit: "50" };
      if (filterLanguage) params.language = filterLanguage;
      if (filterCategory) params.category = filterCategory;
      const res = await api.get("/prospects/form-queue", { params });
      return res.data;
    },
  });

  const prospects = (data?.data ?? []).filter((p) => !doneIds.has(p.id));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
          <p className="text-sm text-amber-700">A contacter</p>
          <p className="text-2xl font-bold text-amber-800">{data?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-4">
          <p className="text-sm text-emerald-700">Deja contactes</p>
          <p className="text-2xl font-bold text-emerald-800">{data?.alreadyContactedCount ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-surface-50 border-surface-200 p-4">
          <p className="text-sm text-surface-600">Session en cours</p>
          <p className="text-2xl font-bold text-surface-800">{doneIds.size}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-3">
        <select
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">Toutes les langues</option>
          {["fr", "en", "de", "es", "pt", "nl", "it", "ja", "ar", "ru"].map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">Toutes les categories</option>
          {["blogger", "influencer", "media", "partner", "other"].map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
          ))}
        </select>

        <div className="flex-1" />
        <p className="text-sm text-surface-500">
          {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} a traiter
        </p>
      </div>

      {/* Queue */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-brand-600" />
        </div>
      ) : prospects.length === 0 ? (
        <div className="card text-center text-surface-500 py-12">
          Aucun prospect avec formulaire de contact a traiter.
        </div>
      ) : (
        <div className="space-y-4">
          {prospects.map((p) => (
            <ProspectCard
              key={p.id}
              prospect={p}
              onDone={() => setDoneIds((prev) => new Set(prev).add(p.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
