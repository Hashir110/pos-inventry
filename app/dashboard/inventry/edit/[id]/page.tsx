"use client";

import { use, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ProductForm from "../../../../components/ProductForm";
import PageHeader from "../../../../components/PageHeader";
import { getProduct, updateProduct, type ProductInput } from "../../../../lib/services/products";
import { useLanguage } from "../../../../store/useLanguage";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);
  const { t } = useLanguage();
  const router = useRouter();

  const [product, setProduct] = useState<ProductInput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getProduct(productId);
        if (cancelled) return;
        if (!found) {
          toast.error("Product not found!");
          router.push("/dashboard/inventry");
          return;
        }
        setProduct({
          name: found.name,
          buyingPrice: found.buyingPrice,
          sellingPrice: found.sellingPrice,
          stock: found.stock,
          unitType: found.unitType,
          category: found.category ?? "",
        });
      } catch (error) {
        console.error("Fetch Error:", error);
        toast.error("Product load nahi hua");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, router]);

  const handleSubmit = async (values: ProductInput) => {
    try {
      await updateProduct(productId, values);
      toast.success("Product Updated Successfully!");
      router.push("/dashboard/inventry");
    } catch (error) {
      console.error(error);
      toast.error("Error: " + (error instanceof Error ? error.message : "update failed"));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-brand-600">
        <Loader2 className="animate-spin" /> {t("loading")}
      </div>
    );
  }

  if (!product) return null;

  return (
    <div>
      <PageHeader
        title={t("navEditProduct")}
        subtitle={t("editProductSubtitle")}
        actions={
          <button onClick={() => router.back()} className="btn-ghost !py-2.5">
            <ArrowLeft size={16} /> {t("back")}
          </button>
        }
      />
      <ProductForm mode="edit" initial={product} onSubmit={handleSubmit} />
    </div>
  );
}
