import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Package } from "lucide-react";
import { fetchProduct, deleteProduct, updateVariant } from "@/lib/api";
import type { ProductDetail, Variant } from "@/types";
import { formatPrice, cn } from "@/lib/utils";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editInventory, setEditInventory] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingVariant, setIsSavingVariant] = useState(false);

  // Load the product and its variants for the detail view.
  useEffect(() => {
    if (!id) return;
    fetchProduct(Number(id))
      .then((r) => r.json())
      .then(setProduct)
      .catch(console.error);
  }, [id]);

  // Delete handler — sends soft-delete request.
  // FIXME: The button does not disable while the request is in flight,
  //        so rapid clicks can send multiple DELETE requests.
  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this product?"))
      return;
    await deleteProduct(Number(id));
    navigate("/products");
  };

  // Copy the selected variant values into the editor.
  const startEditingVariant = (variant: Variant) => {
    setEditingVariantId(variant.id);
    setEditPrice(String(variant.price_cents));
    setEditInventory(String(variant.inventory_count));
    setEditError("");
  };

  // Close the editor without sending changes.
  const cancelEditingVariant = () => {
    setEditingVariantId(null);
    setEditError("");
  };

  // Validate and persist the edited variant values.
  const saveVariant = async (variantId: number) => {
    const priceCents = Number(editPrice);
    const inventoryCount = Number(editInventory);

    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setEditError("Price must be greater than or equal to zero.");
      return;
    }
    if (!Number.isInteger(inventoryCount) || inventoryCount < 0) {
      setEditError("Inventory count must be a whole number greater than or equal to zero.");
      return;
    }

    setIsSavingVariant(true);
    setEditError("");

    try {
      // Send only the editable fields to the backend.
      const response = await updateVariant(variantId, {
        price_cents: priceCents,
        inventory_count: inventoryCount,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to update variant.");
      }

      // Replace the saved variant in the local product state.
      setProduct((current) =>
        current
          ? {
              ...current,
              variants: current.variants.map((variant) =>
                variant.id === variantId ? data : variant
              ),
            }
          : current
      );
      setEditingVariantId(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update variant.");
    } finally {
      setIsSavingVariant(false);
    }
  };

  if (!product) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      {/* Product header — card style */}
      <div className="mb-6 rounded-lg border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {product.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  product.status === "active"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : product.status === "draft"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-100 text-gray-600"
                )}
              >
                {product.status}
              </span>
              {product.category_name && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {product.category_name}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Display variants and open the inline editor for a selected row. */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Variants ({product.variants.length})
        </h2>

        <div className="overflow-hidden rounded-lg border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b bg-muted/50 transition-colors">
                  <th className="h-12 w-[22%] px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    SKU
                  </th>
                  <th className="h-12 w-[28%] px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="h-12 w-[16%] px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Price
                  </th>
                  <th className="h-12 w-[16%] px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Inventory
                  </th>
                  <th className="h-12 w-[18%] px-4 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {product.variants.map((v) => (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    isEditing={editingVariantId === v.id}
                    editPrice={editPrice}
                    editInventory={editInventory}
                    editError={editError}
                    isSaving={isSavingVariant}
                    onEdit={() => startEditingVariant(v)}
                    onCancel={cancelEditingVariant}
                    onSave={() => saveVariant(v.id)}
                    onPriceChange={setEditPrice}
                    onInventoryChange={setEditInventory}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VariantRow({
  variant,
  isEditing,
  editPrice,
  editInventory,
  editError,
  isSaving,
  onEdit,
  onCancel,
  onSave,
  onPriceChange,
  onInventoryChange,
}: {
  variant: Variant;
  isEditing: boolean;
  editPrice: string;
  editInventory: string;
  editError: string;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onPriceChange: (value: string) => void;
  onInventoryChange: (value: string) => void;
}) {
  const lowStock =
    variant.inventory_count > 0 && variant.inventory_count <= 10;
  const outOfStock = variant.inventory_count === 0;

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="p-4 align-middle font-mono text-xs">
        {variant.sku}
      </td>
      <td className="p-4 align-middle font-medium">{variant.name}</td>
      <td className="w-[16%] p-4 text-right align-middle tabular-nums">
        {isEditing ? (
          <input
            aria-label={`Price for ${variant.sku}`}
            type="number"
            min="0"
            step="1"
            value={editPrice}
            onChange={(event) => onPriceChange(event.target.value)}
            className="h-9 w-full max-w-28 rounded-md border border-input bg-background px-2 text-right text-sm"
          />
        ) : (
          formatPrice(variant.price_cents)
        )}
      </td>
      <td className="w-[16%] p-4 text-right align-middle tabular-nums">
        {isEditing ? (
          <input
            aria-label={`Inventory for ${variant.sku}`}
            type="number"
            min="0"
            step="1"
            value={editInventory}
            onChange={(event) => onInventoryChange(event.target.value)}
            className="h-9 w-full max-w-24 rounded-md border border-input bg-background px-2 text-right text-sm"
          />
        ) : (
          <span
            className={cn(
              outOfStock && "text-destructive",
              lowStock && "text-amber-600"
            )}
          >
            {variant.inventory_count}
            {outOfStock && (
              <Package className="ml-1 inline h-3.5 w-3.5 text-destructive/60" />
            )}
          </span>
        )}
      </td>
      <td className="w-[18%] p-4 text-right align-middle">
        {isEditing ? (
          <div className="flex flex-col items-end gap-2">
            {editError && <span className="text-xs text-destructive">{editError}</span>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={isSaving}
                onClick={onCancel}
                className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={onSave}
                className="rounded-md bg-[#2E3330] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#3a3f3c] disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}
