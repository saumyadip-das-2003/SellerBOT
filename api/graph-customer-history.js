const neo4j = require("neo4j-driver")

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USER,
    process.env.NEO4J_PASSWORD,
  ),
)

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { uid, phone } = req.query

  if (!uid || !phone) {
    return res.status(400).json({ error: "Missing uid or phone" })
  }

  const session = driver.session()
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

    if (result.records.length === 0) {
      return res.status(200).json({ found: false })
    }

    const record = result.records[0]
    return res.status(200).json({
      found: true,
      name: record.get("name"),
      address: record.get("address"),
      orderCount: record.get("orderCount").toNumber(),
      totalSpent: record.get("totalSpent"),
      lastOrder: record.get("lastOrder"),
    })
  } catch (error) {
    console.error("Neo4j customer history error:", error.message)
    return res.status(500).json({ error: error.message })
  } finally {
    await session.close()
  }
}
