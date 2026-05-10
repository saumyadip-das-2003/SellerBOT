import { fuzzyMatchSingle, matchProducts } from "./fuzzyMatcher.js"
import { detectZone } from "./zoneDetector.js"

export function convertBanglaToEnglish(str = "") {
  const banglaDigits = "০১২৩৪৫৬৭৮৯"
  const englishDigits = "0123456789"
  return String(str).replace(/[০-৯]/g, (d) => englishDigits[banglaDigits.indexOf(d)])
}

const phoneRegex = /(?:\+?88)?01[3-9]\d{8}/g
const nameTriggers = ["নামঃ", "নাম:", "নাম :", "name:", "Name:", "name :", "customer:", "customer :", "nam:", "nam :", "buyer:", "amar nam:", "amar name:"]
const addressTriggers = ["ঠিকানাঃ", "ঠিকানা:", "ঠিকানা :", "address:", "Address:", "address :", "thikana:", "thikana :", "deliver to:", "delivery address:"]
const phoneTriggers = ["মোবাইলঃ", "মোবাইল:", "mobile:", "Mobile:", "mobile :", "phone:", "phone :", "নম্বরঃ", "নাম্বারঃ", "number:", "number :", "contact:", "contact :"]
const itemTriggers = ["আইটেমঃ", "আইটেম:", "item:", "Item:", "item :", "items:", "পণ্যঃ", "পণ্য:", "product:", "Product:", "product :", "ponno:", "ponno :", "order:", "order :", "lagbe:", "লাগবেঃ", "লাগবে:"]
const quantityTriggers = ["পরিমাণঃ", "পরিমাণ:", "পরিমাণ :", "quantity:", "Quantity:", "quantity :", "qty:", "Qty:", "qty :", "poriman:", "poriman :", "পিসঃ", "পিস:"]
const noteTriggers = ["note:", "Note:", "বিশেষ:", "special:", "important:", "please note:", "instruction:"]
const addressWords = ["road", "lane", "street", "village", "gram", "para", "ward", "union", "upazila", "thana", "district", "house", "flat", "floor", "building", "tower", "bazar", "north", "south", "east", "west", "uttar", "dakkhin", "purbo", "paschim"]

const quantityMap = { ekta: 1, "একটা": 1, "একটি": 1, duita: 2, "দুইটা": 2, "দুটো": 2, tinta: 3, "তিনটা": 3, charta: 4, "চারটা": 4, pachta: 5, "পাঁচটা": 5, chota: 6, "ছয়টা": 6, satta: 7, "সাতটা": 7, atta: 8, "আটটা": 8, nota: 9, "নয়টা": 9, dosta: 10, "দশটা": 10 }
const paymentKeywords = { bkash: "bKash", "বিকাশ": "bKash", bikash: "bKash", nagad: "Nagad", "নগদ": "Nagad", rocket: "Rocket", "রকেট": "Rocket", bank: "Bank", "ব্যাংক": "Bank", cash: "COD", "ক্যাশ": "COD", cod: "COD", upay: "uPay", cellfin: "Other" }

export function parseProductQuantityPairs(chatText = "") {
  const lines = chatText.split("\n").map((line) => line.trim())
  const products = []
  let currentProduct = null

  for (const line of lines) {
    const productName = extractAfterAnyTrigger(line, itemTriggers)
    if (productName) {
      if (currentProduct) products.push(currentProduct)
      currentProduct = { productName, quantity: 1 }
      continue
    }

    const qtyText = extractAfterAnyTrigger(line, quantityTriggers)
    if (qtyText && currentProduct) {
      currentProduct.quantity = parseInt(convertBanglaToEnglish(qtyText), 10) || extractQuantity(qtyText)
    }
  }

  if (currentProduct) products.push(currentProduct)
  return products
}

export function parseChat(chatText = "", products = [], zones = []) {
  const convertedText = convertBanglaToEnglish(chatText)
  const lineParsed = parseLines(chatText, convertedText)
  const productPairs = parseProductQuantityPairs(chatText)
  const pairProducts = productPairs.map((pair) => {
    const match = fuzzyMatchSingle(pair.productName, products)
    return { productId: match?.id || "", productName: match?.name || pair.productName, banglaName: match?.banglaName || "", quantity: pair.quantity || 1, unitPrice: match?.price || 0, costPrice: match?.costPrice || 0, totalPrice: (match?.price || 0) * (pair.quantity || 1) }
  })
  const matchedProducts = pairProducts.length ? pairProducts : matchProducts(convertedText, products)
  const address = lineParsed.address || extractAddress(chatText)
  const zone = address ? detectZone(address, zones) : null
  const payment = extractPayment(convertedText)
  const parsedResult = { rawText: chatText, customerName: lineParsed.customerName || extractName(chatText), phone: lineParsed.phone || extractPhone(convertedText), address, products: matchedProducts, paymentMethod: payment.paymentMethod, deliveryPaymentMethod: null, transactionId: payment.transactionId, notes: extractNotes(chatText), zone, deliveryCharge: zone?.charge || 0, parsedBy: "regex", lineMatches: lineParsed.lineMatches }
  parsedResult.confidence = calculateConfidence(parsedResult)
  return parsedResult
}

