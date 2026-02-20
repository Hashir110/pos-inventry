"use client";
import { Lock, Phone, Clock } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function LicenseExpiredPage() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type"); // check karega ke URL mein '?type=trial' hai ya nahi

  // --- DYNAMIC CONTENT LOGIC ---
  const isTrial = type === "trial";
  
  const title = isTrial ? "Free Trial Expired!" : "License Expired";
  
  const message = isTrial 
    ? "Aapka 7 din ka muft trial khatam ho chuka hai. Apne system ko regular chalane aur data mehfooz rakhne ke liye package upgrade karein."
    : "Aapke software ka license expire ho chuka hai. Bara-e-meharbani service continue rakhne ke liye apni monthly payment clear karein.";
    
  // Styling bhi dynamic kar di (Trial ke liye Orange, License ke liye Red)
  const Icon = isTrial ? Clock : Lock;
  const iconColor = isTrial ? "text-orange-600" : "text-red-600";
  const bgIconColor = isTrial ? "bg-orange-100" : "bg-red-100";
  const borderColor = isTrial ? "border-orange-200" : "border-red-200";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
      <div className={`bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border ${borderColor}`}>
        
        {/* Dynamic Icon */}
        <div className={`mx-auto ${bgIconColor} w-20 h-20 rounded-full flex items-center justify-center mb-6`}>
            <Icon className={`h-10 w-10 ${iconColor}`} />
        </div>
        
        {/* Dynamic Text */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{title}</h1>
        <p className="text-gray-500 mb-6 leading-relaxed">
          {message}
        </p>

        {/* Support Box */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Contact Support:</p>
            <div className="flex items-center justify-center gap-2 text-xl font-bold text-blue-600 tracking-wide">
                <Phone size={20} />
                <span>0314-2811181</span> 
            </div>
        </div>
        
        {/* Logout Button */}
        <button 
            onClick={() => window.location.href = "/"}
            className="mt-6 text-sm text-gray-400 hover:text-gray-700 font-medium underline transition-colors"
        >
            Logout & Go to Home
        </button>
      </div>
    </div>
  );
}