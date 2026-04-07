import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, X, Tag as TagIcon, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Tag {
  id: number;
  name: string;
  label: string;
  description?: string;
  color: string;
  category: TagCategory;
  isAutoTag: boolean;
  createdAt: string;
  _count?: {
    prospects: number;
    campaigns: number;
  };
}

type TagCategory = "industry" | "priority" | "status" | "geo" | "quality" | "other";

interface TagForm {
  name: string;
  label: string;
  description: string;
  color: string;
  category: TagCategory;
  isAutoTag: boolean;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const CATEGORIES: { value: TagCategory; label: string }[] = [
  { value: "industry", label: "🏭 Industrie" },
  { value: "priority", label: "⭐ Priorité" },
  { value: "status", label: "📊 Statut" },
  { value: "geo", label: "🌍 Géographie" },
  { value: "quality", label: "💎 Qualité" },
  { value: "other", label: "📝 Autre" },
];

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#6366F1", // indigo
  "#14B8A6", // teal
];

const emptyForm: TagForm = {
  name: "",
  label: "",
  description: "",
  color: "#3B82F6",
  category: "other",
  isAutoTag: false,
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function Tags() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TagForm>(emptyForm);
  const [filterCategory, setFilterCategory] = useState<string>("");

  // Fetch tags
  const { data: tagsData, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await api.get("/tags?includeStats=true");
      return res.data;
    },
  });

  const tags = (tagsData?.tags ?? []) as Tag[];

  // Filter tags
  const filteredTags = filterCategory
    ? tags.filter((t) => t.category === filterCategory)
    : tags;

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return (await api.patch(`/tags/${editingId}`, form)).data;
      }
      return (await api.post("/tags", form)).data;
    },
    onSuccess: () => {
      toast.success(editingId ? "✅ Tag mis à jour !" : "✅ Tag créé !");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      handleClose();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Erreur lors de la sauvegarde";
      toast.error(message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/tags/${id}`);
    },
    onSuccess: () => {
      toast.success("🗑️ Tag supprimé !");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Erreur lors de la suppression";
      toast.error(message);
    },
  });

  function handleEdit(tag: Tag) {
    setEditingId(tag.id);
    setForm({
      name: tag.name,
      label: tag.label,
      description: tag.description || "",
      color: tag.color,
      category: tag.category,
      isAutoTag: tag.isAutoTag,
    });
    setShowForm(true);
  }

  function handleClose() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.label.trim()) {
      toast.error("Le nom et le label sont requis");
      return;
    }

    // Validate name format (lowercase alphanumeric with underscores)
    if (!/^[a-z0-9_]+$/.test(form.name)) {
      toast.error("Le nom doit être en minuscules, chiffres et underscores uniquement");
      return;
    }

    saveMutation.mutate();
  }

  function handleDelete(tag: Tag) {
    const usage = tag._count ? tag._count.prospects + tag._count.campaigns : 0;
    if (usage > 0) {
      toast.error(
        `Ce tag est utilisé par ${tag._count?.prospects} prospects et ${tag._count?.campaigns} campagnes. Retirez-le d'abord.`
      );
      return;
    }

    if (confirm(`Supprimer le tag "${tag.label}" ?`)) {
      deleteMutation.mutate(tag.id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            🏷️ Gestion des Tags
          </h3>
          <p className="text-sm text-surface-600 mt-1">
            Créez des tags pour classer vos prospects et campagnes
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="btn-primary"
        >
          <Plus size={16} className="mr-1.5" /> Nouveau Tag
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-700 font-medium">Tags totaux</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{tags.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium">Tags utilisés</p>
          <p className="text-3xl font-bold text-green-900 mt-1">
            {tags.filter((t) => (t._count?.prospects ?? 0) > 0).length}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-700 font-medium">Tags automatiques</p>
          <p className="text-3xl font-bold text-purple-900 mt-1">
            {tags.filter((t) => t.isAutoTag).length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="card">
        <label className="block text-sm font-medium text-surface-700 mb-2">
          🔍 Filtrer par catégorie
        </label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full md:w-auto px-4 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-surface-900">
              {editingId ? "✏️ Modifier le tag" : "➕ Nouveau tag"}
            </h4>
            <button type="button" onClick={handleClose} className="text-surface-400 hover:text-surface-600">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })}
                placeholder="ex: assurance_sante"
                className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-surface-500 mt-1">
                Minuscules, chiffres et underscores uniquement
              </p>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="ex: Assurance Santé"
                className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Catégorie
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TagCategory })}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Couleur
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-16 h-10 border border-surface-300 rounded-lg cursor-pointer"
                />
                <div className="flex gap-1 flex-wrap flex-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm({ ...form, color })}
                      className={`w-8 h-8 rounded border-2 ${
                        form.color === color ? "border-surface-900" : "border-surface-200"
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description optionnelle du tag..."
                rows={2}
                className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            {/* Auto Tag */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isAutoTag}
                  onChange={(e) => setForm({ ...form, isAutoTag: e.target.checked })}
                  className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-surface-700">
                  🤖 Tag automatique (assigné par l'enrichissement)
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
            <button type="button" onClick={handleClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? "💾 Sauvegarde..." : "💾 Sauvegarder"}
            </button>
          </div>
        </form>
      )}

      {/* Tags List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="card text-center py-12">
          <TagIcon size={48} className="mx-auto text-surface-300 mb-4" />
          <p className="text-surface-600 text-lg font-medium">Aucun tag trouvé</p>
          <p className="text-surface-500 text-sm mt-2">
            {filterCategory ? "Aucun tag dans cette catégorie" : "Créez votre premier tag pour commencer"}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-surface-200">
            <thead className="bg-surface-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Tag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-surface-200">
              {filteredTags.map((tag) => (
                <tr key={tag.id} className="hover:bg-surface-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.label}
                      </span>
                      {tag.isAutoTag && (
                        <span className="text-xs text-surface-500" title="Tag automatique">
                          🤖
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-1 font-mono">{tag.name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">
                    {CATEGORIES.find((c) => c.value === tag.category)?.label || tag.category}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600">
                    {tag.description || <span className="text-surface-400 italic">Aucune description</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">
                    <div className="flex flex-col gap-1">
                      <span>👥 {tag._count?.prospects ?? 0} prospects</span>
                      <span>📧 {tag._count?.campaigns ?? 0} campagnes</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="text-brand-600 hover:text-brand-900 mr-4"
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="text-red-600 hover:text-red-900"
                      title="Supprimer"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
