import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, X, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { LinkableAsset } from "@/types";

interface AssetForm {
  title: string;
  type: string;
  url: string;
  isPublished: boolean;
}

const emptyForm: AssetForm = {
  title: "",
  type: "blog-post",
  url: "",
  isPublished: true,
};

export default function Assets() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm);

  const { data: assets, isLoading } = useQuery<LinkableAsset[]>({
    queryKey: ["assets"],
    queryFn: async () => {
      const res = await api.get("/assets");
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return (await api.put(`/assets/${editingId}`, form)).data;
      }
      return (await api.post("/assets", form)).data;
    },
    onSuccess: () => {
      toast.success(editingId ? "Asset updated" : "Asset created");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      handleClose();
    },
  });

  function handleEdit(a: LinkableAsset) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      type: a.assetType,
      url: a.url,
      isPublished: a.isPublished,
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
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">
          Linkable Assets
        </h3>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="btn-primary"
        >
          <Plus size={16} className="mr-1.5" /> New Asset
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-surface-900">
              {editingId ? "Edit Asset" : "New Asset"}
            </h4>
            <button type="button" onClick={handleClose}>
              <X size={20} className="text-surface-400 hover:text-surface-600" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
                placeholder="Complete Guide to Moving to France"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input-field"
              >
                <option value="blog-post">Blog Post</option>
                <option value="guide">Guide</option>
                <option value="tool">Tool</option>
                <option value="infographic">Infographic</option>
                <option value="video">Video</option>
                <option value="calculator">Calculator</option>
                <option value="template">Template</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-surface-700">
                URL
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="input-field"
                placeholder="https://sos-expat.com/guides/moving-to-france"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={form.isPublished}
                onChange={(e) =>
                  setForm({ ...form, isPublished: e.target.checked })
                }
                className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
              />
              <label
                htmlFor="isPublished"
                className="text-sm font-medium text-surface-700"
              >
                Published
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="btn-primary"
            >
              {saveMutation.isPending
                ? "Saving..."
                : editingId
                  ? "Update"
                  : "Create"}
            </button>
            <button type="button" onClick={handleClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50">
              <tr>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Title
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Type
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  URL
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Backlinks
                </th>
                <th className="px-4 py-3 font-medium text-surface-600">
                  Published
                </th>
                <th className="px-4 py-3 font-medium text-surface-600" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                  </td>
                </tr>
              ) : !assets?.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-surface-500"
                  >
                    No assets yet.
                  </td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-medium text-surface-900">
                      {a.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-surface-100 text-surface-600">
                        {a.assetType}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                      >
                        {a.url} <ExternalLink size={10} />
                      </a>
                    </td>
                    <td className="px-4 py-3 font-semibold text-surface-900">
                      {a.totalBacklinks}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          a.isPublished ? "bg-emerald-500" : "bg-surface-300"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleEdit(a)}
                        className="text-surface-400 hover:text-brand-600"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
