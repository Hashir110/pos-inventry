const en = {
  credit_loadFailed: "Failed to load customers",
  credit_addSuccess: "Customer added",
  credit_addFailed: "Failed to add customer. Please check your internet connection.",
  credit_partyNamePlaceholder: "Party name",
  credit_noCustomers: "No customers found.",
  credit_collect: "Collect",
  credit_historyLoadFailed: "Failed to load history",
  credit_returnNote: "(Return: {amount})",
  credit_editCustomer: "Edit Party",
  credit_editSuccess: "Party updated successfully",
  credit_editFailed: "Failed to update party",
  credit_deleteCustomer: "Delete Party",
  credit_deleteConfirm: "Are you sure you want to delete {name}?",
  credit_deleteBalanceWarning: "Warning: This customer has an outstanding balance of {balance}.",
  credit_deleteSuccess: "Party deleted successfully",
  credit_deleteFailed: "Failed to delete party",
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
  credit_editCustomer: "پارٹی تبدیل کریں",
  credit_editSuccess: "پارٹی کی تفصیلات محفوظ ہو گئیں",
  credit_editFailed: "پارٹی تبدیل نہیں ہو سکی",
  credit_deleteCustomer: "پارٹی حذف کریں",
  credit_deleteConfirm: "کیا آپ واقعی {name} کو حذف کرنا چاہتے ہیں؟",
  credit_deleteBalanceWarning: "انتباہ: اس کسٹمر کا بقایا بیلنس {balance} ہے۔",
  credit_deleteSuccess: "پارٹی حذف کر دی گئی",
  credit_deleteFailed: "پارٹی حذف نہیں ہو سکی",
};

export const credit = { en, ur };
