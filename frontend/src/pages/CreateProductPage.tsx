import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { createProduct, fetchCategories } from "@/lib/api";
import type { Category } from "@/types";

type VariantInput = {
  id: string;
  sku: string;
  name: string;
  price_cents: string;
  inventory_count: string;
};

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const createEmptyVariant = (): VariantInput => ({
  id: Math.random().toString(36).slice(2),
  sku: "",
  name: "",
  price_cents: "",
  inventory_count: "",
});

export default function CreateProductPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [variants, setVariants] = useState<VariantInput[]>([createEmptyVariant()]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load categories for the dropdown on mount.
  useEffect(() => {
    fetchCategories()
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Save button is only enabled once a name and at least one complete variant exist.
  const canSubmit = useMemo(
    () => name.trim().length > 0 && variants.some((v) => v.sku.trim() && v.name.trim()),
    [name, variants]
  );

  // Updates a single field on a single variant row.
  const updateVariant = (id: string, field: keyof VariantInput, value: string) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant
      )
    );
  };

  const addVariant = () => setVariants((current) => [...current, createEmptyVariant()]);

  const removeVariant = (id: string) => {
    setVariants((current) => {
      if (current.length === 1) return current;
      return current.filter((variant) => variant.id !== id);
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    // Normalize form values before validating/submitting.
    const trimmedName = name.trim();
    const cleanedVariants = variants.map((variant) => ({
      sku: variant.sku.trim(),
      name: variant.name.trim(),
      price_cents: Number(variant.price_cents || 0),
      inventory_count: Number(variant.inventory_count || 0),
    }));

    // Client-side validation mirrors the backend rules in POST /api/products.
    if (!trimmedName) {
      setError("Product name is required.");
      return;
    }

    if (cleanedVariants.length === 0 || cleanedVariants.every((v) => !v.sku || !v.name)) {
      setError("Add at least one variant with a SKU and name.");
      return;
    }

    for (const variant of cleanedVariants) {
      if (!variant.sku) {
        setError("Every variant must include a SKU.");
        return;
      }
      if (variant.price_cents < 0 || variant.inventory_count < 0) {
        setError("Price and inventory count must be greater than or equal to zero.");
        return;
      }
    }

    setIsSubmitting(true);

    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      category_id: categoryId === "" ? null : Number(categoryId),
      status,
      variants: cleanedVariants,
    };

    try {
      const response = await createProduct(payload);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to create product.");
      }

      // Redirect to the newly created product's detail page.
      navigate(`/products/${data.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to create product.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Create New Product
        </h1>

        <button
          type="submit"
          form="product-form"
          disabled={isSubmitting || !canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2E3330] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a3f3c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Saving..." : "Save Product"}
        </button>
      </div>

      <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="rounded-lg border bg-card p-6 shadow-card">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Product details</h2>
          </div>

          {/* Name, description, category, and status inputs */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="product-name" className="mb-1.5 block text-sm font-medium">
                Product name
              </label>
              <input
                id="product-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                placeholder="e.g. Organic Baby Spinach"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="product-description" className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <textarea
                id="product-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className={`${inputClass} min-h-[110px] resize-none`}
                placeholder="Optional product description"
              />
            </div>

            <div>
              <label htmlFor="product-category" className="mb-1.5 block text-sm font-medium">
                Category
              </label>
              <select
                id="product-category"
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(event.target.value ? Number(event.target.value) : "")
                }
                className={inputClass}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="product-status" className="mb-1.5 block text-sm font-medium">
                Status
              </label>
              <select
                id="product-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "active" | "draft" | "archived")
                }
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Variants</h2>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Add variant
            </button>
          </div>

          {/* At least one variant is required; the last remaining row cannot be removed. */}
          <div className="space-y-4">
            {variants.map((variant, index) => (
              <div key={variant.id} className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Variant {index + 1}
                  </h3>

                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(variant.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-background px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">SKU</label>
                    <input
                      value={variant.sku}
                      onChange={(event) =>
                        updateVariant(variant.id, "sku", event.target.value)
                      }
                      className={inputClass}
                      placeholder="e.g. SK-001"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Variant name</label>
                    <input
                      value={variant.name}
                      onChange={(event) =>
                        updateVariant(variant.id, "name", event.target.value)
                      }
                      className={inputClass}
                      placeholder="e.g. Default"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Price (In cent)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={variant.price_cents}
                      onChange={(event) =>
                        updateVariant(variant.id, "price_cents", event.target.value)
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Inventory</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={variant.inventory_count}
                      onChange={(event) =>
                        updateVariant(variant.id, "inventory_count", event.target.value)
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}
