import { GoogleGenerativeAI } from "@google/generative-ai"

function getModel() {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    console.warn("Gemini API key not set. AI fallback disabled.")
    return null
  }
  return new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY).getGenerativeModel({ model: "gemini-1.5-flash" })
}

export async function convertToStructured(chatText, productCatalog = [], zones = []) {
  const model = getModel()
  if (!model) return null

  const productList = productCatalog.map((p) => `${p.name}${p.banglaName ? "/" + p.banglaName : ""}`).join(", ")
  const zoneList = zones.map((z) => z.area).join(", ")
  const prompt = `
You are helping a Bangladeshi online seller process customer orders from Facebook/WhatsApp chat.

The customer sent an UNSTRUCTURED message. Your job is to:
1. Read and understand the message (may be Bangla/English/Banglish)
2. Extract all order information
3. Return it as a STRUCTURED format

SELLER'S PRODUCTS: ${productList}
DELIVERY ZONES: ${zoneList}

BANGLISH PATTERNS:
- "ami X / আমি X" = customer name is X
- "amar nam X" = customer name is X
- "Xta/Xটা/X pcs/X piece/X nos" = quantity is X
- "ekta=1, duita=2, tinta=3, charta=4, pachta=5"
- "lagbe/চাই/নেব" = want to order
- "pathaben/পাঠাবেন" = please send
- "bkash/বিকাশ/nagad/নগদ/rocket" = payment method
- "vai/bhai/apu/apa/ভাই/আপু" = NOT part of name

UNSTRUCTURED CHAT:
"""
${chatText}
"""

Return ONLY a valid JSON object. No explanation. No markdown.

{
  "customerName": "string or null",
  "phone": "11 digit string or null",
  "address": "complete address exactly as mentioned or null",
  "zone": "closest matching zone from list or null",
  "products": [{ "productName": "best match from catalog", "quantity": 1 }],
  "paymentMethod": "COD or bKash or Nagad or Rocket or Bank or Other",
  "deliveryPaymentMethod": "same or different from above or null",
  "transactionId": "string or null",
  "notes": "special instructions or null"
}
`
  try {
    const result = await model.generateContent(prompt)
    const cleaned = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim()
    return JSON.parse(cleaned)
  } catch (err) {
    console.error("Gemini pre-processor failed:", err)
    return null
  }
}

export async function extractWithGemini(chatText, missingFields, productCatalog) {
  const model = getModel()
  if (!model) return {}
  const productNames = productCatalog.slice(0, 20).map((p) => p.name + (p.banglaName ? "/" + p.banglaName : "")).join(", ")
  const prompt = `Extract ONLY these missing fields: ${missingFields.join(", ")}\nProducts: ${productNames}\nChat:\n${chatText}\nReturn ONLY valid JSON.`
  try {
    const result = await model.generateContent(prompt)
    return JSON.parse(result.response.text().replace(/```json|```/g, "").trim())
  } catch (error) {
    console.error("Gemini extraction failed:", error)
    return {}
  }
}
