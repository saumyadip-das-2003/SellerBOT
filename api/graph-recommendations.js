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

  const { uid, productName, limit = 3 } = req.query

  if (!uid || !productName) {
    return res.status(400).json({ error: "Missing params" })
  }

  const session = driver.session()
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
      limit: neo4j.int(parseInt(limit, 10)),
    })

    const recommendations = result.records.map((record) => ({
      productName: record.get("productName"),
      frequency: record.get("frequency").toNumber(),
    }))

    return res.status(200).json({ recommendations })
  } catch (error) {
    console.error("Neo4j recommendations error:", error.message)
    return res.status(500).json({ error: error.message })
  } finally {
    await session.close()
  }
}
