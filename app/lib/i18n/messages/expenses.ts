const en = {
  expenses_added: "Expense added",
  expenses_addFailed: "Failed to add expense",
  expenses_deleteTitle: "Delete expense?",
  expenses_deleteMessage: "This expense will be permanently removed.",
  expenses_catGeneral: "General",
  expenses_catFood: "Food / Tea",
  expenses_catTransport: "Transport",
  expenses_catUtility: "Bills / Utilities",
  expenses_catSalary: "Salary / Wages",
};

const ur: Record<keyof typeof en, string> = {
  expenses_added: "خرچہ شامل ہو گیا",
  expenses_addFailed: "خرچہ شامل نہیں ہو سکا",
  expenses_deleteTitle: "خرچہ حذف کریں؟",
  expenses_deleteMessage: "یہ خرچہ ہمیشہ کے لیے حذف ہو جائے گا۔",
  expenses_catGeneral: "عمومی",
  expenses_catFood: "کھانا / چائے",
  expenses_catTransport: "ٹرانسپورٹ",
  expenses_catUtility: "بل / یوٹیلیٹی",
  expenses_catSalary: "تنخواہ / مزدوری",
};

export const expenses = { en, ur };
