const en = {
  settings_saved: "Settings saved successfully",
  settings_saveError: "Could not save settings",
  settings_inventory: "Inventory",
  settings_clearTitle: "Delete all {label}?",
  settings_clearMessage: "All {label} data will be permanently deleted and cannot be recovered.",
  settings_clearConfirm: "Delete Everything",
  settings_cleared: "{label} cleared",
  settings_clearFailed: "Could not delete data",
  settings_addressPlaceholder: "Shop address",
  settings_receiptPlaceholder: "Message shown at the bottom of the receipt (optional)",
};

const ur: Record<keyof typeof en, string> = {
  settings_saved: "سیٹنگز کامیابی سے محفوظ ہو گئیں",
  settings_saveError: "سیٹنگز محفوظ نہیں ہو سکیں",
  settings_inventory: "انوینٹری",
  settings_clearTitle: "پوری {label} حذف کریں؟",
  settings_clearMessage: "{label} کا تمام ڈیٹا ہمیشہ کے لیے حذف ہو جائے گا اور واپس نہیں آئے گا۔",
  settings_clearConfirm: "سب حذف کریں",
  settings_cleared: "{label} صاف کر دی گئی",
  settings_clearFailed: "ڈیٹا حذف نہیں ہو سکا",
  settings_addressPlaceholder: "دکان کا پتہ",
  settings_receiptPlaceholder: "رسید کے نیچے کا پیغام (اختیاری)",
};

export const settings = { en, ur };
