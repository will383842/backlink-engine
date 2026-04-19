import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Download,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import api from "@/lib/api";

// Hard cap to protect the browser from multi-million-line pastes. The backend
// has its own dedup + bulk endpoint caps; this is just the UI guard rail.
const MAX_ROWS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedRow {
  url: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  country?: string;
  category?: string;
  sourceContactType?: string;
  phone?: string;
  notes?: string;
  _raw: string;
}

interface DedupCheckResult {
  summary: { total: number; existing: number; new: number; invalid: number };
  results: Array<{
    url: string;
    domain: string;
    exists: boolean;
    prospectId?: number;
  }>;
}

interface BulkImportResult {
  total: number;
  created: number;
  duplicates: number;
  errors: number;
}

const CATEGORIES = [
  { value: "", label: "— Par défaut (blogger) —" },
  { value: "media", label: "📰 Media / Presse / Journaliste" },
  { value: "blogger", label: "✍️ Blogger" },
  { value: "influencer", label: "🎤 Influenceur" },
  { value: "association", label: "🏛️ Association / ONG" },
  { value: "corporate", label: "🏢 Corporate / Entreprise" },
  { value: "agency", label: "📢 Agence" },
  { value: "partner", label: "🤝 Partenaire" },
  { value: "ecommerce", label: "🛒 E-commerce" },
  { value: "other", label: "📦 Autre" },
];

interface ContactTypeMapping {
  id: number;
  typeKey: string;
  category: string;
  label: string | null;
}

interface MappingsResponse {
  data: ContactTypeMapping[];
  categories: string[];
}

