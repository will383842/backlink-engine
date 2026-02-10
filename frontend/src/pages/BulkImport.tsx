import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useTranslation } from "@/i18n";

interface ParsedRow {
  url: string;
  email: string | null;
  name: string | null;
  notes: string | null;
}

interface DedupPreviewRow extends ParsedRow {
  isDuplicate: boolean;
  existingStatus?: string;
}

interface BulkImportResult {
  created: number;
  duplicates: number;
  errors: number;
}

export default function BulkImport() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [rawInput, setRawInput] = useState("");
  const [parsed, setParsed] = useState<DedupPreviewRow[] | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  function handleParse() {
    if (!rawInput.trim()) {
      toast.error(t("bulkImport.pasteData"));
      return;
    }

    const lines = rawInput
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const rows: ParsedRow[] = lines.map((line) => {
      const parts = line.split(";").map((p) => p.trim());
      return {
        url: parts[0] || "",
        email: parts[1] || null,
        name: parts[2] || null,
        notes: parts[3] || null,
      };
    });

    // Check dedup for all rows
    checkDedup(rows);
  }

  async function checkDedup(rows: ParsedRow[]) {
    try {
      const res = await api.post<DedupPreviewRow[]>(
        "/prospects/bulk-check-dedup",
        { rows }
      );
      setParsed(res.data);
    } catch {
      // fallback: mark all as non-duplicate
      setParsed(rows.map((r) => ({ ...r, isDuplicate: false })));
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parsed) return;
      const nonDuplicates = parsed.filter((r) => !r.isDuplicate);
      const res = await api.post<BulkImportResult>("/prospects/bulk", {
        rows: nonDuplicates,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data) {
        setResult(data);
        toast.success(t("bulkImport.imported", { count: data.created }));
        queryClient.invalidateQueries({ queryKey: ["prospects"] });
      }
    },
  });

  function handleReset() {
    setRawInput("");
    setParsed(null);
    setResult(null);
  }

  const nonDupCount = parsed?.filter((r) => !r.isDuplicate).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Input */}
      {!result && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-brand-600" />
            <h3 className="text-lg font-semibold text-surface-900">
              {t("bulkImport.title")}
            </h3>
          </div>
          <p className="text-sm text-surface-500">
            {t("bulkImport.instructions")}
          </p>

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            className="input-field resize-y font-mono text-xs"
            rows={12}
            placeholder={`https://example1.com;contact@example1.com;John;Great blog\nhttps://example2.com\nhttps://example3.com;info@example3.com`}
            disabled={!!parsed}
          />

          {!parsed ? (
            <button onClick={handleParse} className="btn-primary">
              {t("bulkImport.parseAndCheck")}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
                className="btn-primary"
              >
                {importMutation.isPending
                  ? t("common.importing")
                  : t("bulkImport.importProspects", { count: nonDupCount })}
              </button>
              <button onClick={handleReset} className="btn-secondary">
                {t("common.reset")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview table */}
      {parsed && !result && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-200 bg-surface-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-surface-600">
                    {t("bulkImport.statusCol")}
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-600">
                    {t("bulkImport.urlCol")}
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-600">
                    {t("bulkImport.emailCol")}
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-600">
                    {t("bulkImport.nameCol")}
                  </th>
                  <th className="px-4 py-3 font-medium text-surface-600">
                    {t("bulkImport.notesCol")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {parsed.map((row, i) => (
                  <tr
                    key={i}
                    className={row.isDuplicate ? "bg-amber-50/50" : ""}
                  >
                    <td className="px-4 py-3">
                      {row.isDuplicate ? (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle size={14} />
                          {t("bulkImport.dupLabel")} ({row.existingStatus})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 size={14} />
                          {t("bulkImport.newLabel")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.url}
                    </td>
                    <td className="px-4 py-3 text-xs">{row.email ?? "-"}</td>
                    <td className="px-4 py-3 text-xs">{row.name ?? "-"}</td>
                    <td className="px-4 py-3 text-xs">{row.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-surface-900">
            {t("bulkImport.importComplete")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
              <CheckCircle2 size={24} className="text-emerald-600" />
              <div>
                <p className="text-2xl font-bold text-emerald-700">
                  {result.created}
                </p>
                <p className="text-sm text-emerald-600">{t("bulkImport.created")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4">
              <AlertTriangle size={24} className="text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700">
                  {result.duplicates}
                </p>
                <p className="text-sm text-amber-600">{t("bulkImport.duplicates")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4">
              <XCircle size={24} className="text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">
                  {result.errors}
                </p>
                <p className="text-sm text-red-600">{t("bulkImport.errors")}</p>
              </div>
            </div>
          </div>
          <button onClick={handleReset} className="btn-primary">
            {t("bulkImport.importMore")}
          </button>
        </div>
      )}
    </div>
  );
}
