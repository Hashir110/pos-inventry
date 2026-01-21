"use client";
import { Lock, Phone } from "lucide-react";

export default function LicenseExpiredPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
        <div className="mx-auto bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mb-6">
            <Lock className="h-10 w-10 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">License Expired</h1>
        <p className="text-gray-500 mb-6">
          Aapke software ka license expire ho chuka hai. Bara-e-meharbani service continue rakhne ke liye payment clear karein.
        </p>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Contact Support:</p>
            <div className="flex items-center justify-center gap-2 text-lg font-bold text-blue-600">
                <Phone size={20} />
                <span>03304201181</span> 
            </div>
        </div>
        
        <button 
            onClick={() => window.location.href = "/"}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline"
        >
            Logout & Try Again
        </button>
      </div>
    </div>
  );
}