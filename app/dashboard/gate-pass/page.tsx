"use client";

import { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import { subscribeProducts } from "../../lib/services/products";
import { subscribeCustomers } from "../../lib/services/customers";
import { issueGatePass, subscribeGatePasses } from "../../lib/services/gatePasses";
import type { Product, Customer, GatePass } from "../../types";
import {
  FileText,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  Trash2,
  Truck,
  User,
  Package,
  X,
} from "lucide-react";
import { toast } from "react-toastify";

export default function GatePassPage() {
  const { currentShop } = useStore();
  const ownerId = currentShop?.uid || "";

  const [activeTab, setActiveTab] = useState<"issue" | "history">("issue");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<
    Array<{ productId: string; productName: string; qty: number; unit: string; maxGudamQty: number }>
  >([]);

  // Selected item inputs
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState(1);

  // Print Modal State
  const [printPass, setPrintPass] = useState<GatePass | null>(null);
  const [printFormat, setPrintFormat] = useState<"A4" | "thermal">("A4");

  useEffect(() => {
    if (!ownerId) return;

    const unsubProd = subscribeProducts(ownerId, setProducts);
    const unsubCust = subscribeCustomers(ownerId, setCustomers);
    const unsubPass = subscribeGatePasses(ownerId, setGatePasses);

    return () => {
      unsubProd();
      unsubCust();
      unsubPass();
    };
  }, [ownerId]);

  const handleAddProductToPass = () => {
    if (!selectedProductId) {
      toast.warn("Product select karein");
      return;
    }
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const gudamStock = prod.gudamStock ?? 0;
    if (gudamStock <= 0) {
      toast.error(`"${prod.name}" ka Gudam mein stock 0 hai!`);
      return;
    }

    if (itemQty <= 0) {
      toast.warn("Sahi quantity likhein");
      return;
    }

    if (itemQty > gudamStock) {
      toast.warn(`Gudam mein sirf ${gudamStock} available hain!`);
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        qty: Number(itemQty),
        unit: prod.unitType === "count" ? "Pieces/Bags" : "KG",
        maxGudamQty: gudamStock,
      },
    ]);

    setSelectedProductId("");
    setItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.warn("Customer / Party Name enter karein");
      return;
    }
    if (items.length === 0) {
      toast.warn("At least 1 item add karein");
      return;
    }

    try {
      const created = await issueGatePass(ownerId, {
        customerName: customerName.trim(),
        customerId: customerId || undefined,
        vehicleNo: vehicleNo.trim(),
        driverName: driverName.trim(),
        notes: notes.trim(),
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          qty: i.qty,
          unit: i.unit,
        })),
      });

      toast.success(`Gate Pass #${created.gatePassNo} successfully issued!`);
      setPrintPass(created);

      // Reset Form
      setCustomerName("");
      setCustomerId("");
      setVehicleNo("");
      setDriverName("");
      setNotes("");
      setItems([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to issue gate pass");
    }
  };

  const filteredPasses = gatePasses.filter(
    (gp) =>
      gp.gatePassNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gp.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (gp.vehicleNo && gp.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-stone-900 flex items-center gap-2">
            <FileText className="text-brand-600" size={24} /> Gate Pass (Gudam Dispatch)
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Gudam se party ko maal dene ke liye parchi print karein aur stock minus karein
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 bg-stone-100 p-1.5 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("issue")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-lg transition ${
              activeTab === "issue"
                ? "bg-brand-600 text-white shadow"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Plus size={16} /> Naya Gate Pass
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-lg transition ${
              activeTab === "history"
                ? "bg-brand-600 text-white shadow"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <FileText size={16} /> Record & History ({gatePasses.length})
          </button>
        </div>
      </div>

      {activeTab === "issue" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700 border-b pb-3">
              Party & Vehicle Details
            </h2>

            <form onSubmit={handleCreateGatePass} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select Customer or Enter Name */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Party / Customer Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Party ka naam likhein ya select karein"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustomerId("");
                      }}
                      className="input-field pl-9"
                      required
                    />
                    <User className="absolute left-3 top-2.5 text-stone-400" size={16} />
                  </div>
                  {customers.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const c = customers.find((cust) => cust.id === e.target.value);
                          if (c) {
                            setCustomerName(c.name);
                            setCustomerId(c.id);
                          }
                        }
                      }}
                      className="mt-1.5 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-1.5 w-full"
                    >
                      <option value="">-- Ya Registered Party Select Karein --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Vehicle No */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Gari No. / Vehicle No. (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. LES-1234 / Suzuki"
                      value={vehicleNo}
                      onChange={(e) => setVehicleNo(e.target.value)}
                      className="input-field pl-9"
                    />
                    <Truck className="absolute left-3 top-2.5 text-stone-400" size={16} />
                  </div>
                </div>

                {/* Driver Name */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Driver Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Driver ka naam"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="input-field"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Notes / Instruction (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Special Bags / Order Ref"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Add Items Box */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-2">
                  <Package size={16} className="text-brand-600" /> Gudam Stock Items Add Karein
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">-- Product Select Karein --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Gudam Stock: {p.gudamStock ?? 0} {p.unitType === "count" ? "Bags" : "KG"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={itemQty}
                      onChange={(e) => setItemQty(Math.max(1, Number(e.target.value)))}
                      className="input-field w-24"
                    />
                    <button
                      type="button"
                      onClick={handleAddProductToPass}
                      className="btn-primary flex-1 !py-2 text-xs font-bold"
                    >
                      Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Added Items Table */}
              {items.length > 0 && (
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-100 text-stone-700 uppercase font-bold border-b border-stone-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Item Name</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-stone-50">
                          <td className="p-3 font-bold text-stone-500">{idx + 1}</td>
                          <td className="p-3 font-bold text-stone-900">{it.productName}</td>
                          <td className="p-3 font-extrabold text-brand-700">
                            {it.qty} {it.unit}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="submit"
                disabled={items.length === 0}
                className="btn-primary w-full !py-3.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 size={18} /> Issue Gate Pass & Print Parchi
              </button>
            </form>
          </div>

          {/* Quick Summary / Gudam Stock Status */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4 h-fit">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 border-b pb-2">
              📦 Current Gudam Stock Summary
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-100"
                >
                  <div>
                    <p className="text-xs font-bold text-stone-900">{p.name}</p>
                    <p className="text-[11px] text-stone-500">
                      Category: {p.category || "General"}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                      (p.gudamStock ?? 0) > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {p.gudamStock ?? 0} {p.unitType === "count" ? "Bags" : "KG"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
              Issued Gate Passes History
            </h2>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search Gate Pass # / Party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-9 text-xs"
              />
              <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 font-bold uppercase">
                <tr>
                  <th className="p-3">Gate Pass #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Items & Qty</th>
                  <th className="p-3">Vehicle No</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPasses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-stone-400">
                      Koi Gate Pass record nahi mila
                    </td>
                  </tr>
                ) : (
                  filteredPasses.map((gp) => (
                    <tr key={gp.id} className="hover:bg-stone-50">
                      <td className="p-3 font-extrabold text-brand-700">{gp.gatePassNo}</td>
                      <td className="p-3 text-stone-500">
                        {new Date(gp.date).toLocaleDateString("en-PK", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 font-bold text-stone-900">{gp.customerName}</td>
                      <td className="p-3 font-medium text-stone-700">
                        {gp.items.map((i) => `${i.productName} (${i.qty} ${i.unit || ""})`).join(", ")}
                      </td>
                      <td className="p-3 text-stone-600">{gp.vehicleNo || "-"}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          {gp.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setPrintPass(gp)}
                          className="btn-ghost !py-1 !px-2.5 text-xs flex items-center gap-1.5 ml-auto"
                        >
                          <Printer size={14} /> Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Modal (A4 & Thermal options) */}
      {printPass && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-brand-600" />
                <h3 className="font-extrabold text-stone-900 text-sm">
                  Gate Pass #{printPass.gatePassNo} Print Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={printFormat}
                  onChange={(e) => setPrintFormat(e.target.value as "A4" | "thermal")}
                  className="text-xs bg-white border border-stone-300 rounded-lg px-2 py-1 font-bold"
                >
                  <option value="A4">A4 Slip Format</option>
                  <option value="thermal">80mm Thermal Slip</option>
                </select>
                <button
                  onClick={() => setPrintPass(null)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Print Area */}
            <div className="p-6 overflow-y-auto flex-1 bg-stone-100" id="print-area">
              <div
                className={`bg-white p-6 rounded-xl shadow border border-stone-200 mx-auto ${
                  printFormat === "thermal" ? "max-w-[300px] text-xs" : "max-w-md text-sm"
                }`}
              >
                {/* Receipt Header */}
                <div className="text-center border-b pb-4 mb-4">
                  <h2 className="font-black text-lg text-stone-900 uppercase tracking-wide">
                    {currentShop?.shopName || "TRADERS GUDAM"}
                  </h2>
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-widest mt-0.5">
                    *** GATE PASS / DISPATCH SLIP ***
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Pass #: <span className="font-bold text-stone-800">{printPass.gatePassNo}</span> | Date:{" "}
                    {new Date(printPass.date).toLocaleDateString()}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-1 mb-4 text-stone-800 text-xs">
                  <p>
                    <span className="font-bold">Party Name:</span> {printPass.customerName}
                  </p>
                  {printPass.vehicleNo && (
                    <p>
                      <span className="font-bold">Vehicle No:</span> {printPass.vehicleNo}
                    </p>
                  )}
                  {printPass.driverName && (
                    <p>
                      <span className="font-bold">Driver Name:</span> {printPass.driverName}
                    </p>
                  )}
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border-t border-b border-stone-300 my-3">
                  <thead>
                    <tr className="border-b border-stone-200 font-bold text-stone-700">
                      <th className="py-2">Item</th>
                      <th className="py-2 text-right">Dispatch Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {printPass.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-bold text-stone-900">{it.productName}</td>
                        <td className="py-2 text-right font-black text-stone-900">
                          {it.qty} {it.unit || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {printPass.notes && (
                  <p className="text-[11px] text-stone-500 italic mb-4">
                    Note: {printPass.notes}
                  </p>
                )}

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 mt-8 text-center text-[10px] text-stone-500 pt-4 border-t border-dashed border-stone-300">
                  <div>
                    <div className="border-b border-stone-400 h-6 mb-1"></div>
                    <span>Gudam Incharge Sign</span>
                  </div>
                  <div>
                    <div className="border-b border-stone-400 h-6 mb-1"></div>
                    <span>Receiver / Driver Sign</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-3">
              <button onClick={() => setPrintPass(null)} className="btn-ghost text-xs">
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary text-xs font-bold flex items-center gap-2 !py-2"
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
