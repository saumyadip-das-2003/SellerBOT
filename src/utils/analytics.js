function getOrderDate(order) {
  return order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || Date.now())
}

export function getTodaysSales(orders) {
  const today = new Date().toDateString()
  const todayOrders = orders.filter((o) => getOrderDate(o).toDateString() === today)
  return {
    count: todayOrders.length,
    revenue: todayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
  }
}

export function getThisMonthSales(orders) {
  const now = new Date()
  const monthOrders = orders.filter((o) => {
    const d = getOrderDate(o)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  return {
    count: monthOrders.length,
    revenue: monthOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
  }
}

export function getTopProducts(orders, limit = 5) {
  const productMap = {}
  orders.forEach((order) => {
    ;(order.products || []).forEach((p) => {
      if (!productMap[p.productName]) {
        productMap[p.productName] = { name: p.productName, units: 0, revenue: 0 }
      }
      productMap[p.productName].units += Number(p.quantity || 0)
      productMap[p.productName].revenue += Number(p.totalPrice || 0)
    })
  })
  return Object.values(productMap)
    .sort((a, b) => b.units - a.units)
    .slice(0, limit)
}

export function getSalesByZone(orders) {
  const zoneMap = {}
  orders.forEach((order) => {
    const zone = order.zone || "Unknown"
    if (!zoneMap[zone]) zoneMap[zone] = { zone, count: 0, revenue: 0 }
    zoneMap[zone].count += 1
    zoneMap[zone].revenue += order.grandTotal || 0
  })
  return Object.values(zoneMap).sort((a, b) => b.revenue - a.revenue)
}

export function getPaymentBreakdown(orders) {
  const methodMap = {}
  orders.forEach((order) => {
    const method = order.paymentMethod || "COD"
    if (!methodMap[method]) methodMap[method] = { method, count: 0, revenue: 0 }
    methodMap[method].count += 1
    methodMap[method].revenue += order.grandTotal || 0
  })
  return Object.values(methodMap).sort((a, b) => b.count - a.count)
}

export function getUnpaidOrders(orders) {
  return orders.filter((o) => o.paymentStatus === "Unpaid")
}

export function getYesterdaysSales(orders) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yDate = yesterday.toDateString()
  const yOrders = orders.filter((o) => getOrderDate(o).toDateString() === yDate)
  return {
    count: yOrders.length,
    revenue: yOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
  }
}

export function exportToCSV(orders) {
  const headers = [
    "Order#",
    "Date",
    "CustomerName",
    "Phone",
    "Address",
    "Zone",
    "DeliveryCharge",
    "Products",
    "Subtotal",
    "Discount",
    "GrandTotal",
    "PaymentMethod",
    "TransactionID",
    "PaymentStatus",
    "Notes",
    "ParsedBy",
  ]
  const rows = orders.map((o) => [
    o.orderNumber || "",
    o.createdAt ? getOrderDate(o).toLocaleDateString("en-GB") : "",
    o.customerName || "",
    o.phone || "",
    (o.address || "").replace(/,/g, " "),
    o.zone || "",
    o.deliveryCharge || 0,
    (o.products || []).map((p) => `${p.productName}x${p.quantity}`).join(" | "),
    o.subtotal || 0,
    o.discount || 0,
    o.grandTotal || 0,
    o.paymentMethod || "",
    o.transactionId || "",
    o.paymentStatus || "",
    (o.notes || "").replace(/,/g, " "),
    o.parsedBy || "",
  ])
  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `SellerBot-Sales-${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function getOrderDateValue(order) {
  return getOrderDate(order)
}
