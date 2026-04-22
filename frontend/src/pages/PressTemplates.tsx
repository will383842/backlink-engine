import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import Spinner from "@/components/ui/Spinner";
import { FileText, Eye, Code } from "lucide-react";

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
  const [angle, setAngle] = useState<Angle>("launch");
  const [kind, setKind] = useState<TemplateKind>("initial");
  const [viewMode, setViewMode] = useState<"text" | "html">("text");
  const [expandedLang, setExpandedLang] = useState<TemplateLang | null>(null);

  const { data, isLoading, isError } = useQuery<TemplatesResponse>({
    queryKey: ["press-templates", angle, kind],
    queryFn: async () => {
      const res = await api.get("/press/templates", {
        params: { angle, template: kind },
      });
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" label="Chargement des templates…" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Impossible de charger les templates presse.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="text-brand-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Templates Presse</h1>
          <p className="text-sm text-surface-600">
            Prévisualisation des 9 templates de pitch envoyés aux journalistes, personnalisés avec des données d'exemple.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-surface-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-700">Angle éditorial</label>
            <select
              value={angle}
              onChange={(e) => setAngle(e.target.value as Angle)}
              className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm"
            >
              {ANGLES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-700">Type</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as TemplateKind)}
              className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
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
        {data.templates.map((tpl) => {
          const meta = LANG_LABELS[tpl.lang];
          const isExpanded = expandedLang === tpl.lang;
          return (
            <div
              key={tpl.lang}
              className="overflow-hidden rounded-xl border border-surface-200 bg-white"
            >
              <button
                onClick={() => setExpandedLang(isExpanded ? null : tpl.lang)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-surface-50"
              >
                <span className="text-3xl">{meta.flag}</span>
                <div className="flex-1">
                  <div className="font-semibold text-surface-900">{meta.name}</div>
                  <div className="text-xs text-surface-500">{tpl.lang.toUpperCase()}</div>
                </div>
                <div className="flex-1 truncate text-sm font-medium text-surface-700">{tpl.subject}</div>
                <span className="text-xs text-surface-400">{isExpanded ? "Fermer" : "Ouvrir"}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-surface-200 bg-surface-50 p-5">
                  <div className="mb-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-surface-500">Sujet</div>
                    <div className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-surface-900 border border-surface-200">
                      {tpl.subject}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
                      Corps — {viewMode === "text" ? "Texte brut" : "Rendu HTML"}
                    </div>
                    {viewMode === "text" ? (
                      <pre className="whitespace-pre-wrap rounded-md bg-white px-4 py-3 text-sm text-surface-800 border border-surface-200 font-sans">
                        {tpl.text}
                      </pre>
                    ) : (
                      <div
                        className="rounded-md bg-white px-4 py-3 text-sm text-surface-800 border border-surface-200"
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
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>ℹ️ Personnalisation runtime :</strong> Les placeholders{" "}
        <code className="rounded bg-amber-100 px-1">[Prénom Journaliste]</code> et{" "}
        <code className="rounded bg-amber-100 px-1">[Nom du média]</code> visibles ici sont remplacés
        au moment de l'envoi par les vraies valeurs du contact presse cible.
      </div>
    </div>
  );
}
