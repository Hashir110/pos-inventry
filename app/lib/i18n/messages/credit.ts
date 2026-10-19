const en = {
  credit_loadFailed: "Failed to load customers",
  credit_addSuccess: "Customer added",
  credit_addFailed: "Failed to add customer. Please check your internet connection.",
  credit_partyNamePlaceholder: "Party name",
  credit_noCustomers: "No customers found.",
  credit_collect: "Collect",
  credit_historyLoadFailed: "Failed to load history",
  credit_returnNote: "(Return: {amount})",
};

const ur: Record<keyof typeof en, string> = {
  credit_loadFailed: "کسٹمرز لوڈ نہیں ہو سکے",
  credit_addSuccess: "کسٹمر شامل ہو گیا",
  credit_addFailed: "کسٹمر شامل نہیں ہو سکا، انٹرنیٹ چیک کریں",
  credit_partyNamePlaceholder: "پارٹی کا نام",
  credit_noCustomers: "کوئی کسٹمر نہیں ملا۔",
  credit_collect: "وصول کریں",
  credit_historyLoadFailed: "ہسٹری لوڈ نہیں ہو سکی",
  credit_returnNote: "(واپسی: {amount})",
};

export const credit = { en, ur };
