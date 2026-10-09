"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ProductForm from "../../../components/ProductForm";
import PageHeader from "../../../components/PageHeader";
import { addProduct, type ProductInput } from "../../../lib/services/products";
import { useStore } from "../../../store/useStore";

export default function AddProductPage() {
  const { currentUser } = useStore();
  const router = useRouter();

  const handleSubmit = async (values: ProductInput) => {
    if (!currentUser) {
      toast.error("User missing");
      return;
    }
    try {
      await addProduct(currentUser.uid, values);
      toast.success("Product Added Successfully!");
      router.push("/dashboard/inventry");
    } catch (error) {
      console.error(error);
      toast.error("Error: " + (error instanceof Error ? error.message : "save failed"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Naya Product"
        subtitle="Inventory mein item shamil karein"
        actions={
          <button onClick={() => router.back()} className="btn-ghost !py-2.5">
            <ArrowLeft size={16} /> Wapis
          </button>
        }
      />
      <ProductForm mode="add" onSubmit={handleSubmit} />
    </div>
  );
}