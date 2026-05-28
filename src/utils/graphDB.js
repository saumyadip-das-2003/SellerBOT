const API_BASE = "/api"

export async function saveOrderToGraph(uid, order) {
  try {
    const response = await fetch(`${API_BASE}/graph-save-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, order }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    console.log("Order saved to graph")
    return true
  } catch (error) {
    console.error("saveOrderToGraph failed:", error.message)
    return false
  }
}

export async function getCustomerHistory(uid, phone) {
  try {
    const params = new URLSearchParams({ uid, phone })
    const response = await fetch(`${API_BASE}/graph-customer-history?${params.toString()}`)
    const data = await response.json()
    if (!response.ok || !data.found) return null
    return data
  } catch (error) {
    console.error("getCustomerHistory failed:", error.message)
    return null
  }
}

export async function getFrequentlyBoughtTogether(uid, productName, limit = 3) {
  try {
    const params = new URLSearchParams({ uid, productName, limit: String(limit) })
    const response = await fetch(`${API_BASE}/graph-recommendations?${params.toString()}`)
    const data = await response.json()
    if (!response.ok) return []
    return data.recommendations || []
  } catch (error) {
    console.error("getFrequentlyBoughtTogether failed:", error.message)
    return []
  }
}

export async function getCustomerInsights(uid) {
  try {
    const params = new URLSearchParams({ uid })
    const response = await fetch(`${API_BASE}/graph-insights?${params.toString()}`)
    const data = await response.json()
    if (!response.ok) return null
    return data
  } catch (error) {
    console.error("getCustomerInsights failed:", error.message)
    return null
  }
}
