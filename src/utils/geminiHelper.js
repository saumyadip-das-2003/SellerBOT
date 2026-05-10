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
You are an AI assistant for a Bangladeshi F-commerce (Facebook/WhatsApp) seller.

A customer sent an unstructured chat message.
Extract order information accurately.

Language: May be Bangla, English, or Banglish.

KEY BANGLISH PATTERNS:
Name patterns:
- "ami X" = I am X → name is X
- "ami X," = I am X → name is X (ignore comma)
- "amar nam X" = my name is X
- "ami X boltesi" = I am saying, I am X
- Never include vai/bhai/apu/apa/ভাই in name

Location patterns:
- "X e thaki" = I live in X → address is X
- "X te thaki" = I live in X → address is X
- "X theke" = from X → address is X
- "X e achi" = I am in X → address is X
- "X তে থাকি" = I live in X
- Extract X as the address

Quantity patterns:
- "Xta" = X pieces (2ta=2, 3ta=3)
- "X piece/pcs/nos" = X pieces
- "ekta/একটা" = 1
- "duita/দুইটা" = 2
- "tinta/তিনটা" = 3
- "ar/and/+" separates multiple products
  "2ta shirt ar 1ta pant" = shirt:2, pant:1

Payment patterns:
- "bkash/bikash/বিকাশ korbo/dibo" = bKash
- "nagad/নগদ e dibo" = Nagad
- "rocket" = Rocket
- "cash/cod" = COD

SELLER PRODUCTS: ${productList}
DELIVERY ZONES: ${zoneList}

CUSTOMER CHAT:
"""
${chatText}
"""

RULES:
1. Extract customer name WITHOUT vai/bhai/apu/apa
2. Extract full address EXACTLY as mentioned
3. Match each product to closest in catalog
4. Quantity must be per product separately
5. If something not found → use null

Return ONLY valid JSON, no explanation:
{
  "customerName": "string or null",
  "phone": "11 digit string or null",
  "address": "full address string or null",
  "zone": "zone name from list or null",
  "products": [
    {
      "productName": "matched catalog name",
      "quantity": number
    }
  ],
  "paymentMethod": "COD|bKash|Nagad|Rocket|Bank|Other",
  "deliveryPaymentMethod": "COD|bKash|Nagad|Rocket|Bank|Other|null",
  "transactionId": "string or null",
  "notes": "string or null"
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
