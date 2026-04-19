import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Bot, User, Building2, Globe, Mail, Phone, MessageCircle, Send, Shield, Zap, Power } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { AppSettings } from "@/types";
import { useTranslation } from "@/i18n";

interface OutreachConfig {
  yourName: string;
  yourCompany: string;
  yourWebsite: string;
  contactEmail: string;
  contactPhone: string;
}

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  events: {
    prospectReplied: boolean;
    prospectWon: boolean;
    backlinkLost: boolean;
    backlinkVerified: boolean;
  };
}

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
  ai: {
    enabled: true,
    provider: "openai",
    apiKey: "",
  },
};

export default function Settings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [outreachConfig, setOutreachConfig] = useState<OutreachConfig>({
    yourName: "",
    yourCompany: "SOS Expat",
    yourWebsite: "https://sos-expat.com",
    contactEmail: "",
    contactPhone: "",
  });

  const [outreachMode, setOutreachMode] = useState<"auto" | "review">("review");
  const [pendingDrafts, setPendingDrafts] = useState(0);

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    enabled: false,
    botToken: "",
    chatId: "",
    events: {
      prospectReplied: true,
      prospectWon: true,
      backlinkLost: true,
      backlinkVerified: false,
    },
  });

  const { data, isLoading } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get("/settings");
      return res.data?.data ?? res.data;
    },
  });

  // Fetch outreach mode
  const { data: outreachModeData } = useQuery({
    queryKey: ["settings", "outreach-mode"],
    queryFn: async () => {
      const res = await api.get<{ data: { mode: "auto" | "review"; pendingDrafts: number } }>("/settings/outreach-mode");
      return res.data;
    },
  });

  useEffect(() => {
    if (outreachModeData?.data) {
      setOutreachMode(outreachModeData.data.mode);
      setPendingDrafts(outreachModeData.data.pendingDrafts);
    }
  }, [outreachModeData]);

  const toggleOutreachMode = useMutation({
    mutationFn: async (mode: "auto" | "review") => {
      const res = await api.put("/settings/outreach-mode", { mode });
      return res.data;
    },
    onSuccess: (_, mode) => {
      setOutreachMode(mode);
      toast.success(mode === "auto" ? "Mode AUTO activé — emails envoyés immédiatement" : "Mode REVIEW activé — emails en brouillon");
      queryClient.invalidateQueries({ queryKey: ["settings", "outreach-mode"] });
    },
  });

  // Per-worker automation toggles
  const { data: workerTogglesData } = useQuery({
    queryKey: ["settings", "automation-workers"],
    queryFn: async () => {
      const res = await api.get<{
        data: Record<string, boolean>;
        workers: readonly string[];
      }>("/settings/automation/workers");
      return res.data;
    },
  });

  const toggleWorker = useMutation({
    mutationFn: async ({ worker, enabled }: { worker: string; enabled: boolean }) => {
      const res = await api.put(`/settings/automation/workers/${worker}`, { enabled });
      return res.data;
    },
    onSuccess: (_, vars) => {
      toast.success(
        `${vars.worker} ${vars.enabled ? "activé" : "désactivé"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["settings", "automation-workers"] });
    },
  });

  const toggleAllWorkers = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await api.put("/settings/automation/all", { enabled });
      return res.data;
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? "Automatisation ACTIVÉE (tous les workers)" : "Automatisation COUPÉE (tous les workers)");
      queryClient.invalidateQueries({ queryKey: ["settings", "automation-workers"] });
    },
  });

  // Fetch outreach config
  const { data: outreachData } = useQuery({
    queryKey: ["settings", "outreach"],
    queryFn: async () => {
      const res = await api.get<{ data: OutreachConfig }>("/settings/outreach");
      return res.data;
    },
  });

  // Fetch telegram config
  const { data: telegramData } = useQuery({
    queryKey: ["settings", "telegram"],
    queryFn: async () => {
      const res = await api.get<{ data: TelegramConfig }>("/settings/telegram");
      return res.data;
    },
  });

  useEffect(() => {
    if (data) {
      // Assurer que mailwizz existe toujours pour éviter les crashes
      setSettings({
        ...defaultSettings,
        ...data,
        mailwizz: {
          ...defaultSettings.mailwizz,
          ...data.mailwizz,
        },
      });
    }
  }, [data]);

  useEffect(() => {
    if (outreachData?.data) {
      setOutreachConfig(outreachData.data);
    }
  }, [outreachData]);

  useEffect(() => {
    if (telegramData?.data) {
      const incoming = telegramData.data as Partial<TelegramConfig>;
      setTelegramConfig((prev) => ({
        enabled: incoming.enabled ?? prev.enabled,
        botToken: incoming.botToken ?? prev.botToken,
        chatId: incoming.chatId ?? prev.chatId,
        events: { ...prev.events, ...(incoming.events ?? {}) },
      }));
    }
  }, [telegramData]);

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

  const saveOutreachMutation = useMutation({
    mutationFn: async (data: OutreachConfig) => {
      const res = await api.put("/settings/outreach", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Configuration Outreach sauvegardée");
      queryClient.invalidateQueries({ queryKey: ["settings", "outreach"] });
    },
  });

  const saveTelegramMutation = useMutation({
    mutationFn: async (data: TelegramConfig) => {
      const res = await api.put("/settings/telegram", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Configuration Telegram sauvegardée");
      queryClient.invalidateQueries({ queryKey: ["settings", "telegram"] });
    },
  });

  const sendTestTelegramMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; message: string }>("/settings/telegram/test", {
        botToken: telegramConfig.botToken,
        chatId: telegramConfig.chatId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: () => {
      toast.error("Échec de l'envoi du message de test");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  // Helper to manage listUids as a key=value textarea
  const [listUidsText, setListUidsText] = useState("");

  useEffect(() => {
    // Protection contre settings.mailwizz undefined
    if (settings.mailwizz?.listUids) {
      const text = Object.entries(settings.mailwizz.listUids)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      setListUidsText(text);
    }
  }, [settings.mailwizz?.listUids]);

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
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Outreach Mode Toggle */}
      <div className="card space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
            {outreachMode === "auto" ? <Zap size={20} className="text-amber-500" /> : <Shield size={20} className="text-brand-600" />}
            Mode d'envoi des emails
          </h3>
          <p className="mt-1 text-sm text-surface-600">
            Choisissez entre envoyer automatiquement ou vérifier chaque email avant envoi
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => toggleOutreachMode.mutate("review")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              outreachMode === "review"
                ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                : "border-surface-200 hover:border-surface-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield size={18} className={outreachMode === "review" ? "text-brand-600" : "text-surface-400"} />
              <span className="font-semibold text-surface-900">Review (brouillon)</span>
            </div>
            <p className="mt-1 text-xs text-surface-500">
              Les emails sont sauvegardés comme brouillons. Vous pouvez les prévisualiser, modifier, approuver ou rejeter avant envoi.
            </p>
          </button>

          <button
            type="button"
            onClick={() => toggleOutreachMode.mutate("auto")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              outreachMode === "auto"
                ? "border-amber-500 bg-amber-50 ring-1 ring-amber-200"
                : "border-surface-200 hover:border-surface-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap size={18} className={outreachMode === "auto" ? "text-amber-600" : "text-surface-400"} />
              <span className="font-semibold text-surface-900">Auto (direct)</span>
            </div>
            <p className="mt-1 text-xs text-surface-500">
              Les emails sont générés et envoyés immédiatement, sans vérification humaine.
            </p>
          </button>
        </div>

        {pendingDrafts > 0 && (
          <div className="rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-700">
            <strong>{pendingDrafts}</strong> email{pendingDrafts > 1 ? "s" : ""} en attente de review →{" "}
            <a href="/sent-emails?status=draft" className="font-semibold underline">Voir les brouillons</a>
          </div>
        )}
      </div>

      {/* Per-worker automation toggles */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
              <Power size={20} className="text-brand-600" />
              Automatisation — par worker
            </h3>
            <p className="mt-1 text-sm text-surface-600">
              Active ou coupe chaque worker individuellement. Un worker désactivé n'exécute plus ses jobs planifiés ; le cron continue mais les jobs se terminent immédiatement.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => toggleAllWorkers.mutate(true)}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Tout activer
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Couper TOUS les workers ? Aucune automatisation ne tournera plus.")) {
                  toggleAllWorkers.mutate(false);
                }
              }}
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Tout couper
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(workerTogglesData?.workers ?? []).map((worker) => {
            const enabled = workerTogglesData?.data?.[worker] !== false;
            const labels: Record<string, { title: string; desc: string }> = {
              enrichment: { title: "Enrichment", desc: "Score, langue, pays, tags" },
              autoEnrollment: { title: "Auto-enrollment", desc: "Inscription auto aux campagnes" },
              outreach: { title: "Outreach", desc: "Envoi d'emails / retry" },
              reply: { title: "Reply", desc: "Ingestion IMAP des réponses" },
              verification: { title: "Verification", desc: "Vérif backlinks + link loss" },
              reporting: { title: "Reporting", desc: "Rapports quotidiens / hebdo" },
              sequence: { title: "Sequence", desc: "Relances de séquence" },
              crawling: { title: "Crawling", desc: "Découverte de prospects" },
              broadcast: { title: "Broadcast", desc: "Campagnes de masse + warmup" },
            };
            const meta = labels[worker] ?? { title: worker, desc: "" };
            return (
              <button
                key={worker}
                type="button"
                onClick={() => toggleWorker.mutate({ worker, enabled: !enabled })}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  enabled
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-surface-300 bg-surface-50 opacity-75"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-surface-900">{meta.title}</span>
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      enabled ? "bg-emerald-500" : "bg-surface-400"
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs text-surface-600">{meta.desc}</p>
                <p className={`mt-2 text-xs font-semibold ${enabled ? "text-emerald-700" : "text-surface-500"}`}>
                  {enabled ? "ACTIF" : "COUPÉ"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Types & Catégories de contact */}
      <a
        href="/settings/contact-types"
        className="card flex items-center justify-between gap-4 transition hover:border-brand-300 hover:bg-brand-50/30"
      >
        <div>
          <h3 className="text-lg font-semibold text-surface-900">Types & Catégories de contact</h3>
          <p className="mt-1 text-sm text-surface-600">
            Gère la correspondance entre les types de contact (ex. <em>youtubeur</em>, <em>journaliste</em>)
            et les catégories canoniques (blogger, media, influencer…). Ajoute tes propres synonymes.
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
          Gérer →
        </span>
      </a>

      {/* Outreach Config */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveOutreachMutation.mutate(outreachConfig);
        }}
        className="card space-y-4"
      >
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            Variables d'Outreach
          </h3>
          <p className="mt-1 text-sm text-surface-600">
            Ces informations sont utilisées pour personnaliser les templates de formulaires de contact
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Your Name */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-700">
              <User size={16} className="text-surface-400" />
              Votre Nom
            </label>
            <input
              type="text"
              value={outreachConfig.yourName}
              onChange={(e) =>
                setOutreachConfig({ ...outreachConfig, yourName: e.target.value })
              }
              className="input-field"
              placeholder="William Julian"
            />
            <p className="mt-1 text-xs text-surface-500">
              Variable : <code className="rounded bg-surface-100 px-1">{"{yourName}"}</code>
            </p>
          </div>

          {/* Your Company */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-700">
              <Building2 size={16} className="text-surface-400" />
              Votre Entreprise
            </label>
            <input
              type="text"
              value={outreachConfig.yourCompany}
              onChange={(e) =>
                setOutreachConfig({ ...outreachConfig, yourCompany: e.target.value })
              }
              className="input-field"
              placeholder="SOS Expat"
            />
            <p className="mt-1 text-xs text-surface-500">
              Variable : <code className="rounded bg-surface-100 px-1">{"{yourCompany}"}</code>
            </p>
          </div>

          {/* Your Website */}
          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-700">
              <Globe size={16} className="text-surface-400" />
              Votre Site Web
            </label>
            <input
              type="url"
              value={outreachConfig.yourWebsite}
              onChange={(e) =>
                setOutreachConfig({ ...outreachConfig, yourWebsite: e.target.value })
              }
              className="input-field"
              placeholder="https://sos-expat.com"
            />
            <p className="mt-1 text-xs text-surface-500">
              Variable : <code className="rounded bg-surface-100 px-1">{"{yourWebsite}"}</code>
            </p>
          </div>

          {/* Contact Email */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-700">
              <Mail size={16} className="text-surface-400" />
              Email de Contact
            </label>
            <input
              type="email"
              value={outreachConfig.contactEmail}
              onChange={(e) =>
                setOutreachConfig({ ...outreachConfig, contactEmail: e.target.value })
              }
              className="input-field"
              placeholder="contact@sos-expat.com"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-700">
              <Phone size={16} className="text-surface-400" />
              Téléphone
            </label>
            <input
              type="tel"
              value={outreachConfig.contactPhone}
              onChange={(e) =>
                setOutreachConfig({ ...outreachConfig, contactPhone: e.target.value })
              }
              className="input-field"
              placeholder="+33 6 12 34 56 78"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-surface-700">
            Aperçu des Variables
          </h4>
          <div className="space-y-1 text-xs text-surface-600">
            <div className="flex gap-2">
              <code className="rounded bg-white px-2 py-1">{"{yourName}"}</code>
              <span>→</span>
              <span className="font-medium">{outreachConfig.yourName || "(vide)"}</span>
            </div>
            <div className="flex gap-2">
              <code className="rounded bg-white px-2 py-1">{"{yourCompany}"}</code>
              <span>→</span>
              <span className="font-medium">{outreachConfig.yourCompany || "(vide)"}</span>
            </div>
            <div className="flex gap-2">
              <code className="rounded bg-white px-2 py-1">{"{yourWebsite}"}</code>
              <span>→</span>
              <span className="font-medium">{outreachConfig.yourWebsite || "(vide)"}</span>
            </div>
            <div className="flex gap-2">
              <code className="rounded bg-white px-2 py-1">{"{siteName}"}</code>
              <span>→</span>
              <span className="text-surface-400">(Nom du site du prospect)</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saveOutreachMutation.isPending}
          className="btn-primary w-full"
        >
          <Save size={16} />
          {saveOutreachMutation.isPending ? "Sauvegarde..." : "Sauvegarder Outreach"}
        </button>
      </form>

      {/* Telegram Notifications */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveTelegramMutation.mutate(telegramConfig);
        }}
        className="card space-y-4"
      >
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-surface-900">
            <MessageCircle size={20} className="text-blue-500" />
            Notifications Telegram
          </h3>
          <p className="mt-1 text-sm text-surface-600">
            Recevez des alertes Telegram en temps réel pour vos prospects et backlinks
          </p>
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">📋 Comment configurer :</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Créez un bot avec <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline font-medium">@BotFather</a> sur Telegram</li>
            <li>Copiez le <strong>Bot Token</strong> fourni par BotFather</li>
            <li>Démarrez une conversation avec votre bot</li>
            <li>Obtenez votre <strong>Chat ID</strong> en envoyant un message à <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline font-medium">@userinfobot</a></li>
          </ol>
        </div>

        <div className="grid gap-4">
          {/* Enabled Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-50 p-4">
            <div>
              <label className="text-sm font-medium text-surface-700">
                Activer les notifications Telegram
              </label>
              <p className="text-xs text-surface-500">
                Recevoir des alertes pour les événements sélectionnés
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setTelegramConfig({
                  ...telegramConfig,
                  enabled: !telegramConfig.enabled,
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                telegramConfig.enabled ? "bg-brand-600" : "bg-surface-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  telegramConfig.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Bot Token */}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              Bot Token
            </label>
            <input
              type="password"
              value={telegramConfig.botToken}
              onChange={(e) =>
                setTelegramConfig({ ...telegramConfig, botToken: e.target.value })
              }
              className="input-field font-mono text-xs"
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            />
          </div>

          {/* Chat ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              Chat ID
            </label>
            <input
              type="text"
              value={telegramConfig.chatId}
              onChange={(e) =>
                setTelegramConfig({ ...telegramConfig, chatId: e.target.value })
              }
              className="input-field font-mono"
              placeholder="123456789"
            />
          </div>

          {/* Events */}
          <div>
            <label className="mb-2 block text-sm font-medium text-surface-700">
              Événements à notifier
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-lg border border-surface-200 bg-white p-3 cursor-pointer hover:bg-surface-50">
                <input
                  type="checkbox"
                  checked={telegramConfig.events.prospectReplied}
                  onChange={(e) =>
                    setTelegramConfig({
                      ...telegramConfig,
                      events: {
                        ...telegramConfig.events,
                        prospectReplied: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <div className="text-sm font-medium text-surface-900">
                    🎉 Prospect intéressé
                  </div>
                  <div className="text-xs text-surface-500">
                    Quand un prospect répond à votre campagne
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-surface-200 bg-white p-3 cursor-pointer hover:bg-surface-50">
                <input
                  type="checkbox"
                  checked={telegramConfig.events.prospectWon}
                  onChange={(e) =>
                    setTelegramConfig({
                      ...telegramConfig,
                      events: {
                        ...telegramConfig.events,
                        prospectWon: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <div className="text-sm font-medium text-surface-900">
                    ✅ Deal conclu
                  </div>
                  <div className="text-xs text-surface-500">
                    Quand un prospect accepte le partenariat
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-surface-200 bg-white p-3 cursor-pointer hover:bg-surface-50">
                <input
                  type="checkbox"
                  checked={telegramConfig.events.backlinkLost}
                  onChange={(e) =>
                    setTelegramConfig({
                      ...telegramConfig,
                      events: {
                        ...telegramConfig.events,
                        backlinkLost: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <div className="text-sm font-medium text-surface-900">
                    ⚠️ Backlink perdu
                  </div>
                  <div className="text-xs text-surface-500">
                    Quand un lien n'est plus présent sur la page
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-surface-200 bg-white p-3 cursor-pointer hover:bg-surface-50">
                <input
                  type="checkbox"
                  checked={telegramConfig.events.backlinkVerified}
                  onChange={(e) =>
                    setTelegramConfig({
                      ...telegramConfig,
                      events: {
                        ...telegramConfig.events,
                        backlinkVerified: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <div className="text-sm font-medium text-surface-900">
                    ✅ Backlink vérifié
                  </div>
                  <div className="text-xs text-surface-500">
                    Quand un lien est actif et vérifié (optionnel)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saveTelegramMutation.isPending}
            className="btn-primary flex-1"
          >
            <Save size={16} />
            {saveTelegramMutation.isPending ? "Sauvegarde..." : "Sauvegarder Telegram"}
          </button>
          <button
            type="button"
            onClick={() => sendTestTelegramMutation.mutate()}
            disabled={sendTestTelegramMutation.isPending || !telegramConfig.botToken || !telegramConfig.chatId}
            className="btn-outline flex items-center gap-2"
          >
            <Send size={16} />
            {sendTestTelegramMutation.isPending ? "Envoi..." : "Envoyer Test"}
          </button>
        </div>
      </form>

      {/* Other Settings */}
      <form onSubmit={handleSubmit} className="space-y-8">
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
              value={settings.mailwizz?.apiUrl || ""}
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
              value={settings.mailwizz?.apiKey || ""}
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

      {/* AI */}
      <section className="card space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-surface-900">
          <Bot size={20} />
          {t("settings.aiConfig")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-surface-700">
              {t("settings.aiEnabled")}
            </label>
            <button
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, enabled: !settings.ai.enabled },
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                settings.ai.enabled ? "bg-brand-600" : "bg-surface-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.ai.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.aiProvider")}
            </label>
            <select
              value={settings.ai.provider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, provider: e.target.value },
                })
              }
              className="input-field"
            >
              <option value="openai">OpenAI (GPT-4o-mini)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("settings.aiApiKey")}
            </label>
            <input
              type="password"
              value={settings.ai.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, apiKey: e.target.value },
                })
              }
              className="input-field"
              placeholder="sk-..."
            />
          </div>
        </div>
      </section>

      {/* Sending Domains + DNS check */}
      <SendingDomainsSection />

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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sending Domains + DNS check section
// ─────────────────────────────────────────────────────────────

interface SendingDomain {
  domain: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  active: boolean;
}

interface DnsRecord {
  ok: boolean;
  value: string | null;
  selector?: string;
}

interface DnsCheckResult {
  domain: string;
  spf: DnsRecord;
  dkim: DnsRecord;
  dmarc: DnsRecord;
  allOk: boolean;
}

function SendingDomainsSection() {
  const queryClient = useQueryClient();

  const domainsQuery = useQuery<{ data: SendingDomain[] }>({
    queryKey: ["sending-domains"],
    queryFn: async () => (await api.get("/settings/sending-domains")).data,
  });

  const dnsQuery = useQuery<{ data: DnsCheckResult[] }>({
    queryKey: ["sending-domains-dns"],
    queryFn: async () => (await api.get("/settings/sending-domains/dns-check")).data,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (domains: SendingDomain[]) => {
      await api.put("/settings/sending-domains", { domains });
    },
    onSuccess: () => {
      toast.success("Domaines enregistres");
      queryClient.invalidateQueries({ queryKey: ["sending-domains"] });
      queryClient.invalidateQueries({ queryKey: ["sending-domains-dns"] });
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const [draft, setDraft] = useState<SendingDomain[]>([]);

  useEffect(() => {
    if (domainsQuery.data?.data) setDraft(domainsQuery.data.data);
  }, [domainsQuery.data]);

  const domains = draft.length ? draft : (domainsQuery.data?.data ?? []);
  const dnsByDomain: Record<string, DnsCheckResult> = {};
  for (const r of dnsQuery.data?.data ?? []) dnsByDomain[r.domain] = r;

  function updateDomain(i: number, patch: Partial<SendingDomain>) {
    setDraft((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function addDomain() {
    setDraft((prev) => [
      ...prev,
      { domain: "", fromEmail: "", fromName: "SOS Expat", replyTo: "replies@life-expat.com", active: true },
    ]);
  }

  function removeDomain(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-surface-900">
          <Globe size={20} /> Domaines d'envoi & DNS
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => dnsQuery.refetch()}
            className="text-xs rounded-lg border border-surface-300 px-3 py-1.5 hover:bg-surface-50"
          >
            {dnsQuery.isFetching ? "Verification…" : "Revérifier DNS"}
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate(draft)}
            disabled={saveMutation.isPending}
            className="text-xs rounded-lg bg-brand-600 text-white px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Enregistrement…" : "Enregistrer les domaines"}
          </button>
        </div>
      </div>

      <p className="text-xs text-surface-500">
        Ces domaines tournent en round-robin pour tous les envois (outreach + broadcast).
        Warmup géré au niveau PMTA/Mailflow. DNS attendu : SPF, DKIM (sélecteur <code>dkim</code>), DMARC.
      </p>

      {domains.length === 0 && (
        <p className="text-sm text-surface-400 italic">Aucun domaine configuré.</p>
      )}

      <div className="space-y-3">
        {domains.map((d, i) => {
          const dns = dnsByDomain[d.domain];
          return (
            <div key={i} className="rounded-lg border border-surface-200 bg-white p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <input
                  value={d.domain}
                  onChange={(e) => updateDomain(i, { domain: e.target.value })}
                  placeholder="domain.com"
                  className="input-field text-sm"
                />
                <input
                  value={d.fromEmail}
                  onChange={(e) => updateDomain(i, { fromEmail: e.target.value })}
                  placeholder="contact@domain.com"
                  className="input-field text-sm"
                />
                <input
                  value={d.fromName}
                  onChange={(e) => updateDomain(i, { fromName: e.target.value })}
                  placeholder="SOS Expat"
                  className="input-field text-sm"
                />
                <input
                  value={d.replyTo}
                  onChange={(e) => updateDomain(i, { replyTo: e.target.value })}
                  placeholder="replies@life-expat.com"
                  className="input-field text-sm"
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-surface-600">
                    <input
                      type="checkbox"
                      checked={d.active}
                      onChange={(e) => updateDomain(i, { active: e.target.checked })}
                    />
                    Actif
                  </label>
                  <button
                    type="button"
                    onClick={() => removeDomain(i)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              {dns ? (
                <div className="flex flex-wrap gap-3 text-xs pt-1 border-t border-surface-100">
                  <span className={dns.spf.ok ? "text-emerald-600" : "text-red-600"}>
                    {dns.spf.ok ? "✅ SPF" : "❌ SPF manquant"}
                  </span>
                  <span className={dns.dkim.ok ? "text-emerald-600" : "text-red-600"}>
                    {dns.dkim.ok ? "✅ DKIM (dkim._domainkey)" : "❌ DKIM manquant (sélecteur: dkim)"}
                  </span>
                  <span className={dns.dmarc.ok ? "text-emerald-600" : "text-red-600"}>
                    {dns.dmarc.ok ? "✅ DMARC" : "❌ DMARC manquant"}
                  </span>
                  {!dns.allOk && (
                    <span className="text-xs text-surface-400">
                      → ajoute les enregistrements TXT manquants chez ton registrar DNS
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-surface-400">DNS non vérifié encore.</p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addDomain}
        className="text-xs rounded-lg border border-dashed border-surface-300 px-3 py-2 text-surface-600 hover:bg-surface-50"
      >
        + Ajouter un domaine
      </button>
    </section>
  );
}
