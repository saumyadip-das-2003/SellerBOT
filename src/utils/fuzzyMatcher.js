import Fuse from "fuse.js"

const quantityWords = { ekta: 1, duita: 2, tinta: 3, charta: 4, pachta: 5 }

export function createProductMatcher(products = []) {
  return new Fuse(products, { keys: ["productCode", "name", "sku", "aliases"], threshold: 0.35, ignoreLocation: true })
}

export function fuzzyMatchSingle(productName, catalog = []) {
  if (!productName || !catalog.length) return null
  const fuse = new Fuse(catalog, { keys: ["productCode", "name", "banglaName", "tags"], threshold: 0.45 })
  const results = fuse.search(productName)
  return results.length > 0 ? results[0].item : null
}

export function matchProducts(chatText, productCatalog) {
  if (!productCatalog || productCatalog.length === 0) return []

  const codeMatches = matchProductCodes(chatText, productCatalog)
  const usedProductIds = new Set(codeMatches.map((item) => item.productId))
  const fuse = new Fuse(productCatalog, {
    keys: [
      { name: "productCode", weight: 0.35 },
      { name: "name", weight: 0.35 },
      { name: "banglaName", weight: 0.2 },
      { name: "tags", weight: 0.1 },
    ],
    threshold: 0.45,
    includeScore: true,
    minMatchCharLength: 2,
  })

  const matchedProducts = []
  for (const line of String(chatText || "").split("\n")) {
    const words = line.split(/\s+/)
    for (let i = 0; i < words.length; i += 1) {
      for (const chunk of [words.slice(i, i + 3).join(" "), words.slice(i, i + 2).join(" "), words[i]]) {
        if (chunk.length < 2) continue
        const results = fuse.search(chunk)
        if (results.length > 0 && results[0].score < 0.45) {
          const product = results[0].item
          if (!usedProductIds.has(product.id)) {
            usedProductIds.add(product.id)
            const qty = extractQuantityNearMatch(line)
            matchedProducts.push({
              productId: product.id,
              productCode: product.productCode || "",
              productName: product.name,
              banglaName: product.banglaName || "",
              quantity: qty,
              unitPrice: product.price || 0,
              costPrice: product.costPrice || 0,
              totalPrice: (product.price || 0) * qty,
              matchedBy: product.productCode && chunk.toUpperCase().includes(String(product.productCode).toUpperCase()) ? "productCode" : "fuzzy",
            })
          }
          break
        }
      }
    }
  }

  return [...codeMatches, ...matchedProducts]
}

function matchProductCodes(chatText = "", products = []) {
  const matched = []
  const usedCodes = new Set()
  const chatUpper = String(chatText).toUpperCase()

  for (const product of products) {
    if (!product.productCode) continue
    const code = String(product.productCode).toUpperCase()
    if (!chatUpper.includes(code) || usedCodes.has(code)) continue
    usedCodes.add(code)

    const escapedCode = escapeRegExp(code)
    const qtyPatterns = [
      new RegExp(`${escapedCode}\\s*(\\d+)`, "i"),
      new RegExp(`(\\d+)\\s*${escapedCode}`, "i"),
      new RegExp(`${escapedCode}\\s*x\\s*(\\d+)`, "i"),
      new RegExp(`(\\d+)\\s*x\\s*${escapedCode}`, "i"),
      new RegExp(`${escapedCode}[^\\d]*(\\d+)\\s*(?:ta|টা|pcs|piece)`, "i"),
    ]

    let quantity = 1
    for (const pattern of qtyPatterns) {
      const match = chatUpper.match(pattern)
      if (match) {
        quantity = parseInt(match[1], 10) || 1
        break
      }
    }

    matched.push({
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      banglaName: product.banglaName || "",
      quantity,
      unitPrice: product.price || 0,
      costPrice: product.costPrice || 0,
      totalPrice: (product.price || 0) * quantity,
      matchedBy: "productCode",
    })
  }

  return matched
}

function extractQuantityNearMatch(line) {
  const qtyPatterns = [/(\d+)\s*(ta|টা|pcs|piece|pieces|nos|x)/i, /x\s*(\d+)/i, /(ekta|duita|tinta|charta|pachta)/i]
  for (const pattern of qtyPatterns) {
    const match = line.match(pattern)
    if (!match) continue
    if (quantityWords[match[1]?.toLowerCase()]) return quantityWords[match[1].toLowerCase()]
    return parseInt(match[1], 10) || 1
  }
  return 1
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
