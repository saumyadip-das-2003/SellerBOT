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

  const session = driver.session()
  try {
    const result = await session.run("RETURN 1 as ok")
    return res.status(200).json({ ok: result.records[0].get("ok").toNumber() === 1 })
  } catch (error) {
    console.error("Neo4j test error:", error.message)
    return res.status(500).json({ error: error.message })
  } finally {
    await session.close()
  }
}
