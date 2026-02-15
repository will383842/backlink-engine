import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Bot, User, Building2, Globe, Mail, Phone, MessageCircle, Send } from "lucide-react";
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
    if (data) setSettings(data);
  }, [data]);

  useEffect(() => {
    if (outreachData?.data) {
      setOutreachConfig(outreachData.data);
    }
  }, [outreachData]);

  useEffect(() => {
    if (telegramData?.data) {
      setTelegramConfig(telegramData.data);
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
    <div className="mx-auto max-w-3xl space-y-8">
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
