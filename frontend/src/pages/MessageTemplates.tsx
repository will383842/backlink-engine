import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Prospect } from "@/types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface MessageTemplate {
  id: number;
  language: string;
  category: string | null;
  sourceContactType: string | null;
  translatedFromId: number | null;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ContactTypeMapping {
  id: number;
  typeKey: string;
  category: string;
  label: string | null;
  isSystem: boolean;
}

type TemplateScope = "category" | "sourceContactType";

const LANGUAGES = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
  { code: "de", label: "🇩🇪 Deutsch" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ru", label: "🇷🇺 Русский" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "zh", label: "🇨🇳 中文" },
  { code: "hi", label: "🇮🇳 हिन्दी" },
];

const CATEGORIES = [
  { value: null, label: "📝 Général (défaut)" },
  { value: "blogger", label: "📰 Blogueur" },
  { value: "media", label: "📺 Média" },
  { value: "influencer", label: "✨ Influenceur" },
  { value: "association", label: "🤝 Association" },
  { value: "partner", label: "💼 Partenaire" },
  { value: "agency", label: "🏢 Agence" },
  { value: "corporate", label: "🏛️ Corporate" },
];

const VARIABLES = [
  { name: "{siteName}", desc: "Nom du site (extrait du domaine)" },
  { name: "{yourName}", desc: "Votre nom" },
  { name: "{yourCompany}", desc: "Votre entreprise" },
  { name: "{yourWebsite}", desc: "Votre site web" },
];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function MessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<TemplateScope>("sourceContactType");
  const [selectedLang, setSelectedLang] = useState("fr");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoFillProspectId, setAutoFillProspectId] = useState<number | null>(null);
  const [translating, setTranslating] = useState(false);

  // Load contact-type mappings so we can populate the type selector
  const { data: mappingsData } = useQuery({
    queryKey: ["contactTypeMappings"],
    queryFn: async () => {
      const res = await api.get("/contact-type-mappings");
      return res.data;
    },
  });
  const contactTypes = (mappingsData?.data ?? []) as ContactTypeMapping[];

  // Fetch prospects for auto-fill dropdown
  const { data: prospectsData } = useQuery({
    queryKey: ["prospects-for-template"],
    queryFn: async () => {
      const res = await api.get("/prospects?limit=100");
      return res.data;
    },
  });

  const prospects = (prospectsData?.data ?? []) as Prospect[];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get("/message-templates");
      setTemplates(response.data.data);
    } catch (err: any) {
      toast.error("Erreur lors du chargement des templates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (
    lang: string,
    category: string | null,
    sct: string | null,
  ) => {
    // Prefer type-keyed template when scope is sourceContactType
    const template = templates.find((t) =>
      scope === "sourceContactType"
        ? t.language === lang && t.sourceContactType === sct
        : t.language === lang && t.category === category && !t.sourceContactType,
    );

    if (template) {
      setEditingTemplate(template);
      setSubject(template.subject);
      setBody(template.body);
    } else {
      // Create new template
      setEditingTemplate(null);
      setSubject("");
      setBody("");
    }
  };

  useEffect(() => {
    loadTemplate(selectedLang, selectedCategory, selectedType);
  }, [selectedLang, selectedCategory, selectedType, scope, templates]);

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Le sujet et le corps du message sont requis");
      return;
    }

    try {
      setSaving(true);

      const params = new URLSearchParams();
      if (scope === "sourceContactType" && selectedType) {
        params.set("sourceContactType", selectedType);
      } else if (scope === "category" && selectedCategory) {
        params.set("category", selectedCategory);
      }
      const qs = params.toString() ? `?${params.toString()}` : "";

      await api.put(`/message-templates/${selectedLang}${qs}`, {
        subject,
        body,
        category: scope === "category" ? selectedCategory : null,
        sourceContactType: scope === "sourceContactType" ? selectedType : null,
        isDefault: scope === "category" && selectedCategory === null,
      });

      toast.success("✅ Template sauvegardé avec succès !");
      loadTemplates();
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTranslate = async () => {
    if (!editingTemplate) {
      toast.error("Sauvegardez d'abord le template avant de traduire");
      return;
    }
    if (selectedLang !== "fr") {
      toast.error("Rédigez d'abord la version FR puis cliquez Traduire depuis la vue FR");
      return;
    }

    try {
      setTranslating(true);
      const res = await api.post(`/message-templates/${editingTemplate.id}/translate`);
      const results = res.data?.results ?? [];
      const ok = results.filter((r: any) => r.ok).length;
      const ko = results.filter((r: any) => !r.ok).length;
      if (ko === 0) {
        toast.success(`✨ Traduit dans ${ok} langues avec succès`);
      } else {
        toast(`Traduit: ${ok} OK, ${ko} échec`, { icon: "⚠️" });
      }
      loadTemplates();
    } catch (err: any) {
      toast.error("Erreur lors de la traduction");
      console.error(err);
    } finally {
      setTranslating(false);
    }
  };

  const insertVariable = (variable: string) => {
    setBody(body + variable);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("📋 Message copié dans le presse-papier !");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erreur lors de la copie");
      console.error(err);
    }
  };

  const handleAutoFill = async (prospectId: number) => {
    const prospect = prospects.find((p) => p.id === prospectId);
    if (!prospect) return;

    try {
      // Call the intelligent template selector endpoint
      const res = await api.post("/message-templates/select", {
        language: prospect.language || "en",
        prospectCategory: prospect.category,
        prospectTags: prospect.tags?.map((t) => t.tagId) || [],
      });

      const template = res.data.template;
      if (template) {
        setSelectedLang(template.language);
        setSelectedCategory(template.category);
        setSubject(template.subject);
        setBody(template.body);
        toast.success(`✅ Template auto-sélectionné pour ${prospect.domain} !`);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error(`❌ Aucun template trouvé pour ce prospect (langue: ${prospect.language || "en"})`);
      } else {
        toast.error("Erreur lors de la sélection automatique");
        console.error(err);
      }
    }
  };

  const renderPreview = () => {
    let previewSubject = subject;
    let previewBody = body;

    // Replace variables for preview
    previewSubject = previewSubject
      .replace("{siteName}", "MonBlog")
      .replace("{yourName}", "Jean Dupont")
      .replace("{yourCompany}", "SOS Expat")
      .replace("{yourWebsite}", "https://sos-expat.com");

    previewBody = previewBody
      .replace(/{siteName}/g, "MonBlog")
      .replace(/{yourName}/g, "Jean Dupont")
      .replace(/{yourCompany}/g, "SOS Expat")
      .replace(/{yourWebsite}/g, "https://sos-expat.com");

    return { previewSubject, previewBody };
  };

  const { previewSubject, previewBody } = renderPreview();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📧 Templates de messages
        </h1>
        <p className="text-gray-600">
          Gérez vos templates de messages pour les formulaires de contact
          (personnalisés par langue et catégorie)
        </p>
      </div>

      {/* Scope switch */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Clé du template :</span>
        <button
          onClick={() => setScope("sourceContactType")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            scope === "sourceContactType"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Par type de contact (recommandé)
        </button>
        <button
          onClick={() => setScope("category")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            scope === "category"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Par catégorie (legacy)
        </button>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Language selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🌍 Langue
            </label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {scope === "sourceContactType" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Type de contact
              </label>
              <select
                value={selectedType || ""}
                onChange={(e) => setSelectedType(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">— Sélectionner un type —</option>
                {contactTypes
                  .slice()
                  .sort((a, b) => (a.label ?? a.typeKey).localeCompare(b.label ?? b.typeKey))
                  .map((t) => (
                    <option key={t.id} value={t.typeKey}>
                      {t.label ?? t.typeKey} ({t.typeKey})
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏷️ Catégorie
              </label>
              <select
                value={selectedCategory || ""}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value || "general"} value={cat.value || ""}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Translate button — only for FR master templates */}
        {scope === "sourceContactType" && selectedLang === "fr" && selectedType && editingTemplate && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {translating ? "Traduction en cours…" : "🌐 Traduire FR → 8 langues"}
            </button>
            <p className="text-xs text-gray-500">
              Utilise Claude Sonnet, qualité native, préserve les placeholders. Écrase uniquement les langues cibles pour ce type.
            </p>
          </div>
        )}

        {/* Template exists indicator */}
        <div className="mt-4">
          {editingTemplate ? (
            <div className="flex items-center text-green-600">
              <span className="mr-2">✅</span>
              <span className="text-sm">
                Template existant (modifié le{" "}
                {new Date(editingTemplate.updatedAt).toLocaleDateString("fr-FR")})
              </span>
            </div>
          ) : (
            <div className="flex items-center text-blue-600">
              <span className="mr-2">➕</span>
              <span className="text-sm">Nouveau template (sera créé à la sauvegarde)</span>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subject */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📨 Sujet
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: 💰 Programme partenaire SOS Expat..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={200}
            />
            <p className="mt-2 text-xs text-gray-500">
              {subject.length} / 200 caractères
            </p>
          </div>

          {/* Body */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 Corps du message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bonjour,&#10;&#10;Je suis {yourName} de {yourCompany}...&#10;&#10;💰 Programme d'affiliation :&#10;✅ 30% de commission récurrente...&#10;&#10;Cordialement,&#10;{yourName}"
              rows={20}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              maxLength={5000}
            />
            <p className="mt-2 text-xs text-gray-500">
              {body.length} / 5000 caractères
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !subject.trim() || !body.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "💾 Sauvegarde..." : "💾 Sauvegarder"}
            </button>
          </div>
        </div>

        {/* Right: Variables + Preview */}
        <div className="space-y-4">
          {/* Variables */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              🏷️ Variables disponibles
            </h3>
            <div className="space-y-2">
              {VARIABLES.map((v) => (
                <button
                  key={v.name}
                  onClick={() => insertVariable(v.name)}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm transition-colors group"
                >
                  <code className="text-blue-600 font-mono group-hover:text-blue-700">
                    {v.name}
                  </code>
                  <p className="text-xs text-gray-500 mt-1">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                👁️ Aperçu
              </h3>
              <button
                onClick={() => copyToClipboard(`${previewSubject}\n\n${previewBody}`)}
                disabled={!subject.trim() || !body.trim()}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {copied ? "✅ Copié !" : "📋 Copier"}
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {/* Preview Subject */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Sujet :</p>
                <p className="font-semibold text-gray-900">
                  {previewSubject || "(Sujet vide)"}
                </p>
              </div>

              {/* Preview Body */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Corps :</p>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {previewBody || "(Corps vide)"}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 italic">
              💡 Astuce : Copiez ce message et collez-le directement dans le formulaire de contact du prospect
            </p>
          </div>
        </div>
      </div>

      {/* Auto-fill from prospect */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🤖 Auto-remplissage intelligent
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Sélectionnez un prospect pour charger automatiquement le template le plus pertinent
          selon sa langue, sa catégorie et ses tags.
        </p>
        <div className="flex gap-3">
          <select
            value={autoFillProspectId || ""}
            onChange={(e) => setAutoFillProspectId(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Sélectionnez un prospect...</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.domain} ({p.language || "en"} - {p.category || "général"})
              </option>
            ))}
          </select>
          <button
            onClick={() => autoFillProspectId && handleAutoFill(autoFillProspectId)}
            disabled={!autoFillProspectId}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🚀 Auto-remplir
          </button>
        </div>
      </div>

      {/* Templates overview table */}
      <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Matrice des templates
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Vue d'ensemble de tous les templates disponibles. Cliquez sur une case pour éditer le template correspondant.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 px-4 py-2 bg-gray-50 text-left text-sm font-medium text-gray-700">
                  Langue
                </th>
                {CATEGORIES.map((cat) => (
                  <th
                    key={cat.value || "general"}
                    className="border border-gray-300 px-4 py-2 bg-gray-50 text-center text-sm font-medium text-gray-700"
                  >
                    {cat.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LANGUAGES.map((lang) => (
                <tr key={lang.code}>
                  <td className="border border-gray-300 px-4 py-2 font-medium text-gray-900">
                    {lang.label}
                  </td>
                  {CATEGORIES.map((cat) => {
                    const exists = templates.some(
                      (t) => t.language === lang.code && t.category === cat.value
                    );
                    return (
                      <td
                        key={cat.value || "general"}
                        className={`border border-gray-300 px-4 py-2 text-center cursor-pointer transition-colors ${
                          exists
                            ? "bg-green-50 hover:bg-green-100"
                            : "bg-gray-50 hover:bg-blue-50"
                        }`}
                        onClick={() => {
                          setSelectedLang(lang.code);
                          setSelectedCategory(cat.value);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        title={
                          exists
                            ? `Template existant - Cliquez pour éditer`
                            : `Créer un template ${lang.label} ${cat.label}`
                        }
                      >
                        <span className="text-2xl">
                          {exists ? "✅" : "➕"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-gray-500 italic">
          💡 ✅ = Template existant | ➕ = Template manquant (cliquez pour créer)
        </p>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-700 font-medium">Templates totaux</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">
            {templates.length}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium">
            Langues couvertes
          </p>
          <p className="text-3xl font-bold text-green-900 mt-1">
            {new Set(templates.map((t) => t.language)).size} / 9
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-700 font-medium">
            Templates par catégorie
          </p>
          <p className="text-3xl font-bold text-purple-900 mt-1">
            {templates.filter((t) => t.category !== null).length}
          </p>
        </div>
      </div>
    </div>
  );
}
