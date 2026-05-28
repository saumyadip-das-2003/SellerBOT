import neo4j from "neo4j-driver"

let driver = null

function getDriver() {
  if (driver) return driver

  const uri = import.meta.env.VITE_NEO4J_URI
  const user = import.meta.env.VITE_NEO4J_USER
  const password = import.meta.env.VITE_NEO4J_PASSWORD

  if (!uri || !user || !password) {
    console.warn("Neo4j credentials missing")
    return null
  }

  driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
  return driver
}

function getSession() {
  const d = getDriver()
  if (!d) return null
  const database = import.meta.env.VITE_NEO4J_DATABASE || "neo4j"
  return d.session({ database })
}

function toNumber(value) {
  if (neo4j.isInt(value)) return value.toNumber()
  return Number(value || 0)
}

export async function saveOrderToGraph(uid, order) {
  const session = getSession()
  if (!session) return false

  try {
    await session.run(`
      MERGE (seller:Seller {uid: $uid})
      MERGE (customer:Customer {
        phone: $phone,
        sellerUid: $uid
      })
      ON CREATE SET
        customer.name = $customerName,
        customer.address = $address,
        customer.createdAt = $orderDate
      ON MATCH SET
        customer.name = $customerName,
        customer.address = CASE WHEN $address <> '' THEN $address ELSE customer.address END,
        customer.lastOrder = $orderDate
      MERGE (order:Order {
        orderNumber: $orderNumber,
        sellerUid: $uid
      })
      SET order.grandTotal = $grandTotal,
          order.zone = $zone,
          order.createdAt = $orderDate,
          order.paymentMethod = $paymentMethod
      MERGE (seller)-[:HAS_CUSTOMER]->(customer)
      MERGE (customer)-[:PLACED]->(order)
      MERGE (seller)-[:HAS_ORDER]->(order)
    `, {
      uid,
      phone: order.phone || "unknown",
      customerName: order.customerName || "",
      address: order.address || "",
      orderNumber: order.orderNumber || "",
      grandTotal: Number(order.grandTotal || 0),
      zone: order.zone || "",
      orderDate: new Date().toISOString(),
      paymentMethod: order.paymentMethod || "COD",
    })

    for (const product of order.products || []) {
      await session.run(`
        MERGE (seller:Seller {uid: $uid})
        MERGE (prod:Product {
          name: $productName,
          sellerUid: $uid
        })
        ON CREATE SET prod.price = $price
        ON MATCH SET prod.price = $price
        MERGE (order:Order {
          orderNumber: $orderNumber,
          sellerUid: $uid
        })
        MERGE (order)-[contains:CONTAINS]->(prod)
        SET contains.quantity = $quantity,
            contains.unitPrice = $unitPrice
        MERGE (seller)-[:SELLS]->(prod)
      `, {
        uid,
        productName: product.productName || "",
        price: Number(product.unitPrice || 0),
        orderNumber: order.orderNumber || "",
        quantity: neo4j.int(product.quantity || 1),
        unitPrice: Number(product.unitPrice || 0),
      })
    }

    return true
  } catch (error) {
    console.error("saveOrderToGraph failed:", error.message, error)
    return false
  } finally {
    await session.close()
  }
}

export async function getFrequentlyBoughtTogether(uid, productName, limit = 3) {
  const session = getSession()
  if (!session || !productName) return []

  try {
    const result = await session.run(`
      MATCH (p1:Product {name: $productName, sellerUid: $uid})
        <-[:CONTAINS]-(o:Order)
        -[:CONTAINS]->(p2:Product)
      WHERE p2.name <> $productName
        AND p2.sellerUid = $uid
      RETURN p2.name as productName,
             count(o) as frequency
      ORDER BY frequency DESC
      LIMIT $limit
    `, {
      uid,
      productName,
      limit: neo4j.int(limit),
    })

    return result.records.map((record) => ({
      productName: record.get("productName"),
      frequency: toNumber(record.get("frequency")),
    }))
  } catch (error) {
    console.error("getFrequentlyBoughtTogether failed:", error)
    return []
  } finally {
    await session.close()
  }
}

