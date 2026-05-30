import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "../firebase/config.js"

const USAGE_KEY = "sellerbot-ai-usage"
const DEFAULT_USAGE = {
  tokenLimit: 0,
  remainingTokens: 0,
  usedTokens: 0,
  requestLimit: 0,
  remainingRequests: 0,
  usedRequests: 0,
  resetTokens: "",
  resetRequests: "",
  model: "",
  updatedAt: "",
  source: "Groq headers",
}

export function getStoredAIUsage() {
  try {
    return { ...DEFAULT_USAGE, ...JSON.parse(localStorage.getItem(USAGE_KEY) || "{}") }
  } catch {
    return DEFAULT_USAGE
  }
}

export function saveAIUsage(usage) {
  const next = { ...getStoredAIUsage(), ...usage, updatedAt: new Date().toISOString() }
  localStorage.setItem(USAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("sellerbot-ai-usage-updated", { detail: next }))
  return next
}

export function updateGroqUsageFromHeaders(headers, model = "") {
  if (!headers) return getStoredAIUsage()
  const tokenLimit = numberHeader(headers, "x-ratelimit-limit-tokens")
  const remainingTokens = numberHeader(headers, "x-ratelimit-remaining-tokens")
  const requestLimit = numberHeader(headers, "x-ratelimit-limit-requests")
  const remainingRequests = numberHeader(headers, "x-ratelimit-remaining-requests")
  const resetTokens = headers.get("x-ratelimit-reset-tokens") || ""
  const resetRequests = headers.get("x-ratelimit-reset-requests") || ""

  if (!tokenLimit && !remainingTokens && !requestLimit && !remainingRequests && !resetTokens && !resetRequests) {
    return getStoredAIUsage()
  }

  return saveAIUsage({
    tokenLimit,
    remainingTokens,
    usedTokens: Math.max(0, tokenLimit - remainingTokens),
    requestLimit,
    remainingRequests,
    usedRequests: Math.max(0, requestLimit - remainingRequests),
    resetTokens,
    resetRequests,
    model,
  })
}

export async function getAISettings(uid) {
  if (!uid) return {}
  try {
    const snap = await getDoc(doc(db, "users", uid, "settings", "ai"))
    return snap.exists() ? snap.data() : {}
  } catch (error) {
    console.error("Could not load AI settings:", error)
    return {}
  }
}

export async function saveAISettings(uid, settings) {
  if (!uid) throw new Error("Missing user")
  await setDoc(doc(db, "users", uid, "settings", "ai"), {
    groqApiKey: settings.groqApiKey || "",
    groqModel: settings.groqModel || "",
    maxTokens: Number(settings.maxTokens || 800),
    updatedAt: new Date(),
  }, { merge: true })
}

function numberHeader(headers, name) {
  const value = headers.get(name)
  if (!value) return 0
  const parsed = Number(String(value).replace(/[^0-9.]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}
