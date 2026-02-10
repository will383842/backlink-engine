import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { AppSettings } from "@/types";
import { useTranslation } from "@/i18n";

const defaultSettings: AppSettings = {
  mailwizz: {
    apiUrl: "",
    apiKey: "",
    listUids: {},
  },
  imap: {
    host: "",
    port: 993,
    user: "",
    pass: "",
  },
  scoring: {
    minScoreForContact: 40,
    minDaForContact: 10,
    neighborhoodThreshold: 30,
  },
  recontact: {
    delayMonths: 6,
    maxRecontacts: 3,
    minScoreForRecontact: 50,
  },
};

export default function Settings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const { data, isLoading } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get("/settings");
      return res.data?.data ?? res.data;
    },
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put("/settings", settings);
      return res.data;
    },
    onSuccess: () => {
      toast.success(t("settings.settingsSaved"));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  // Helper to manage listUids as a key=value textarea
  const [listUidsText, setListUidsText] = useState("");

  useEffect(() => {
    const text = Object.entries(settings.mailwizz.listUids)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    setListUidsText(text);
  }, [settings.mailwizz.listUids]);

  function parseListUids(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    text
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        const [key, ...rest] = line.split("=");
        if (key && rest.length) {
          result[key.trim()] = rest.join("=").trim();
        }
      });
    return result;
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8">
      {/* MailWizz */}
      <section className="card space-y-4">
        <h3 className="text-lg font-semibold text-surface-900">
          {t("settings.mailwizzConfig")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.apiUrl")}
            </label>
            <input
              type="url"
              value={settings.mailwizz.apiUrl}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mailwizz: { ...settings.mailwizz, apiUrl: e.target.value },
                })
              }
              className="input-field"
              placeholder="https://mailwizz.yourdomain.com/api"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.apiKey")}
            </label>
            <input
              type="password"
              value={settings.mailwizz.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  mailwizz: { ...settings.mailwizz, apiKey: e.target.value },
                })
              }
              className="input-field"
              placeholder="Your MailWizz API key"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.listUidsByLanguage")}
            </label>
            <textarea
              value={listUidsText}
              onChange={(e) => {
                setListUidsText(e.target.value);
                setSettings({
                  ...settings,
                  mailwizz: {
                    ...settings.mailwizz,
                    listUids: parseListUids(e.target.value),
                  },
                });
              }}
              className="input-field resize-y font-mono text-xs"
              rows={4}
              placeholder={`fr=abc123\nen=def456\nes=ghi789`}
            />
          </div>
        </div>
      </section>

      {/* IMAP */}
      <section className="card space-y-4">
        <h3 className="text-lg font-semibold text-surface-900">
          {t("settings.imapConfig")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.host")}
            </label>
            <input
              type="text"
              value={settings.imap.host}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  imap: { ...settings.imap, host: e.target.value },
                })
              }
              className="input-field"
              placeholder="imap.gmail.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.port")}
            </label>
            <input
              type="number"
              value={settings.imap.port}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  imap: {
                    ...settings.imap,
                    port: parseInt(e.target.value) || 993,
                  },
                })
              }
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.user")}
            </label>
            <input
              type="text"
              value={settings.imap.user}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  imap: { ...settings.imap, user: e.target.value },
                })
              }
              className="input-field"
              placeholder="your-email@gmail.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.password")}
            </label>
            <input
              type="password"
              value={settings.imap.pass}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  imap: { ...settings.imap, pass: e.target.value },
                })
              }
              className="input-field"
              placeholder="App password"
            />
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section className="card space-y-4">
        <h3 className="text-lg font-semibold text-surface-900">
          {t("settings.scoringThresholds")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.minScoreForContact")}
            </label>
            <input
              type="number"
              value={settings.scoring.minScoreForContact}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  scoring: {
                    ...settings.scoring,
                    minScoreForContact: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="input-field"
              min={0}
              max={100}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.minDaForContact")}
            </label>
            <input
              type="number"
              value={settings.scoring.minDaForContact}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  scoring: {
                    ...settings.scoring,
                    minDaForContact: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="input-field"
              min={0}
              max={100}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.neighborhoodThreshold")}
            </label>
            <input
              type="number"
              value={settings.scoring.neighborhoodThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  scoring: {
                    ...settings.scoring,
                    neighborhoodThreshold: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="input-field"
              min={0}
              max={100}
            />
          </div>
        </div>
      </section>

      {/* Recontact */}
      <section className="card space-y-4">
        <h3 className="text-lg font-semibold text-surface-900">
          {t("settings.recontactSettings")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.delayMonths")}
            </label>
            <input
              type="number"
              value={settings.recontact.delayMonths}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  recontact: {
                    ...settings.recontact,
                    delayMonths: parseInt(e.target.value) || 1,
                  },
                })
              }
              className="input-field"
              min={1}
              max={24}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.maxRecontacts")}
            </label>
            <input
              type="number"
              value={settings.recontact.maxRecontacts}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  recontact: {
                    ...settings.recontact,
                    maxRecontacts: parseInt(e.target.value) || 1,
                  },
                })
              }
              className="input-field"
              min={1}
              max={10}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.minScoreForRecontact")}
            </label>
            <input
              type="number"
              value={settings.recontact.minScoreForRecontact}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  recontact: {
                    ...settings.recontact,
                    minScoreForRecontact: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="input-field"
              min={0}
              max={100}
            />
          </div>
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="btn-primary"
        >
          <Save size={16} className="mr-1.5" />
          {saveMutation.isPending ? t("common.saving") : t("settings.saveSettings")}
        </button>
      </div>
    </form>
  );
}
