import { useEffect, useMemo, useState } from "react"
import { Activity, KeyRound, RefreshCw, Save, ShieldAlert } from "lucide-react"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext.jsx"
import { useLanguage } from "../context/LanguageContext.jsx"
import { DEFAULT_GROQ_MODEL, GROQ_MODEL_OPTIONS, getAISettings, getDisplayAIUsage, getStoredAIUsage, saveAISettings } from "../utils/aiUsage.js"

const aiUsageCopy = {
  en: {
    eyebrow: "AI Usage",
    title: "AI Token Usage",
    subtitle: "Track Groq rate limits and let each seller use their own API key.",
    tokenLimit: "Token Limit",
    requestLimit: "Request Limit",
    snapshotTitle: "Current AI Limit Snapshot",
    snapshotText: "This updates after each unstructured AI parse. Groq resets token limits per minute.",
    lastUpdated: "Last updated",
    source: "Source",
    reset: "Reset",
    estimated: "Estimated from selected model",
    perMinute: "per minute",
    settingsTitle: "Personal Groq API Settings",
    settingsText: "If saved, SellerBot will use this seller's key for AI parsing instead of the app fallback key.",
    warning: "For this prototype, the key is saved in this seller's Firestore settings. Use Firebase rules so users can only read their own settings.",
    apiKey: "Groq API Key",
    status: "Status",
    personalKey: "Personal key active",
    fallbackKey: "Using app fallback key",
    noKey: "No key configured",
    model: "Groq Model",
    modelHelp: "Limit shown below uses this selected model. Browser mode estimates usage when Groq hides real headers.",
    maxTokens: "Max Output Tokens Per Parse",
    saving: "Saving...",
    save: "Save AI Settings",
    hide: "Hide",
    show: "Show",
    noModel: "No model yet",
    noData: "No data yet",
    used: "used",
    remaining: "remaining",
    tokens: "tokens",
    requests: "requests",
    unknown: "Unknown",
    saved: "AI settings saved.",
    saveError: "Could not save AI settings.",
  },
  bn: {
    eyebrow: "AI \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0",
    title: "AI \u099f\u09cb\u0995\u09c7\u09a8 \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0",
    subtitle: "Groq \u09b2\u09bf\u09ae\u09bf\u099f \u09a6\u09c7\u0996\u09c1\u09a8 \u098f\u09ac\u0982 \u09aa\u09cd\u09b0\u09a4\u09bf \u09b8\u09c7\u09b2\u09be\u09b0\u0995\u09c7 \u09a8\u09bf\u099c\u09c7\u09b0 API \u0995\u09bf \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0 \u0995\u09b0\u09a4\u09c7 \u09a6\u09bf\u09a8\u0964",
    tokenLimit: "\u099f\u09cb\u0995\u09c7\u09a8 \u09b2\u09bf\u09ae\u09bf\u099f",
    requestLimit: "\u09b0\u09bf\u0995\u09cb\u09af\u09bc\u09c7\u09b8\u09cd\u099f \u09b2\u09bf\u09ae\u09bf\u099f",
    snapshotTitle: "\u09ac\u09b0\u09cd\u09a4\u09ae\u09be\u09a8 AI \u09b2\u09bf\u09ae\u09bf\u099f \u09b8\u09cd\u09a8\u09cd\u09af\u09be\u09aa\u09b6\u099f",
    snapshotText: "\u09aa\u09cd\u09b0\u09a4\u09bf \u0986\u09a8\u09b8\u09cd\u099f\u09cd\u09b0\u09be\u0995\u099a\u09be\u09b0\u09cd\u09a1 AI \u09aa\u09be\u09b0\u09cd\u09b8\u09c7\u09b0 \u09aa\u09b0 \u098f\u099f\u09bf \u0986\u09aa\u09a1\u09c7\u099f \u09b9\u09af\u09bc\u0964 Groq \u09aa\u09cd\u09b0\u09a4\u09bf \u09ae\u09bf\u09a8\u09bf\u099f\u09c7 \u09b2\u09bf\u09ae\u09bf\u099f \u09b0\u09bf\u09b8\u09c7\u099f \u0995\u09b0\u09c7\u0964",
    lastUpdated: "\u09b6\u09c7\u09b7 \u0986\u09aa\u09a1\u09c7\u099f",
    source: "\u09b8\u09cb\u09b0\u09cd\u09b8",
    reset: "\u09b0\u09bf\u09b8\u09c7\u099f",
    estimated: "\u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u099a\u09bf\u09a4 \u09ae\u09a1\u09c7\u09b2 \u09a5\u09c7\u0995\u09c7 \u0985\u09a8\u09c1\u09ae\u09be\u09a8",
    perMinute: "\u09aa\u09cd\u09b0\u09a4\u09bf \u09ae\u09bf\u09a8\u09bf\u099f\u09c7",
    settingsTitle: "\u09aa\u09be\u09b0\u09cd\u09b8\u09cb\u09a8\u09be\u09b2 Groq API \u09b8\u09c7\u099f\u09bf\u0982\u09b8",
    settingsText: "\u09b8\u09c7\u09ad \u0995\u09b0\u09be \u09b9\u09b2\u09c7 SellerBot \u0985\u09cd\u09af\u09be\u09aa\u09c7\u09b0 \u09ab\u09b2\u09ac\u09cd\u09af\u09be\u0995 \u0995\u09bf\u09b0 \u09ac\u09a6\u09b2\u09c7 \u098f\u0987 \u09b8\u09c7\u09b2\u09be\u09b0\u09c7\u09b0 \u0995\u09bf \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0 \u0995\u09b0\u09ac\u09c7\u0964",
    warning: "\u09aa\u09cd\u09b0\u09cb\u099f\u09cb\u099f\u09be\u0987\u09aa\u09c7 \u0995\u09bf\u099f\u09bf \u098f\u0987 \u09b8\u09c7\u09b2\u09be\u09b0\u09c7\u09b0 Firestore \u09b8\u09c7\u099f\u09bf\u0982\u09b8\u09c7 \u09b8\u09c7\u09ad \u09b9\u09af\u09bc\u0964 Firebase rules \u09a0\u09bf\u0995 \u09b0\u09be\u0996\u09c1\u09a8 \u09af\u09be\u09a4\u09c7 \u09af\u09c2\u099c\u09be\u09b0 \u09b6\u09c1\u09a7\u09c1 \u09a8\u09bf\u099c\u09c7\u09b0 \u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u09aa\u09a1\u09bc\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u0964",
    apiKey: "Groq API \u0995\u09bf",
    status: "\u09b8\u09cd\u099f\u09cd\u09af\u09be\u099f\u09be\u09b8",
    personalKey: "\u09aa\u09be\u09b0\u09cd\u09b8\u09cb\u09a8\u09be\u09b2 \u0995\u09bf \u099a\u09be\u09b2\u09c1",
    fallbackKey: "\u0985\u09cd\u09af\u09be\u09aa \u09ab\u09b2\u09ac\u09cd\u09af\u09be\u0995 \u0995\u09bf \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0 \u09b9\u099a\u09cd\u099b\u09c7",
    noKey: "\u0995\u09cb\u09a8\u09cb \u0995\u09bf \u09b8\u09c7\u099f \u0995\u09b0\u09be \u09a8\u09c7\u0987",
    model: "Groq \u09ae\u09a1\u09c7\u09b2",
    modelHelp: "\u09b2\u09bf\u09ae\u09bf\u099f \u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u099a\u09bf\u09a4 \u09ae\u09a1\u09c7\u09b2 \u0985\u09a8\u09c1\u09af\u09be\u09af\u09bc\u09c0 \u09a6\u09c7\u0996\u09be\u09af\u09bc\u0964 Groq \u09b9\u09c7\u09a1\u09be\u09b0 \u09b2\u09c1\u0995\u09bf\u09af\u09bc\u09c7 \u09b0\u09be\u0996\u09b2\u09c7 \u09ac\u09cd\u09b0\u09be\u0989\u099c\u09be\u09b0 \u0985\u09a8\u09c1\u09ae\u09be\u09a8 \u0995\u09b0\u09c7\u0964",
    maxTokens: "\u09aa\u09cd\u09b0\u09a4\u09bf \u09aa\u09be\u09b0\u09cd\u09b8\u09c7 \u09ae\u09cd\u09af\u09be\u0995\u09cd\u09b8 \u0986\u0989\u099f\u09aa\u09c1\u099f \u099f\u09cb\u0995\u09c7\u09a8",
    saving: "\u09b8\u09c7\u09ad \u09b9\u099a\u09cd\u099b\u09c7...",
    save: "AI \u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u09b8\u09c7\u09ad \u0995\u09b0\u09c1\u09a8",
    hide: "\u09b2\u09c1\u0995\u09be\u09a8",
    show: "\u09a6\u09c7\u0996\u09be\u09a8",
    noModel: "\u098f\u0996\u09a8\u0993 \u0995\u09cb\u09a8\u09cb \u09ae\u09a1\u09c7\u09b2 \u09a8\u09c7\u0987",
    noData: "\u098f\u0996\u09a8\u0993 \u09a1\u09be\u099f\u09be \u09a8\u09c7\u0987",
    used: "\u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0",
    remaining: "\u09ac\u09be\u0995\u09bf",
    tokens: "\u099f\u09cb\u0995\u09c7\u09a8",
    requests: "\u09b0\u09bf\u0995\u09cb\u09af\u09bc\u09c7\u09b8\u09cd\u099f",
    unknown: "\u0985\u099c\u09be\u09a8\u09be",
    saved: "AI \u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u09b8\u09c7\u09ad \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    saveError: "AI \u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u09b8\u09c7\u09ad \u0995\u09b0\u09be \u09af\u09be\u09af\u09bc\u09a8\u09bf\u0964",
  },
}

