import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Check karein ke user ka Shop Profile bana huwa hai ya nahi
export const getUserShopProfile = async (uid) => {
  try {
    const userDocRef = doc(db, "users", uid); // 'users' collection mein owner ka data
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return userDoc.data(); // Shop data wapis karega
    } else {
      return null; // Matlab banda naya hai, Setup page par bhejo
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

// Naya Shop Create karne ka function
export const createShopProfile = async (user, shopDetails) => {
  try {
    const userDocRef = doc(db, "users", user.uid);

    const newShopData = {
      uid: user.uid,
      email: user.email,
      shopName: shopDetails.shopName,
      businessType: shopDetails.businessType, // Grocery, Medical, etc.
      currency: "PKR", // Default
      createdAt: shopDetails.createdAt || new Date().toISOString(),
      licenseExpiry: shopDetails.licenseExpiry
    };

    await setDoc(userDocRef, newShopData);
    return newShopData;
  } catch (error) {
    console.error("Error creating shop:", error);
    throw error;
  }
};