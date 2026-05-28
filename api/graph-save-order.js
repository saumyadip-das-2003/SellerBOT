const neo4j = require("neo4j-driver")

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USER,
    process.env.NEO4J_PASSWORD,
  ),
)

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { uid, order } = req.body

  if (!uid || !order) {
    return res.status(400).json({ error: "Missing uid or order" })
  }

  const session = driver.session()
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
      grandTotal: order.grandTotal || 0,
      zone: order.zone || "",
      orderDate: new Date().toISOString(),
      paymentMethod: order.paymentMethod || "COD",
    })

    for (const product of order.products || []) {
      await session.run(`
        MERGE (prod:Product {
          name: $productName,
          sellerUid: $uid
        })
        ON CREATE SET prod.price = $price
        MERGE (order:Order {
          orderNumber: $orderNumber,
          sellerUid: $uid
        })
        MERGE (order)-[r:CONTAINS]->(prod)
        ON CREATE SET
          r.quantity = $quantity,
          r.unitPrice = $unitPrice
      `, {
        uid,
        productName: product.productName || "",
        price: product.unitPrice || 0,
        orderNumber: order.orderNumber || "",
        quantity: product.quantity || 1,
        unitPrice: product.unitPrice || 0,
      })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error("Neo4j save error:", error.message)
    return res.status(500).json({ error: error.message })
  } finally {
    await session.close()
  }
}