function extractAfterAnyTrigger(line, triggers) {
  const trimmed = line.trim()
  for (const trigger of triggers) {
    const escaped = escapeRegExp(trigger.trim())
    const match = trimmed.match(new RegExp(`^\\s*${escaped}\\s*(.*)$`, "i"))
    if (match?.[1]) return match[1].replace(/^[:ঃ\s]+/, "").trim() || null
  }
  return null
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function parseLines(originalText, convertedText) {
  const originalLines = originalText.split(/\r?\n/)
  const convertedLines = convertedText.split(/\r?\n/)
  const result = { customerName: null, phone: null, address: null, lineMatches: { name: false, phone: false, address: false, products: false } }
  originalLines.forEach((rawLine, index) => {
    const originalLine = rawLine.trim()
    const convertedLine = (convertedLines[index] || originalLine).trim()
    const name = extractAfterLineTrigger(originalLine, nameTriggers)
    if (name && !result.customerName) { result.customerName = name; result.lineMatches.name = true }
    const address = extractAfterLineTrigger(originalLine, addressTriggers)
    if (address && !result.address) { result.address = address; result.lineMatches.address = true }
    const phoneValue = extractAfterLineTrigger(convertedLine, phoneTriggers)
    if (phoneValue && !result.phone) { result.phone = extractPhone(phoneValue); result.lineMatches.phone = Boolean(result.phone) }
  })
  result.lineMatches.products = parseProductQuantityPairs(originalText).length > 0
  return result
}

function extractAfterLineTrigger(line, triggers) {
  return extractAfterAnyTrigger(line, triggers)
}

export function calculateConfidence(parsedResult) {
  let score = 0
  if (parsedResult.customerName) score += 0.25
  if (parsedResult.phone) score += 0.25
  if (parsedResult.address) score += 0.25
  if (parsedResult.products?.length > 0) score += 0.25
  return Math.min(1, Number(score.toFixed(2)))
}

export function extractPhone(text = "") {
  const match = convertBanglaToEnglish(text).match(phoneRegex)?.[0]
  if (!match) return null
  const digits = match.replace(/\D/g, "")
  return digits.startsWith("88") && digits.length === 13 ? digits.slice(2) : digits.slice(-11)
}

export function extractQuantity(text = "") {
  const lower = convertBanglaToEnglish(text).toLowerCase()
  for (const [word, quantity] of Object.entries(quantityMap)) if (lower.includes(convertBanglaToEnglish(word).toLowerCase())) return quantity
  const unitMatch = lower.match(/(\d+)\s*(ta|টা|pcs|piece|pieces|পিছ|পিস|nos|number|set|packet|pack|box)/i)
  if (unitMatch) return Number(unitMatch[1])
  const xPrefix = lower.match(/x\s*(\d+)/i)
  if (xPrefix) return Number(xPrefix[1])
  const xSuffix = lower.match(/(\d+)\s*x/i)
  if (xSuffix) return Number(xSuffix[1])
  return 1
}

export function extractPayment(text = "") {
  const converted = convertBanglaToEnglish(text)
  const lower = converted.toLowerCase()
  let paymentMethod = "COD"
  let keywordIndex = -1
  for (const [keyword, method] of Object.entries(paymentKeywords)) {
    const index = lower.indexOf(keyword.toLowerCase())
    if (index >= 0) { paymentMethod = method; keywordIndex = index; break }
  }
  const windowText = keywordIndex >= 0 ? converted.slice(Math.max(0, keywordIndex - 50), keywordIndex + 50).toUpperCase() : ""
  return { paymentMethod, transactionId: windowText.match(/[A-Z0-9]{8,10}/g)?.[0] || null }
}

export function extractAddress(text = "") {
  for (const trigger of addressTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) return text.slice(index + trigger.length).trim() || null
  }
  for (const line of text.split(/\r?\n/)) {
    const hits = addressWords.filter((word) => line.toLowerCase().includes(word)).length
    if (hits >= 2) return line.trim()
  }
  return null
}

export function extractName(text = "") {
  for (const trigger of nameTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) return text.slice(index + trigger.length).split(/\r?\n/)[0].trim().split(/\s+/).slice(0, 4).join(" ") || null
  }
  const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim()
  return firstLine && !/[\d\u09e6-\u09ef]/.test(firstLine) && /^[\p{L}\s.'-]+$/u.test(firstLine) && firstLine.split(/\s+/).length < 5 ? firstLine : null
}

export function extractNotes(text = "") {
  for (const trigger of noteTriggers) {
    const index = text.toLowerCase().indexOf(trigger.toLowerCase())
    if (index >= 0) return text.slice(index + trigger.length).trim() || null
  }
  return null
}





