import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Lock, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

interface Mapping {
  id: number;
  typeKey: string;
  category: string;
  label: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MappingsResponse {
  data: Mapping[];
  categories: string[];
}

interface EditorState {
  open: boolean;
  mode: "create" | "edit";
  mapping: Partial<Mapping>;
}

const EMPTY_EDITOR: EditorState = {
  open: false,
  mode: "create",
  mapping: { typeKey: "", category: "blogger", label: "" },
};

export default function ContactTypeMappings() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);

  const { data, isLoading } = useQuery<MappingsResponse>({
    queryKey: ["contact-type-mappings"],
    queryFn: async () => {
      const res = await api.get<MappingsResponse>("/contact-type-mappings");
      return res.data;
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload: { typeKey: string; category: string; label: string | null }) => {
      const res = await api.post("/contact-type-mappings", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Synonyme ajouté");
      queryClient.invalidateQueries({ queryKey: ["contact-type-mappings"] });
      setEditor(EMPTY_EDITOR);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Mapping> }) => {
      const res = await api.put(`/contact-type-mappings/${id}`, patch);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Synonyme mis à jour");
      queryClient.invalidateQueries({ queryKey: ["contact-type-mappings"] });
      setEditor(EMPTY_EDITOR);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la mise à jour");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/contact-type-mappings/${id}`);
    },
    onSuccess: () => {
      toast.success("Synonyme supprimé");
      queryClient.invalidateQueries({ queryKey: ["contact-type-mappings"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "Suppression impossible");
    },
  });

  const categories = data?.categories ?? [];
  const mappings = data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return mappings;
    const needle = search.toLowerCase();
    return mappings.filter(
      (m) =>
        m.typeKey.toLowerCase().includes(needle) ||
        (m.label ?? "").toLowerCase().includes(needle) ||
        m.category.toLowerCase().includes(needle),
    );
  }, [mappings, search]);

  const grouped = useMemo(() => {
    const out = new Map<string, Mapping[]>();
    for (const m of filtered) {
      if (!out.has(m.category)) out.set(m.category, []);
      out.get(m.category)!.push(m);
    }
    return out;
  }, [filtered]);

  function handleSave() {
    const { mapping, mode } = editor;
    if (!mapping.typeKey || !mapping.category) {
      toast.error("Le type et la catégorie sont requis");
      return;
    }
    if (mode === "create") {
      createMut.mutate({
        typeKey: mapping.typeKey,
        category: mapping.category,
        label: mapping.label || null,
      });
    } else if (mapping.id) {
      updateMut.mutate({
        id: mapping.id,
        patch: {
          ...(mapping.typeKey ? { typeKey: mapping.typeKey } : {}),
          ...(mapping.category ? { category: mapping.category } : {}),
          label: mapping.label ?? null,
        },
      });
    }
  }

  function handleDelete(m: Mapping) {
    if (m.isSystem) return;
    if (!confirm(`Supprimer le synonyme "${m.typeKey}" ?`)) return;
    deleteMut.mutate(m.id);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Types & Catégories</h1>
          <p className="mt-1 text-sm text-surface-600">
            Chaque "type de contact" (ex. <em>youtubeur</em>, <em>journaliste</em>) est rattaché à une
            catégorie canonique. Ajoute des synonymes pour que le moteur classe automatiquement tes
            prospects.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditor({
              open: true,
              mode: "create",
              mapping: { typeKey: "", category: "blogger", label: "" },
            })
          }
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Ajouter un synonyme
        </button>
      </div>

      <div className="card space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un type, un label ou une catégorie…"
            className="w-full rounded-lg border border-surface-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-surface-500">Chargement…</div>
        ) : mappings.length === 0 ? (
          <div className="py-10 text-center text-sm text-surface-500">
            Aucun synonyme. Lance le seed ou clique sur "Ajouter".
          </div>
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-surface-500">
                    {category}{" "}
                    <span className="text-xs font-normal text-surface-400">({items.length})</span>
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-surface-200">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-50 text-left text-xs uppercase tracking-wider text-surface-500">
                        <tr>
                          <th className="px-3 py-2">Type (clé)</th>
                          <th className="px-3 py-2">Label</th>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {items.map((m) => (
                          <tr key={m.id} className="hover:bg-surface-50">
                            <td className="px-3 py-2 font-mono text-xs text-surface-900">
                              {m.typeKey}
                            </td>
                            <td className="px-3 py-2 text-surface-700">{m.label ?? "—"}</td>
                            <td className="px-3 py-2">
                              {m.isSystem ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-600">
                                  <Lock size={10} /> système
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                  custom
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditor({ open: true, mode: "edit", mapping: { ...m } })
                                  }
                                  className="rounded p-1 text-surface-500 hover:bg-surface-100 hover:text-surface-900"
                                  title="Modifier"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  disabled={m.isSystem}
                                  onClick={() => handleDelete(m)}
                                  className="rounded p-1 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  title={m.isSystem ? "Synonyme système — non supprimable" : "Supprimer"}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {editor.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditor(EMPTY_EDITOR)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-surface-900">
              {editor.mode === "create" ? "Nouveau synonyme" : "Modifier le synonyme"}
            </h2>

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-700">
                Type (clé, sera normalisée en minuscules sans accents)
              </label>
              <input
                type="text"
                value={editor.mapping.typeKey ?? ""}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, mapping: { ...s.mapping, typeKey: e.target.value } }))
                }
                disabled={editor.mode === "edit" && editor.mapping.isSystem}
                placeholder="ex. vlogger"
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:bg-surface-50 disabled:text-surface-500"
              />
              {editor.mode === "edit" && editor.mapping.isSystem && (
                <p className="mt-1 text-xs text-surface-500">
                  Synonyme système — la clé ne peut pas être renommée (catégorie et label restent modifiables).
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-700">Catégorie</label>
              <select
                value={editor.mapping.category ?? "blogger"}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, mapping: { ...s.mapping, category: e.target.value } }))
                }
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-700">
                Label (optionnel, affiché dans l'UI)
              </label>
              <input
                type="text"
                value={editor.mapping.label ?? ""}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, mapping: { ...s.mapping, label: e.target.value } }))
                }
                placeholder="ex. Vlogger YouTube"
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditor(EMPTY_EDITOR)}
                className="rounded-lg border border-surface-200 px-3 py-2 text-sm hover:bg-surface-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={createMut.isPending || updateMut.isPending}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {editor.mode === "create" ? "Créer" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
