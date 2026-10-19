"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ProductForm from "../../../components/ProductForm";
import PageHeader from "../../../components/PageHeader";
import { addProduct, type ProductInput } from "../../../lib/services/products";
import { useStore } from "../../../store/useStore";
import { useLanguage } from "../../../store/useLanguage";

export default function AddProductPage() {
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const router = useRouter();

  const handleSubmit = async (values: ProductInput) => {
    if (!currentUser) {
      toast.error(t("inv_userMissing"));
      return;
    }
    try {
      await addProduct(currentUser.uid, values);
      toast.success(t("inv_added"));
      router.push("/dashboard/inventry");
    } catch (error) {
      console.error(error);
      toast.error(t("inv_errorPrefix", { message: error instanceof Error ? error.message : t("inv_saveFailed") }));
    }
  };

  return (
    <div>
      <PageHeader
        title={t("newProduct")}
        subtitle={t("addProductSubtitle")}
        actions={
          <button onClick={() => router.back()} className="btn-ghost !py-2.5">
            <ArrowLeft size={16} /> {t("back")}
          </button>
        }
      />
      <ProductForm mode="add" onSubmit={handleSubmit} />
    </div>
  );
}