function AIUsage() {
  const { currentUser } = useAuth()
  const { language } = useLanguage()
  const copy = aiUsageCopy[language] || aiUsageCopy.en
  const [usage, setUsage] = useState(() => getStoredAIUsage())
  const [form, setForm] = useState({ groqApiKey: "", groqModel: "", maxTokens: 800 })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const displayUsage = getDisplayAIUsage(usage, form.groqModel || DEFAULT_GROQ_MODEL)
  const tokenPercent = percent(displayUsage.usedTokens, displayUsage.tokenLimit)
  const requestPercent = percent(displayUsage.usedRequests, displayUsage.requestLimit)

  useEffect(() => {
    if (!currentUser?.uid) return undefined
    getAISettings(currentUser.uid).then((settings) => setForm({
      groqApiKey: settings.groqApiKey || "",
      groqModel: settings.groqModel || import.meta.env.VITE_GROQ_MODEL || DEFAULT_GROQ_MODEL,
      maxTokens: settings.maxTokens || Number(import.meta.env.VITE_GROQ_MAX_COMPLETION_TOKENS || 800),
    }))
    const onUsage = (event) => setUsage(event.detail || getStoredAIUsage())
    const onStorage = () => setUsage(getStoredAIUsage())
    window.addEventListener("sellerbot-ai-usage-updated", onUsage)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("sellerbot-ai-usage-updated", onUsage)
      window.removeEventListener("storage", onStorage)
    }
  }, [currentUser?.uid])

  const keyStatus = useMemo(() => form.groqApiKey ? copy.personalKey : import.meta.env.VITE_GROQ_API_KEY ? copy.fallbackKey : copy.noKey, [form.groqApiKey, copy])

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const save = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      await saveAISettings(currentUser.uid, form)
      toast.success(copy.saved)
    } catch (error) {
      toast.error(error.message || copy.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1D9E75]">{copy.eyebrow}</p>
        <h2 className="text-3xl font-semibold">{copy.title}</h2>
        <p className="text-sm text-slate-600">{copy.subtitle}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <UsageCard title={copy.tokenLimit} icon={Activity} used={displayUsage.usedTokens} limit={displayUsage.tokenLimit} remaining={displayUsage.remainingTokens} reset={displayUsage.resetTokens} percent={tokenPercent} unit={copy.tokens} copy={copy} />
        <UsageCard title={copy.requestLimit} icon={RefreshCw} used={displayUsage.usedRequests} limit={displayUsage.requestLimit} remaining={displayUsage.remainingRequests} reset={displayUsage.resetRequests} percent={requestPercent} unit={copy.requests} copy={copy} />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">{copy.snapshotTitle}</h3>
            <p className="text-sm text-slate-600">{copy.snapshotText}</p>
          </div>
          <span className="badge badge-blue">{displayUsage.model || form.groqModel || copy.noModel}</span>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Info label={copy.lastUpdated} value={displayUsage.updatedAt ? new Date(displayUsage.updatedAt).toLocaleString() : copy.estimated} />
          <Info label={copy.source} value={displayUsage.source || "estimated"} />
          <Info label={copy.reset} value={displayUsage.resetTokens || displayUsage.resetRequests || copy.perMinute} />
        </div>
      </div>

      <form className="card space-y-4" onSubmit={save}>
        <div className="flex items-start gap-3">
          <KeyRound className="mt-1 h-5 w-5 text-[#1D9E75]" />
          <div>
            <h3 className="text-lg font-semibold">{copy.settingsTitle}</h3>
            <p className="text-sm text-slate-600">{copy.settingsText}</p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="mr-2 inline h-4 w-4" />{copy.warning}
        </div>
        <label>
          <span>{copy.apiKey}</span>
          <div className="mt-2 flex gap-2">
            <input type={showKey ? "text" : "password"} value={form.groqApiKey} onChange={(event) => update("groqApiKey", event.target.value)} placeholder="gsk_..." autoComplete="off" />
            <button className="btn-outline" type="button" onClick={() => setShowKey((current) => !current)}>{showKey ? copy.hide : copy.show}</button>
          </div>
          <span className="mt-1 block text-xs text-slate-500">{copy.status}: {keyStatus}</span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label><span>{copy.model}</span><select value={form.groqModel || DEFAULT_GROQ_MODEL} onChange={(event) => update("groqModel", event.target.value)}>{GROQ_MODEL_OPTIONS.map((model) => <option key={model.value} value={model.value}>{model.label} - {model.description}</option>)}</select><span className="mt-1 block text-xs text-slate-500">{copy.modelHelp}</span></label>
          <label><span>{copy.maxTokens}</span><input type="number" min="100" max="4000" value={form.maxTokens} onChange={(event) => update("maxTokens", event.target.value)} /></label>
        </div>
        <button className="btn-primary" type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? copy.saving : copy.save}</button>
      </form>
    </section>
  )
}

function UsageCard({ title, icon: Icon, used, limit, remaining, reset, percent, unit, copy }) {
  const barClass = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-[#1D9E75]"
  const width = Math.min(100, percent) + "%"
  return <div className="card space-y-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{title}</p><h3 className="mt-1 text-2xl font-bold">{limit ? used + " / " + limit : copy.noData}</h3></div><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D9E75]/10 text-[#1D9E75]"><Icon className="h-5 w-5" /></div></div><div className="h-4 overflow-hidden rounded-full bg-slate-100"><div className={"h-full rounded-full " + barClass} style={{ width }} /></div><div className="flex flex-wrap justify-between gap-3 text-sm text-slate-600"><span>{percent}% {copy.used}</span><span>{remaining || 0} {unit} {copy.remaining}</span><span>{copy.reset}: {reset || copy.unknown}</span></div></div>
}
function Info({ label, value }) { return <div className="rounded-lg bg-[var(--bg-secondary)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div> }
function percent(used, limit) { return limit ? Math.round((Number(used || 0) / Number(limit)) * 100) : 0 }

export default AIUsage