export async function getFrequentlyBoughtPairs(uid, limit = 5) {
  const session = getSession()
  if (!session) return []

  try {
    const result = await session.run(`
      MATCH (p1:Product {sellerUid: $uid})<-[:CONTAINS]-(o:Order)-[:CONTAINS]->(p2:Product {sellerUid: $uid})
      WHERE p1.name < p2.name
      RETURN p1.name as productA,
             p2.name as productB,
             count(o) as frequency
      ORDER BY frequency DESC
      LIMIT $limit
    `, { uid, limit: neo4j.int(limit) })

    return result.records.map((record) => ({
      productA: record.get("productA"),
      productB: record.get("productB"),
      frequency: toNumber(record.get("frequency")),
    }))
  } catch (error) {
    console.error("getFrequentlyBoughtPairs failed:", error)
    return []
  } finally {
    await session.close()
  }
}

export async function getCustomerHistory(uid, phone) {
  const session = getSession()
  if (!session || !phone) return null

  try {
    const result = await session.run(`
      MATCH (c:Customer {phone: $phone, sellerUid: $uid})
        -[:PLACED]->(o:Order)
      RETURN c.name as name,
             c.address as address,
             count(o) as orderCount,
             sum(o.grandTotal) as totalSpent,
             max(o.createdAt) as lastOrder
    `, { uid, phone })

    if (result.records.length === 0) return null
    const record = result.records[0]
    return {
      name: record.get("name"),
      address: record.get("address"),
      orderCount: toNumber(record.get("orderCount")),
      totalSpent: Number(record.get("totalSpent") || 0),
      lastOrder: record.get("lastOrder"),
    }
  } catch (error) {
    console.error("getCustomerHistory failed:", error)
    return null
  } finally {
    await session.close()
  }
}

export async function getTopProductsByZone(uid, zone, limit = 5) {
  const session = getSession()
  if (!session || !zone) return []

  try {
    const result = await session.run(`
      MATCH (o:Order {zone: $zone, sellerUid: $uid})
        -[:CONTAINS]->(p:Product)
      RETURN p.name as productName,
             count(o) as orderCount,
             sum(o.grandTotal) as revenue
      ORDER BY orderCount DESC
      LIMIT $limit
    `, { uid, zone, limit: neo4j.int(limit) })

    return result.records.map((record) => ({
      productName: record.get("productName"),
      orderCount: toNumber(record.get("orderCount")),
      revenue: Number(record.get("revenue") || 0),
    }))
  } catch (error) {
    console.error("getTopProductsByZone failed:", error)
    return []
  } finally {
    await session.close()
  }
}

export async function getCustomerInsights(uid) {
  const session = getSession()
  if (!session) return null

  try {
    const result = await session.run(`
      MATCH (seller:Seller {uid: $uid})
        -[:HAS_CUSTOMER]->(c:Customer)
      OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
      WITH c,
           count(o) as orderCount,
           sum(coalesce(o.grandTotal, 0)) as spent,
           collect(distinct o.zone) as zones
      WITH collect({orderCount: orderCount, spent: spent, zones: zones}) as rows
      WITH rows,
           reduce(totalOrders = 0, row in rows | totalOrders + row.orderCount) as totalOrders,
           reduce(totalSpent = 0.0, row in rows | totalSpent + row.spent) as totalSpent,
           reduce(repeatCustomers = 0, row in rows | repeatCustomers + CASE WHEN row.orderCount > 1 THEN 1 ELSE 0 END) as repeatCustomers
      UNWIND rows as row
      UNWIND row.zones as zone
      WITH rows, totalOrders, totalSpent, repeatCustomers, collect(distinct zone)[..5] as topZones
      RETURN size(rows) as totalCustomers,
             totalOrders as totalOrders,
             CASE WHEN totalOrders = 0 THEN 0 ELSE totalSpent / totalOrders END as avgOrderValue,
             repeatCustomers as repeatCustomers,
             topZones as topZones
    `, { uid })

    if (result.records.length === 0) return null
    const record = result.records[0]
    const totalCustomers = toNumber(record.get("totalCustomers"))
    const repeatCustomers = toNumber(record.get("repeatCustomers"))

    return {
      totalCustomers,
      totalOrders: toNumber(record.get("totalOrders")),
      avgOrderValue: Number(record.get("avgOrderValue") || 0),
      repeatCustomers,
      repeatCustomerRate: totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0,
      topZones: (record.get("topZones") || []).filter(Boolean),
    }
  } catch (error) {
    console.error("getCustomerInsights failed:", error)
    return null
  } finally {
    await session.close()
  }
}
export async function closeGraphDriver() {
  if (driver) {
    await driver.close()
    driver = null
  }
}
