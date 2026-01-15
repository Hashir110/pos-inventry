"use client";
import { useState } from 'react';
import { db } from '../../lib/firebase'; // Apni config path set karein
import { doc, getDoc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { Search, RotateCcw, AlertCircle } from 'lucide-react';

export default function ReturnsPage() {
    const [invoiceId, setInvoiceId] = useState('');
    const [saleData, setSaleData] = useState(null);
    const [loading, setLoading] = useState(false);
    // const { user } = useAuth(); // User ID chahiye hogi



    // 1. Invoice Search Karna
    const handleSearch = async (e) => {
        e.preventDefault();


        if (!invoiceId) return;
        setLoading(true);
        setSaleData(null);

        try {
            const docRef = doc(db, "sales", invoiceId.trim());
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setSaleData({ id: docSnap.id, ...docSnap.data() });
            } else {
                toast.error("Invoice not found!");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error searching invoice");
        }
        setLoading(false);
    };

    // 2. Return Process Karna (Single Item)
    const handleReturnItem = async (item, index) => {
        // ... (Prompt aur Validation wala hissa same rahega) ...

        // Log for debugging
        console.log("🔍 INSPECT ITEM:", JSON.stringify(item, null, 2));

        const availableToReturn = item.qty - (item.returnedQty || 0);
        const qtyStr = prompt(`How many "${item.name}" to return? (Max: ${availableToReturn})`);

        if (!qtyStr) return;

        const returnQty = parseFloat(qtyStr);

        if (isNaN(returnQty) || returnQty <= 0) return toast.error("Invalid Quantity!");
        if (returnQty > availableToReturn) return toast.error(`Error: Max limit is ${availableToReturn}`);

        try {
            setLoading(true);

            // 1. ID Solution (Jo aapne pehle lagaya tha)
            const actualProductId = item.productId || item.id;
            console.log("🎯 Stock Update ID:", actualProductId);

            if (actualProductId) {
                const productRef = doc(db, "products", actualProductId);

                // 🔥 FIX 1: ownerId bhejna zaroori hai security rules ke liye
                await updateDoc(productRef, {
                    stock: increment(returnQty),
                    ownerId: saleData.ownerId
                });
            } else {
                toast.warning("⚠️ Stock update skipped (ID missing)");
            }

            // 2. Price Calculation
            const unitPrice = item.sellingPrice !== undefined ? parseFloat(item.sellingPrice) : parseFloat(item.price || 0);
            const refundAmount = returnQty * unitPrice;

            if (isNaN(refundAmount)) throw new Error("Price calculation error");

            // 3. Sales Document Update
            const saleRef = doc(db, "sales", saleData.id);
            const updatedItems = [...saleData.items];
            if (!updatedItems[index].returnedQty) updatedItems[index].returnedQty = 0;
            updatedItems[index].returnedQty += returnQty;

            await updateDoc(saleRef, {
                items: updatedItems,
                refundedAmount: increment(refundAmount),
                ownerId: saleData.ownerId // 🔥 Ahtiyatan yahan bhi bhej dein
            });

            // 4. Returns Collection Add
            await addDoc(collection(db, "returns"), {
                originalSaleId: saleData.id,
                itemName: item.name,
                qty: returnQty,
                unitPrice: unitPrice,
                refundAmount: refundAmount,
                date: new Date().toISOString(),
                ownerId: saleData.ownerId // 🔥 FIX 2: Variable name corrected
            });

            toast.success(`Returned ${returnQty} x ${item.name} Successfully!`);

            // UI Refresh
            const updatedDocSnap = await getDoc(saleRef);
            setSaleData({ id: updatedDocSnap.id, ...updatedDocSnap.data() });

        } catch (error) {
            console.error("Return Error:", error);
            toast.error("Return Failed! (Check Console for details)");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <RotateCcw className="text-blue-600" /> Process Return
            </h1>

            {/* Search Section */}
            <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                <input
                    type="text"
                    placeholder="Enter Invoice ID (e.g. 7A2b...)"
                    className="flex-1 border p-3 rounded-lg focus:ring-2 ring-blue-500 outline-none"
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                />
                <button
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? "Searching..." : "Find Invoice"}
                </button>
            </form>

            {/* Results Section */}
            {saleData && (
                <div className="bg-white p-6 rounded-xl shadow border">
                    <div className="flex justify-between items-start mb-4 border-b pb-4">
                        <div>
                            <p className="text-sm text-gray-500">Invoice ID</p>
                            <p className="font-mono font-bold">{saleData.id}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Date</p>
                            <p className="font-medium">{new Date(saleData.date).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <h3 className="font-bold text-lg mb-3">Items Purchased</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="p-3">Item</th>
                                    <th className="p-3">Price</th>
                                    <th className="p-3">Sold Qty</th>
                                    <th className="p-3">Returned</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {saleData.items.map((item, index) => {
                                    const alreadyReturned = item.returnedQty || 0;
                                    const canReturn = item.qty - alreadyReturned > 0;

                                    return (
                                        <tr key={index}>
                                            <td className="p-3 font-medium">{item.name}</td>
                                            <td className="p-3">{item.sellingPrice || item.price}</td>
                                            <td className="p-3">{item.qty}</td>
                                            <td className="p-3 text-red-500 font-bold">
                                                {alreadyReturned > 0 ? `-${alreadyReturned}` : '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                {canReturn ? (
                                                    <button
                                                        onClick={() => handleReturnItem(item, index)}
                                                        className="bg-red-100 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-200 transition text-xs font-bold"
                                                    >
                                                        Return Item
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">Fully Returned</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}