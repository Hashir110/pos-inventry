export interface StockLevels {
  shopStock: number;
  gudamStock: number;
}

export const deductStock = ({ shopStock, gudamStock }: StockLevels, qty: number): StockLevels => {
  const takeShop = Math.min(Math.max(shopStock, 0), qty);
  const takeGudam = Math.min(Math.max(gudamStock, 0), qty - takeShop);
  const deficit = qty - takeShop - takeGudam;
  return { shopStock: shopStock - takeShop - deficit, gudamStock: gudamStock - takeGudam };
};

export const addStock = (levels: StockLevels, qty: number, destination: "shop" | "gudam"): StockLevels => {
  let shopStock = levels.shopStock + (destination === "shop" ? qty : 0);
  let gudamStock = levels.gudamStock + (destination === "gudam" ? qty : 0);
  if (shopStock < 0 && gudamStock > 0) {
    const cover = Math.min(-shopStock, gudamStock);
    shopStock += cover;
    gudamStock -= cover;
  }
  return { shopStock, gudamStock };
};