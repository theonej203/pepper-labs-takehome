import { Router } from "express";
import db from "../db.js";

const router = Router();

/**
 * GET /api/variants/:id
 * Get a single variant.
 */
router.get("/:id", (req, res) => {
  try {
    const variant = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(Number(req.params.id));

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json(variant);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/variants/:id
 * Update a variant's price and/or inventory.
 *
 * Expected body (all fields optional):
 * {
 *   "name": "Updated Name",
 *   "sku": "NEW-SKU",
 *   "price_cents": 1999,
 *   "inventory_count": 50
 * }
 */
router.put("/:id", (req, res) => {
  try {
    // Parse the route identifier and accepted update fields.
    const id = Number(req.params.id);
    const body = req.body as {
      name?: unknown;
      sku?: unknown;
      price_cents?: unknown;
      inventory_count?: unknown;
    };

    const variant = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    // Confirm the requested variant exists before validating updates.
    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    // Validate and prepare optional name and SKU changes.
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return res.status(400).json({ error: "Variant name must not be empty" });
      }
      updates.push("name = ?");
      values.push(body.name.trim());
    }

    if (body.sku !== undefined) {
      if (typeof body.sku !== "string" || !body.sku.trim()) {
        return res.status(400).json({ error: "SKU is required" });
      }

      const sku = body.sku.trim();
      const duplicate = db
        .prepare("SELECT id FROM variants WHERE sku = ? AND id != ?")
        .get(sku, id);

      if (duplicate) {
        return res.status(409).json({ error: "SKU must be unique" });
      }

      updates.push("sku = ?");
      values.push(sku);
    }

    // Validate and prepare the numeric fields used by the editor.
    if (body.price_cents !== undefined) {
      const priceCents = Number(body.price_cents);
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        return res.status(400).json({ error: "Price must be >= 0" });
      }
      updates.push("price_cents = ?");
      values.push(priceCents);
    }

    if (body.inventory_count !== undefined) {
      const inventoryCount = Number(body.inventory_count);
      if (!Number.isInteger(inventoryCount) || inventoryCount < 0) {
        return res.status(400).json({ error: "Inventory count must be >= 0" });
      }
      updates.push("inventory_count = ?");
      values.push(inventoryCount);
    }

    // Reject requests that do not change any supported field.
    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);
  // Apply the requested changes and refresh the timestamp.
    db.prepare(
      `UPDATE variants
       SET ${updates.join(", ")}, updated_at = datetime('now')
       WHERE id = ?`
    ).run(...values);

    const updated = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(id);

    // Return the saved database record to the frontend.
    return res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/variants/:id
 * Delete a variant permanently.
 */
router.delete("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const variant = db
      .prepare("SELECT * FROM variants WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    // Prevent deleting the last variant of a product
    const siblingCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM variants WHERE product_id = ?"
      )
      .get(variant.product_id as number) as { count: number };

    if (siblingCount.count <= 1) {
      return res
        .status(400)
        .json({ error: "Cannot delete the last variant of a product" });
    }

    db.prepare("DELETE FROM variants WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
