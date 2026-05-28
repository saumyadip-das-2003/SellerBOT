import neo4j from "neo4j-driver"

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USER,
    process.env.NEO4J_PASSWORD,
  ),
)

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { uid } = req.query
  if (!uid) return res.status(400).json({ error: "Missing uid" })

  const session = driver.session()
  try {
    const result = await session.run(`
      MATCH (seller:Seller {uid: $uid})-[:HAS_CUSTOMER]->(c:Customer)
      OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
      WITH count(distinct c) as totalCustomers,
           count(o) as totalOrders,
           avg(o.grandTotal) as avgOrderValue,
           count(CASE WHEN o IS NOT NULL THEN c END) as orderRows
      RETURN totalCustomers, totalOrders, coalesce(avgOrderValue, 0) as avgOrderValue
    `, { uid })

    const pairsResult = await session.run(`
      MATCH (p1:Product {sellerUid: $uid})
        <-[:CONTAINS]-(o:Order)
        -[:CONTAINS]->(p2:Product {sellerUid: $uid})
      WHERE p1.name < p2.name
      RETURN p1.name as product1,
             p2.name as product2,
             count(o) as frequency
      ORDER BY frequency DESC
      LIMIT 5
    `, { uid })

    const record = result.records[0]
    const insights = record ? {
      totalCustomers: record.get("totalCustomers").toNumber(),
      totalOrders: record.get("totalOrders").toNumber(),
      avgOrderValue: record.get("avgOrderValue") || 0,
    } : {
      totalCustomers: 0,
      totalOrders: 0,
      avgOrderValue: 0,
    }

    const frequentPairs = pairsResult.records.map((pairRecord) => ({
      product1: pairRecord.get("product1"),
      product2: pairRecord.get("product2"),
      frequency: pairRecord.get("frequency").toNumber(),
    }))

    return res.status(200).json({ insights, frequentPairs })
  } catch (error) {
    console.error("Neo4j insights error:", error.message)
    return res.status(500).json({ error: error.message })
  } finally {
    await session.close()
  }
}
