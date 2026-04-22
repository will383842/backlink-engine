import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import { FileText, Eye, Code, Edit2, Save, X, RotateCcw, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

type TemplateLang = "fr" | "en" | "es" | "de" | "pt" | "ru" | "zh" | "hi" | "ar" | "et";
type Angle = "launch" | "ymyl" | "expat" | "estonia" | "human_interest" | "tech_startup" | "innovation" | "diaspora";
type TemplateKind = "initial" | "follow_up_1" | "follow_up_2";

interface Template {
  lang: TemplateLang;
  subject: string;
  text: string;
  html: string;
  pdfUrl: string | null;
}

interface TemplatesResponse {
  angle: Angle;
  template: TemplateKind;
  templates: Template[];
}

interface RawTemplate {
  lang: TemplateLang;
  body: string;
  source: "db" | "embedded";
  embeddedBody: string;
}

interface RawTemplatesResponse {
  templates: RawTemplate[];
}

const LANG_LABELS: Record<TemplateLang, { flag: string; name: string }> = {
  fr: { flag: "🇫🇷", name: "Français" },
  en: { flag: "🇬🇧", name: "English" },
  es: { flag: "🇪🇸", name: "Español" },
  de: { flag: "🇩🇪", name: "Deutsch" },
  pt: { flag: "🇵🇹", name: "Português" },
  ru: { flag: "🇷🇺", name: "Русский" },
  zh: { flag: "🇨🇳", name: "中文" },
  hi: { flag: "🇮🇳", name: "हिन्दी" },
  ar: { flag: "🇸🇦", name: "العربية" },
  et: { flag: "🇪🇪", name: "Eesti" },
};

const ANGLES: Array<{ value: Angle; label: string }> = [
  { value: "launch", label: "Lancement / Launch" },
  { value: "ymyl", label: "Juridique / YMYL" },
  { value: "expat", label: "Expatriation" },
  { value: "estonia", label: "Estonie / Tallinn" },
  { value: "human_interest", label: "Témoignage" },
  { value: "tech_startup", label: "Tech Startup" },
  { value: "innovation", label: "Innovation" },
  { value: "diaspora", label: "Diaspora" },
];

const KINDS: Array<{ value: TemplateKind; label: string }> = [
  { value: "initial", label: "Email initial" },
  { value: "follow_up_1", label: "Relance J+5" },
  { value: "follow_up_2", label: "Relance J+10" },
];

export default function PressTemplates() {
  const qc = useQueryClient();
  const [angle, setAngle] = useState<Angle>("launch");
  const [kind, setKind] = useState<TemplateKind>("initial");
  const [viewMode, setViewMode] = useState<"text" | "html">("text");
  const [expandedLang, setExpandedLang] = useState<TemplateLang | null>(null);
  const [editingLang, setEditingLang] = useState<TemplateLang | null>(null);
  const [draftBody, setDraftBody] = useState<string>("");

  const preview = useQuery<TemplatesResponse>({
    queryKey: ["press-templates", angle, kind],
    queryFn: async () => {
      const res = await api.get("/press/templates", { params: { angle, template: kind } });
      return res.data;
    },
  });

  const raw = useQuery<RawTemplatesResponse>({
    queryKey: ["press-templates-raw"],
    queryFn: async () => (await api.get("/press/templates/raw")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { lang: TemplateLang; body: string }) => {
      const res = await api.patch(`/press/templates/${payload.lang}`, { body: payload.body });
      return res.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Template ${variables.lang.toUpperCase()} enregistré`);
      qc.invalidateQueries({ queryKey: ["press-templates"] });
      qc.invalidateQueries({ queryKey: ["press-templates-raw"] });
      setEditingLang(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Échec sauvegarde";
      toast.error(msg);
    },
  });

  useEffect(() => {
    if (editingLang && raw.data) {
      const tpl = raw.data.templates.find((t) => t.lang === editingLang);
      if (tpl) setDraftBody(tpl.body);
    }
  }, [editingLang, raw.data]);

  function startEdit(lang: TemplateLang) {
    setEditingLang(lang);
    setExpandedLang(lang);
  }

  function cancelEdit() {
    setEditingLang(null);
    setDraftBody("");
  }

  function saveEdit() {
    if (!editingLang) return;
    saveMutation.mutate({ lang: editingLang, body: draftBody });
  }

  function resetToEmbedded(lang: TemplateLang) {
    if (!confirm(`Réinitialiser le template ${lang.toUpperCase()} à sa version par défaut ?`)) return;
    saveMutation.mutate({ lang, body: "" });
  }

  if (preview.isLoading || raw.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" label="Chargement des templates…" />
      </div>
    );
  }

  if (preview.isError || !preview.data || raw.isError || !raw.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Impossible de charger les templates presse.
      </div>
    );
  }

  const rawByLang = Object.fromEntries(raw.data.templates.map((t) => [t.lang, t])) as Record<TemplateLang, RawTemplate>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="text-brand-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Templates Presse</h1>
          <p className="text-sm text-surface-600">
            Édite les 10 templates de pitch directement ici. Modifications stockées en base de données —
            effet immédiat sur les prochains envois.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-surface-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-700">Angle éditorial (preview uniquement)</label>
            <select
              value={angle}
              onChange={(e) => setAngle(e.target.value as Angle)}
              className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm"
            >
              {ANGLES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-700">Type (preview)</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as TemplateKind)}
              className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex gap-1 rounded-lg border border-surface-200 p-1">
            <button
              onClick={() => setViewMode("text")}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === "text" ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100"
              }`}
            >
              <Eye size={14} /> Texte
            </button>
            <button
              onClick={() => setViewMode("html")}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === "html" ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100"
              }`}
            >
              <Code size={14} /> HTML
            </button>
          </div>
        </div>
      </div>

      {/* Templates grid */}
      <div className="space-y-4">
        {preview.data.templates.map((tpl) => {
          const meta = LANG_LABELS[tpl.lang];
          const isExpanded = expandedLang === tpl.lang;
          const isEditing = editingLang === tpl.lang;
          const rawTpl = rawByLang[tpl.lang];
          const isOverridden = rawTpl?.source === "db";

          return (
            <div key={tpl.lang} className="overflow-hidden rounded-xl border border-surface-200 bg-white">
              <div className="flex w-full items-center gap-4 px-5 py-4">
                <button
                  onClick={() => setExpandedLang(isExpanded ? null : tpl.lang)}
                  className="flex flex-1 items-center gap-4 text-left hover:opacity-80"
                >
                  <span className="text-3xl">{meta.flag}</span>
                  <div className="min-w-[120px]">
                    <div className="flex items-center gap-2 font-semibold text-surface-900">
                      {meta.name}
                      {isOverridden && (
                        <span
                          title="Template édité depuis l'UI"
                          className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700"
                        >
                          <CheckCircle2 size={10} />
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-surface-500">{tpl.lang.toUpperCase()}</div>
                  </div>
                  <div className="flex-1 truncate text-sm font-medium text-surface-700">{tpl.subject}</div>
                </button>

                {!isEditing && (
                  <div className="flex items-center gap-2">
                    {isOverridden && (
                      <button
                        onClick={() => resetToEmbedded(tpl.lang)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100"
                        title="Réinitialiser"
                      >
                        <RotateCcw size={12} /> Reset
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(tpl.lang)}
                      className="flex items-center gap-1 rounded-md bg-surface-100 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200"
                    >
                      <Edit2 size={12} /> Éditer
                    </button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-surface-200 bg-surface-50 p-5">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-surface-500">
                        Édition du corps — {meta.name}
                      </div>
                      <textarea
                        value={draftBody}
                        onChange={(e) => setDraftBody(e.target.value)}
                        rows={20}
                        className="w-full rounded-md border border-surface-300 bg-white p-3 font-mono text-sm text-surface-900"
                        dir={tpl.lang === "ar" ? "rtl" : "ltr"}
                      />
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <strong>💡 Placeholders disponibles :</strong>{" "}
                        <code className="rounded bg-amber-100 px-1">[Prénom Journaliste]</code>,{" "}
                        <code className="rounded bg-amber-100 px-1">[sujet récent — …]</code>,{" "}
                        <code className="rounded bg-amber-100 px-1">[date]</code>,{" "}
                        <code className="rounded bg-amber-100 px-1">[fondateur]</code>,{" "}
                        <code className="rounded bg-amber-100 px-1">[Ton nom]</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEdit}
                          disabled={saveMutation.isPending}
                          className="flex items-center gap-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          <Save size={14} />
                          {saveMutation.isPending ? "Sauvegarde…" : "Enregistrer"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 rounded-md border border-surface-300 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100"
                        >
                          <X size={14} /> Annuler
                        </button>
                        <span className="ml-auto text-xs text-surface-500">{draftBody.length} caractères</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-surface-500">Sujet (généré)</div>
                        <div className="mt-1 rounded-md border border-surface-200 bg-white px-3 py-2 text-sm font-medium text-surface-900">
                          {tpl.subject}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
                          Corps — {viewMode === "text" ? "Texte brut" : "Rendu HTML"}
                        </div>
                        {viewMode === "text" ? (
                          <pre
                            className="whitespace-pre-wrap rounded-md border border-surface-200 bg-white px-4 py-3 font-sans text-sm text-surface-800"
                            dir={tpl.lang === "ar" ? "rtl" : "ltr"}
                          >
                            {tpl.text}
                          </pre>
                        ) : (
                          <div
                            className="rounded-md border border-surface-200 bg-white px-4 py-3 text-sm text-surface-800"
                            dir={tpl.lang === "ar" ? "rtl" : "ltr"}
                            dangerouslySetInnerHTML={{ __html: tpl.html }}
                          />
                        )}
                      </div>

                      {tpl.pdfUrl && (
                        <div className="mt-3 text-xs text-surface-600">
                          📎 Pièce jointe :{" "}
                          <a href={tpl.pdfUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                            {tpl.pdfUrl}
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>ℹ️ Système à 3 couches :</strong> templates embarqués dans le code (défaut), surchargés
        par un fichier markdown sur disque (optionnel), eux-mêmes surchargés par tes éditions en base
        de données (ce que tu fais ici). Tu peux revenir au template par défaut à tout moment via le
        bouton "Reset".
      </div>
    </div>
  );
}
