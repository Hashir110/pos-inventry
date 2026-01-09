import { create } from 'zustand';

export const useStore = create((set) => ({
  // User State
  currentUser: null,
  isLoading: true,
  
  // Shop State (SaaS Logic)
  currentShop: null, // Yahan shop ki details ayengi (name, currency etc)

  // Actions
  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentShop: (shop) => set({ currentShop: shop }),
  setLoading: (status) => set({ isLoading: status }),
  
  // Reset (Logout ke liye)
  resetStore: () => set({ currentUser: null, currentShop: null })
}));