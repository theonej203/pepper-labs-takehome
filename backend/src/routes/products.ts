import { Router } from "express";
import db from "../db.js";

const router = Router();

/**
 * GET /api/products
 * List all products with category name, variant count, and price/inventory aggregates.
 * Supports optional query params: ?search=term&category_id=1
 */
router.get("/", (req, res) => {
  try {
    const { search, category_id } = req.query;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        c.name AS category_name,
        p.status,
        p.deleted_at,
        p.created_at,
        p.updated_at,
        COUNT(v.id) AS variant_count,
        MIN(v.price_cents) AS min_price_cents,
        MAX(v.price_cents) AS max_price_cents,
        COALESCE(SUM(v.inventory_count), 0) AS total_inventory
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN variants v ON v.product_id = p.id
    `;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category_id) {
      conditions.push("p.category_id = ?");
      params.push(Number(category_id));
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " GROUP BY p.id ORDER BY p.created_at DESC";

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err: unknown) {
    // FIXME: sends plain text error — should this be JSON to match other responses?
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).send(message);
  }
});

/**
 * GET /api/products/:id
 * Get a single product with its variants.
 */
router.get("/:id", (req, res) => {
  try {
    const product = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(Number(req.params.id)) as Record<string, unknown> | undefined;

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const variants = db
      .prepare(
        `SELECT * FROM variants WHERE product_id = ? ORDER BY created_at ASC`
      )
      .all(Number(req.params.id));

    res.json({ ...product, variants });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).send(message);
  }
});

/**
 * POST /api/products
 * Create a new product with at least one variant.
 *
 * Expected body:
 * {
 *   "name": "Product Name",
 *   "description": "Optional description",
 *   "category_id": 1,
 *   "status": "active",
 *   "variants": [
 *     { "sku": "SKU-001", "name": "Default", "price_cents": 999, "inventory_count": 10 }
 *   ]
 * }
 */
router.post("/", (req, res) => {
  // Extract and normalize the incoming product data.
  const payload = req.body ?? {};

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const variants = Array.isArray(payload.variants) ? payload.variants : [];

  // Validate the required product and variant structure.
  if (!name) {
    return res.status(400).json({ error: "Product name is required." });
  }

  if (variants.length === 0) {
    return res.status(400).json({ error: "At least one variant is required." });
  }

  const cleanedVariants = variants.map((variant: Record<string, unknown>) => ({
    sku: typeof variant.sku === "string" ? variant.sku.trim() : "",
    name: typeof variant.name === "string" ? variant.name.trim() : "",
    price_cents: Number(variant.price_cents ?? 0),
    inventory_count: Number(variant.inventory_count ?? 0),
  }));

  // Validate each normalized variant before writing to the database.
  for (const variant of cleanedVariants) {
    if (!variant.sku) {
      return res.status(400).json({ error: "Every variant must include a SKU." });
    }
    if (variant.price_cents < 0) {
      return res.status(400).json({ error: "Variant price_cents must be >= 0." });
    }
    if (variant.inventory_count < 0) {
      return res.status(400).json({ error: "Variant inventory_count must be >= 0." });
    }
  }

  const skus = cleanedVariants.map((v: { sku: string }) => v.sku);
  const existing = db
    .prepare(
      `SELECT sku FROM variants WHERE sku IN (${skus.map(() => "?").join(",")})`
    )
    .all(...skus) as { sku: string }[];

  // Reject SKUs that are already assigned to another variant.
  if (existing.length > 0) {
    return res.status(409).json({
      error: `Duplicate SKU(s): ${existing.map((v: { sku: string }) => v.sku).join(", ")}`,
    });
  }

  try {
    // Insert the product and all variants atomically.
    const productId = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO products (name, description, category_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .run(
          name,
          typeof payload.description === "string" ? payload.description : null,
          payload.category_id ?? null,
          payload.status ?? "active"
        );

      const newProductId = Number(result.lastInsertRowid);

      const insertVariant = db.prepare(
        `INSERT INTO variants (product_id, sku, name, price_cents, inventory_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      );

      for (const variant of cleanedVariants) {
        insertVariant.run(
          newProductId,
          variant.sku,
          variant.name,
          variant.price_cents,
          variant.inventory_count
        );
      }

      return newProductId;
    })();

    // Read the inserted records back for the API response.
    const product = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(productId) as Record<string, unknown>;

    const insertedVariants = db
      .prepare(`SELECT * FROM variants WHERE product_id = ? ORDER BY created_at ASC`)
      .all(productId);

    res.status(201).json({ ...product, variants: insertedVariants });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/products/:id
 * Update a product's basic information.
 */
router.put("/:id", (req, res) => {
  try {
    const { name, description, category_id, status } = req.body;
    const id = Number(req.params.id);

    const existing = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    db.prepare(
      `UPDATE products
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           category_id = COALESCE(?, category_id),
           status = COALESCE(?, status),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(name ?? null, description ?? null, category_id ?? null, status ?? null, id);

    const updated = db
      .prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = ?`
      )
      .get(id);

    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).send(message);
  }
});

/**
 * DELETE /api/products/:id
 * Soft-delete a product (sets deleted_at timestamp).
 */
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!product) {
    // FIXME: Returns plain text — not JSON like other error responses
    return res.status(404).send("Product not found");
  }

  db.prepare(
    `UPDATE products SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);

  res.json({ success: true });
});

export default router;
