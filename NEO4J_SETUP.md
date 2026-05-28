# Neo4j AuraDB Setup

1. Go to https://neo4j.com/cloud/aura
2. Click "Start Free"
3. Create a Free instance
   - Name: sellerbot
   - Region: closest to Bangladesh, such as Singapore or Asia Pacific
4. Download the credentials file shown after instance creation
5. Copy:
   - Connection URI, such as `neo4j+s://...`
   - Username, usually `neo4j`
   - Password
6. Add to `.env`:

```env
VITE_NEO4J_URI=neo4j+s://...
VITE_NEO4J_USER=neo4j
VITE_NEO4J_PASSWORD=...
```

7. Add the same variables to Vercel environment variables:
   - `VITE_NEO4J_URI`
   - `VITE_NEO4J_USER`
   - `VITE_NEO4J_PASSWORD`

## Notes

SellerBot writes graph data when an order is saved. Existing Firestore orders will not appear in Neo4j until they are re-saved or a backfill script is added later.
