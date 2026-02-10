import { useTranslation, type Lang } from "@/i18n";

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="flex items-center rounded-lg border border-surface-200 bg-surface-50 text-xs font-medium">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`px-2.5 py-1.5 transition-colors ${
            lang === code
              ? "bg-brand-600 text-white rounded-lg"
              : "text-surface-500 hover:text-surface-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
