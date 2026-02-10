import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { OutreachTemplate, TemplatePurpose } from "@/types";
import { useTranslation } from "@/i18n";

const PURPOSE_OPTIONS: TemplatePurpose[] = [
  "INITIAL_OUTREACH",
  "FOLLOW_UP",
  "RECONTACT",
  "THANK_YOU",
  "NEGOTIATION",
];

const PURPOSE_COLORS: Record<TemplatePurpose, string> = {
  INITIAL_OUTREACH: "bg-brand-100 text-brand-700",
  FOLLOW_UP: "bg-indigo-100 text-indigo-700",
  RECONTACT: "bg-amber-100 text-amber-700",
  THANK_YOU: "bg-emerald-100 text-emerald-700",
  NEGOTIATION: "bg-purple-100 text-purple-700",
};

const VARIABLE_HINTS = [
  "{{domain}}",
  "{{contactName}}",
  "{{siteName}}",
  "{{assetUrl}}",
  "{{assetTitle}}",
  "{{backlinkUrl}}",
];

interface TemplateForm {
  name: string;
  language: string;
  purpose: TemplatePurpose;
  subject: string;
  body: string;
  formalityLevel: "formal" | "semi-formal" | "informal";
  culturalNotes: string;
}

const emptyForm: TemplateForm = {
  name: "",
  language: "fr",
  purpose: "INITIAL_OUTREACH",
  subject: "",
  body: "",
  formalityLevel: "semi-formal",
  culturalNotes: "",
};

export default function Templates() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  const { data: templates, isLoading } = useQuery<OutreachTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await api.get("/templates");
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        culturalNotes: form.culturalNotes || null,
      };
      if (editingId) {
        return (await api.put(`/templates/${editingId}`, payload)).data;
      }
      return (await api.post("/templates", payload)).data;
    },
    onSuccess: () => {
      toast.success(editingId ? t("templates.templateUpdated") : t("templates.templateCreated"));
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      handleClose();
    },
  });

  function handleEdit(tpl: OutreachTemplate) {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      language: tpl.language,
      purpose: tpl.purpose as TemplatePurpose,
      subject: tpl.subject,
      body: tpl.body,
      formalityLevel: tpl.formalityLevel as TemplateForm["formalityLevel"],
      culturalNotes: tpl.culturalNotes ?? "",
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
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast.error(t("templates.nameSubjectBodyRequired"));
      return;
    }
    saveMutation.mutate();
  }

  // Group templates by language
  const grouped = (templates ?? []).reduce<Record<string, OutreachTemplate[]>>(
    (acc, tpl) => {
      if (!acc[tpl.language]) acc[tpl.language] = [];
      acc[tpl.language].push(tpl);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">
          {t("templates.title")}
        </h3>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="btn-primary"
        >
          <Plus size={16} className="mr-1.5" /> {t("templates.newTemplate")}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-surface-900">
              {editingId ? t("templates.editTemplate") : t("templates.newTemplate")}
            </h4>
            <button type="button" onClick={handleClose}>
              <X size={20} className="text-surface-400 hover:text-surface-600" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("templates.name")}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="FR Initial Blog Outreach"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("templates.templateLanguage")}
              </label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="input-field"
              >
                <option value="fr">{t("campaigns.french")}</option>
                <option value="en">{t("campaigns.english")}</option>
                <option value="es">{t("campaigns.spanish")}</option>
                <option value="de">{t("campaigns.german")}</option>
                <option value="pt">{t("campaigns.portuguese")}</option>
                <option value="it">{t("campaigns.italian")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("templates.purpose")}
              </label>
              <select
                value={form.purpose}
                onChange={(e) =>
                  setForm({ ...form, purpose: e.target.value as TemplatePurpose })
                }
                className="input-field"
              >
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("templates.formality")}
              </label>
              <select
                value={form.formalityLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    formalityLevel: e.target.value as TemplateForm["formalityLevel"],
                  })
                }
                className="input-field"
              >
                <option value="formal">{t("templates.formal")}</option>
                <option value="semi-formal">{t("templates.semiFormal")}</option>
                <option value="informal">{t("templates.informal")}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("templates.subject")}
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="input-field"
              placeholder="Partnership opportunity for {{domain}}"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("templates.body")}
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="input-field resize-y font-mono text-xs"
              rows={10}
              placeholder="Dear {{contactName}},..."
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {VARIABLE_HINTS.map((v) => (
                <span
                  key={v}
                  className="cursor-pointer rounded bg-surface-100 px-2 py-0.5 text-xs text-surface-600 hover:bg-surface-200"
                  onClick={() => setForm({ ...form, body: form.body + v })}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("templates.culturalNotes")}
            </label>
            <textarea
              value={form.culturalNotes}
              onChange={(e) =>
                setForm({ ...form, culturalNotes: e.target.value })
              }
              className="input-field resize-y"
              rows={2}
              placeholder="E.g., In France, always use 'vous' for first contact..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="btn-primary"
            >
              {saveMutation.isPending
                ? t("common.saving")
                : editingId
                  ? t("common.update")
                  : t("common.create")}
            </button>
            <button type="button" onClick={handleClose} className="btn-secondary">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Template list grouped by language */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : !templates?.length ? (
        <div className="card text-center text-surface-500">
          {t("templates.noTemplatesYet")}
        </div>
      ) : (
        Object.entries(grouped).map(([lang, tpls]) => (
          <div key={lang}>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
              {lang.toUpperCase()} ({tpls.length})
            </h4>
            <div className="space-y-3">
              {tpls.map((tpl) => (
                <div
                  key={tpl.id}
                  className="card flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-surface-900">{tpl.name}</h5>
                      <span className={`badge ${PURPOSE_COLORS[tpl.purpose as TemplatePurpose]}`}>
                        {tpl.purpose.replace(/_/g, " ")}
                      </span>
                      <span className="badge bg-surface-100 text-surface-600">
                        {tpl.formalityLevel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-surface-600">
                      {t("templates.subject")}: {tpl.subject}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-surface-400">
                      {tpl.body}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEdit(tpl)}
                    className="ml-4 shrink-0 text-surface-400 hover:text-brand-600"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
