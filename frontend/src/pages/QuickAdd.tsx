import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, AlertTriangle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

interface DedupResult {
  isDuplicate: boolean;
  existingId?: string;
  existingStatus?: string;
}

interface SitePreview {
  title: string;
  contactPageContent: string | null;
  hasContactForm: boolean;
}

export default function QuickAdd() {
  const queryClient = useQueryClient();

  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [contactFormUrl, setContactFormUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [dedup, setDedup] = useState<DedupResult | null>(null);
  const [preview, setPreview] = useState<SitePreview | null>(null);
  const [checkingUrl, setCheckingUrl] = useState(false);

  async function handleUrlBlur() {
    if (!url.trim()) return;
    setCheckingUrl(true);
    setDedup(null);
    setPreview(null);

    try {
      const [dedupRes, previewRes] = await Promise.all([
        api.get<DedupResult>("/prospects/check-dedup", {
          params: { url: url.trim() },
        }),
        api
          .get<SitePreview>("/prospects/site-preview", {
            params: { url: url.trim() },
          })
          .catch(() => null),
      ]);

      setDedup(dedupRes.data);
      if (previewRes) setPreview(previewRes.data);
    } catch {
      // silently fail, user can still submit
    } finally {
      setCheckingUrl(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/prospects", {
        url: url.trim(),
        email: email.trim() || null,
        contactName: name.trim() || null,
        contactFormUrl: contactFormUrl.trim() || null,
        notes: notes.trim() || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Prospect created successfully");
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      setUrl("");
      setEmail("");
      setName("");
      setContactFormUrl("");
      setNotes("");
      setDedup(null);
      setPreview(null);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("URL is required");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form onSubmit={handleSubmit} className="card space-y-4">
        <h3 className="text-lg font-semibold text-surface-900">
          Add a Prospect
        </h3>

        {/* URL */}
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            URL <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Globe
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              className="input-field pl-9"
              placeholder="https://example.com"
              required
            />
            {checkingUrl && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Dedup alert */}
        {dedup?.isDuplicate && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={20} className="shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Duplicate detected
              </p>
              <p className="text-sm text-amber-700">
                This domain already exists with status:{" "}
                <strong>{dedup.existingStatus}</strong>
              </p>
            </div>
          </div>
        )}

        {dedup && !dedup.isDuplicate && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 size={16} />
            <span>No duplicate found</span>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="contact@example.com"
          />
        </div>

        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            Contact Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
            placeholder="John Doe"
          />
        </div>

        {/* Contact form URL */}
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            Contact Form URL
          </label>
          <input
            type="url"
            value={contactFormUrl}
            onChange={(e) => setContactFormUrl(e.target.value)}
            className="input-field"
            placeholder="https://example.com/contact"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field resize-y"
            rows={3}
            placeholder="Any relevant notes..."
          />
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="btn-primary w-full"
        >
          {createMutation.isPending ? "Creating..." : "Create Prospect"}
        </button>
      </form>

      {/* Site preview */}
      {preview && (
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
            Site Preview
          </h3>
          <p className="text-sm font-medium text-surface-900">
            {preview.title}
          </p>
          <p className="mt-1 text-xs text-surface-500">
            Contact form detected:{" "}
            <span
              className={
                preview.hasContactForm ? "text-emerald-600" : "text-red-600"
              }
            >
              {preview.hasContactForm ? "Yes" : "No"}
            </span>
          </p>
          {preview.contactPageContent && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-surface-50 p-3 text-xs text-surface-600">
              {preview.contactPageContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
