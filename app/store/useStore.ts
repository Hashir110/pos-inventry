import { create } from "zustand";
import type { User } from "firebase/auth";
import type { Shop } from "../types";

interface StoreState {
  currentUser: User | null;
  currentShop: Shop | null;
  isLoading: boolean;

  setCurrentUser: (user: User | null) => void;
  setCurrentShop: (shop: Shop | null) => void;
  setLoading: (status: boolean) => void;
  /** Logout par */
  resetStore: () => void;
}

export const useStore = create<StoreState>((set) => ({
  currentUser: null,
  currentShop: null,
  isLoading: true,

  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentShop: (shop) => set({ currentShop: shop }),
  setLoading: (status) => set({ isLoading: status }),
  resetStore: () => set({ currentUser: null, currentShop: null }),
}));