const LANGUAGES = [
  { value: "", label: "— Auto-détection —" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "en", label: "🇬🇧 English" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "ar", label: "🇸🇦 العربية" },
  { value: "zh", label: "🇨🇳 中文" },
  { value: "ja", label: "🇯🇵 日本語" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BulkImport() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawInput, setRawInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [dedupResult, setDedupResult] = useState<DedupCheckResult | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  // Batch defaults
  const [defaultCategory, setDefaultCategory] = useState("");
  const [defaultSourceType, setDefaultSourceType] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("");
  const [defaultCountry, setDefaultCountry] = useState("");

  const { data: mappingsData } = useQuery<MappingsResponse>({
    queryKey: ["contact-type-mappings"],
    queryFn: async () => {
      const res = await api.get<MappingsResponse>("/contact-type-mappings");
      return res.data;
    },
    staleTime: 5 * 60_000,
  });

  // --- File handling ---
  function handleFileSelect(file: File) {
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      toast.error("Format fichier non supporte (attendu: .csv, .tsv, .txt)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || "");
      setRawInput(content);
      setFileName(file.name);
      setParsed(null);
      setDedupResult(null);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  // --- CSV parsing (papaparse, handles quoted fields + embedded commas) ---
  function parseCSV(content: string): ParsedRow[] {
    const trimmed = content.trim();
    if (!trimmed) return [];

    // Peek at first line to decide separator + header detection.
    const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
    const separator = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
    const firstCols = firstLine
      .split(separator)
      .map((c) => c.replace(/^"|"$/g, "").trim().toLowerCase());
    const hasHeader = firstCols.includes("url");

    const result = Papa.parse<Record<string, string>>(trimmed, {
      header: hasHeader,
      delimiter: separator,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      transform: (value) => value.trim(),
    });

    if (result.errors.length > 0) {
      const firstErr = result.errors[0];
      if (firstErr) {
        console.warn("CSV parse warnings:", result.errors.slice(0, 3));
      }
    }

    const pick = (row: Record<string, string>, key: string): string | undefined => {
      const v = row[key];
      return v && v.length > 0 ? v : undefined;
    };

    const rows: ParsedRow[] = [];

    if (hasHeader) {
      for (const row of result.data) {
        if (!row || typeof row !== "object") continue;
        const url = pick(row, "url");
        if (!url) continue;
        rows.push({
          url,
          email: pick(row, "email"),
          name: pick(row, "name"),
          firstName: pick(row, "firstname"),
          lastName: pick(row, "lastname"),
          language: pick(row, "language"),
          country: pick(row, "country"),
          category: pick(row, "category"),
          sourceContactType: pick(row, "sourcecontacttype"),
          phone: pick(row, "phone"),
          notes: pick(row, "notes"),
          _raw: Object.values(row).join(separator),
        });
        if (rows.length >= MAX_ROWS) break;
      }
    } else {
      // No header: re-parse as plain array rows and map positionally.
      const arrResult = Papa.parse<string[]>(trimmed, {
        header: false,
        delimiter: separator,
        skipEmptyLines: true,
      });
      for (const cols of arrResult.data) {
        if (!Array.isArray(cols) || cols.length === 0) continue;
        const rawCols = cols.map((c) => String(c).trim());
        const url = rawCols[0];
        if (!url) continue;
        const colCount = rawCols.length;
        rows.push({
          url,
          email: colCount >= 2 ? rawCols[1] || undefined : undefined,
          name: colCount >= 3 ? rawCols[2] || undefined : undefined,
          notes: colCount >= 4 ? rawCols[3] || undefined : undefined,
          _raw: rawCols.join(separator),
        });
        if (rows.length >= MAX_ROWS) break;
      }
    }

    return rows;
  }

  // --- Parse + dedup check ---
  async function handleParse() {
    if (!rawInput.trim()) {
      toast.error("Colle des donnees ou uploade un fichier");
      return;
    }

    const rows = parseCSV(rawInput);
    if (rows.length === 0) {
      toast.error("Aucune ligne valide trouvee (colonne 'url' requise)");
      return;
    }

    if (rows.length >= MAX_ROWS) {
      toast(
        `Limite atteinte : ${MAX_ROWS.toLocaleString()} lignes importées max. Les lignes supplémentaires ont été ignorées.`,
        { icon: "⚠️", duration: 6000 }
      );
    }

    setParsed(rows);

    // Dedup check
    try {
      const urls = rows.map((r) => r.url).slice(0, 1000);
      const res = await api.post<DedupCheckResult>(
        "/prospects/bulk-check-dedup",
        { urls }
      );
      setDedupResult(res.data);
      toast.success(
        `${res.data.summary.new} nouveaux, ${res.data.summary.existing} existants, ${res.data.summary.invalid} invalides`
      );
    } catch (err) {
      toast.error("Erreur dedup check (fallback: tous traites comme nouveaux)");
      setDedupResult({
        summary: { total: rows.length, existing: 0, new: rows.length, invalid: 0 },
        results: rows.map((r) => ({ url: r.url, domain: "", exists: false })),
      });
    }
  }

  // --- Import mutation ---
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parsed || !dedupResult) return;

      // Filter out duplicates
      const existingUrls = new Set(
        dedupResult.results.filter((r) => r.exists).map((r) => r.url)
      );
      const toImport = parsed.filter((r) => !existingUrls.has(r.url));

      if (toImport.length === 0) {
        throw new Error("Aucun nouveau prospect a importer");
      }

      // Build CSV with full columns (applying batch defaults)
      const headers = [
        "url",
        "email",
        "firstName",
        "lastName",
        "language",
        "country",
        "category",
        "sourceContactType",
        "phone",
        "notes",
      ];
      const rows = [headers.join(",")];
      for (const r of toImport) {
        const row = [
          r.url,
          r.email || "",
          r.firstName || r.name || "",
          r.lastName || "",
          r.language || defaultLanguage || "",
          r.country || defaultCountry.toUpperCase() || "",
          r.category || defaultCategory || "",
          r.sourceContactType || defaultSourceType || "",
          r.phone || "",
          r.notes || "",
        ];
        rows.push(row.map((v) => String(v).replace(/,/g, " ")).join(","));
      }
      const csv = rows.join("\n");

      const res = await api.post<{ data: BulkImportResult }>("/prospects/bulk", {
        csv,
      });
      return res.data?.data ?? (res.data as unknown as BulkImportResult);
    },
    onSuccess: (data) => {
      if (!data) return;
      setResult(data);
      toast.success(`${data.created} prospects importes`);
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erreur lors de l'import");
    },
  });

  function handleReset() {
    setRawInput("");
    setFileName(null);
    setParsed(null);
    setDedupResult(null);
    setResult(null);
    setDefaultCategory("");
    setDefaultSourceType("");
    setDefaultLanguage("");
    setDefaultCountry("");
  }

  function downloadSample() {
    const sample = [
      "url,email,firstName,lastName,language,country,category,sourceContactType,phone,notes",
      "https://lemonde.fr,contact@lemonde.fr,Jean,Martin,fr,FR,media,presse,,Grand quotidien",
      "https://bfmtv.com,presse@bfmtv.com,Marie,Dupont,fr,FR,media,presse,,Chaine info",
      "https://blog-expat.com,hello@blog-expat.com,,,,,blogger,blog,,Blog voyage",
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-bulk-import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const nonDupCount = dedupResult?.summary.new ?? 0;
  const dupSet = new Set(
    dedupResult?.results.filter((r) => r.exists).map((r) => r.url) ?? []
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {!result && (
        <>
          {/* ============================================================ */}
          {/* Batch defaults                                                */}
          {/* ============================================================ */}
          <div className="card space-y-4">
            <div className="flex items-start gap-2">
              <Info size={18} className="mt-0.5 text-brand-600" />
              <div>
                <h3 className="text-lg font-semibold text-surface-900">
                  Valeurs par défaut pour cet import
                </h3>
                <p className="mt-1 text-sm text-surface-500">
                  Appliquées à tous les prospects sans valeur propre dans le
                  CSV. Peuvent être surchargées ligne par ligne via les
                  colonnes CSV.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-700">
                  Catégorie
                </label>
                <select
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  className="input-field"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-700">
                  Type de contact source
                </label>
                <select
                  value={defaultSourceType}
                  onChange={(e) => setDefaultSourceType(e.target.value)}
                  className="input-field"
                >
                  <option value="">— Non spécifié —</option>
                  {(mappingsData?.data ?? []).map((m) => (
                    <option key={m.id} value={m.typeKey}>
                      {m.label ?? m.typeKey} ({m.category})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-surface-500">
                  La catégorie sera déduite automatiquement.{" "}
                  <a href="/settings/contact-types" className="underline hover:text-brand-600">
                    Gérer la liste
                  </a>
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-700">
                  Langue
                </label>
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  className="input-field"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-700">
                  Pays (code ISO)
                </label>
                <input
                  type="text"
                  value={defaultCountry}
                  onChange={(e) => setDefaultCountry(e.target.value.toUpperCase())}
                  placeholder="FR, DE, US..."
                  maxLength={2}
                  className="input-field uppercase"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Input: drag & drop OR paste                                   */}
          {/* ============================================================ */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload size={20} className="text-brand-600" />
                <h3 className="text-lg font-semibold text-surface-900">
                  Données à importer
                </h3>
              </div>
              <button
                type="button"
                onClick={downloadSample}
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
              >
                <Download size={14} />
                Télécharger exemple CSV
              </button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                isDragging
                  ? "border-brand-500 bg-brand-50"
                  : "border-surface-300 bg-surface-50 hover:border-brand-400 hover:bg-brand-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileInputChange}
                className="hidden"
              />
              {fileName ? (
                <div className="flex items-center gap-2 text-brand-700">
                  <FileText size={24} />
                  <span className="font-medium">{fileName}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRawInput("");
                      setFileName(null);
                      setParsed(null);
                      setDedupResult(null);
                    }}
                    className="ml-2 rounded p-1 hover:bg-brand-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={32} className="mb-2 text-surface-400" />
                  <p className="text-sm font-medium text-surface-700">
                    Glisse un fichier ici ou clique pour parcourir
                  </p>
                  <p className="mt-1 text-xs text-surface-500">
                    CSV, TSV ou TXT — séparateurs virgule ou point-virgule
                  </p>
                </>
              )}
            </div>

            {/* OR paste */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-200" />
              <span className="text-xs text-surface-500">OU COLLE DU TEXTE</span>
              <div className="h-px flex-1 bg-surface-200" />
            </div>

            <textarea
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                setFileName(null);
                setParsed(null);
                setDedupResult(null);
              }}
              className="input-field resize-y font-mono text-xs"
              rows={8}
              placeholder={`url,email,firstName,lastName,language,country,category,sourceContactType\nhttps://lemonde.fr,contact@lemonde.fr,Jean,Martin,fr,FR,media,presse\nhttps://bfmtv.com,presse@bfmtv.com,Marie,Dupont,fr,FR,media,presse`}
            />

            <div className="flex flex-wrap gap-2">
              {!parsed ? (
                <button
                  onClick={handleParse}
                  disabled={!rawInput.trim()}
                  className="btn-primary"
                >
                  Analyser & vérifier les doublons
                </button>
              ) : (
                <>
                  <button
                    onClick={() => importMutation.mutate()}
                    disabled={importMutation.isPending || nonDupCount === 0}
                    className="btn-primary"
                  >
                    {importMutation.isPending
                      ? "Import en cours..."
                      : `Importer ${nonDupCount} prospects`}
                  </button>
                  <button onClick={handleReset} className="btn-secondary">
                    Réinitialiser
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* Preview with dedup                                            */}
          {/* ============================================================ */}
          {parsed && dedupResult && (
            <div className="card space-y-3 p-0">
              {/* Summary strip */}
              <div className="grid grid-cols-4 gap-2 p-4 sm:gap-4">
                <SummaryBox
                  color="brand"
                  value={dedupResult.summary.total}
                  label="Total lignes"
                />
                <SummaryBox
                  color="emerald"
                  value={dedupResult.summary.new}
                  label="Nouveaux"
                />
                <SummaryBox
                  color="amber"
                  value={dedupResult.summary.existing}
                  label="Déjà en base"
                />
                <SummaryBox
                  color="red"
                  value={dedupResult.summary.invalid}
                  label="URLs invalides"
                />
              </div>

              <div className="max-h-96 overflow-auto border-t border-surface-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-surface-200 bg-surface-50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        Statut
                      </th>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        URL
                      </th>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        Email
                      </th>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        Nom
                      </th>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        Catégorie
                      </th>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        Type
                      </th>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        Langue
                      </th>
                      <th className="px-3 py-2 font-medium text-surface-600">
                        Pays
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {parsed.slice(0, 100).map((row, i) => {
                      const isDup = dupSet.has(row.url);
                      const cat = row.category || defaultCategory || "blogger";
                      const type = row.sourceContactType || defaultSourceType || "-";
                      const lang = row.language || defaultLanguage || "-";
                      const country = row.country || defaultCountry || "-";
                      const displayName =
                        row.name ||
                        [row.firstName, row.lastName].filter(Boolean).join(" ") ||
                        "-";
                      return (
                        <tr key={i} className={isDup ? "bg-amber-50/50" : ""}>
                          <td className="px-3 py-2">
                            {isDup ? (
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <AlertTriangle size={12} /> Dup
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 size={12} /> Nouveau
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono">{row.url}</td>
                          <td className="px-3 py-2">{row.email || "-"}</td>
                          <td className="px-3 py-2">{displayName}</td>
                          <td className="px-3 py-2">{cat}</td>
                          <td className="px-3 py-2">{type}</td>
                          <td className="px-3 py-2">{lang}</td>
                          <td className="px-3 py-2">{country}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {parsed.length > 100 && (
                  <div className="border-t border-surface-100 bg-surface-50 p-2 text-center text-xs text-surface-500">
                    … {parsed.length - 100} lignes supplémentaires
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* Result                                                         */}
      {/* ============================================================ */}
      {result && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={24} className="text-emerald-600" />
            <h3 className="text-lg font-semibold text-surface-900">
              Import terminé
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <SummaryBox color="brand" value={result.total} label="Total" />
            <SummaryBox color="emerald" value={result.created} label="Créés" />
            <SummaryBox color="amber" value={result.duplicates} label="Doublons" />
            <SummaryBox color="red" value={result.errors} label="Erreurs" />
          </div>
          <button onClick={handleReset} className="btn-primary">
            Importer d'autres prospects
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SummaryBox({
  color,
  value,
  label,
}: {
  color: "brand" | "emerald" | "amber" | "red";
  value: number;
  label: string;
}) {
  const colorClasses: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 border-brand-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs uppercase tracking-wide">{label}</p>
    </div>
  );
}
