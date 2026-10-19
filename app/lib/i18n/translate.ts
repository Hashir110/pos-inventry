import { useLanguage } from "../../store/useLanguage";
import type { TranslationKey } from "./translations";

export const tr = (key: TranslationKey, params?: Record<string, string | number>): string =>
  useLanguage.getState().t(key, params);