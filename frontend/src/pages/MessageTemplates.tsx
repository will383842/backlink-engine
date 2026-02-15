import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import api from "@/lib/api";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface MessageTemplate {
  id: number;
  language: string;
  category: string | null;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  const [selectedLang, setSelectedLang] = useState("fr");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/message-templates");
      setTemplates(response.data.data);
    } catch (err: any) {
      toast.error("Erreur lors du chargement des templates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (lang: string, category: string | null) => {
    const template = templates.find(
      (t) => t.language === lang && t.category === category
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
    loadTemplate(selectedLang, selectedCategory);
  }, [selectedLang, selectedCategory, templates]);

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Le sujet et le corps du message sont requis");
      return;
    }

    try {
      setSaving(true);

      const url = selectedCategory
        ? `/api/message-templates/${selectedLang}?category=${selectedCategory}`
        : `/api/message-templates/${selectedLang}`;

      await api.put(url, {
        subject,
        body,
        category: selectedCategory,
        isDefault: selectedCategory === null,
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

  const insertVariable = (variable: string) => {
    setBody(body + variable);
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

          {/* Category selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏷️ Catégorie
            </label>
            <select
              value={selectedCategory || ""}
              onChange={(e) =>
                setSelectedCategory(e.target.value || null)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value || "general"} value={cat.value || ""}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              👁️ Aperçu
            </h3>
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
          </div>
        </div>
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
