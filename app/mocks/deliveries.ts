// app/mocks/deliveries.ts
// TODO: connect logic with backend dispatch & delivery service in next phase

export interface MockDelivery {
  id: string;
  trackingNo: string;
  invoiceNo: string;
  customerName: string;
  phone: string;
  destination: string;
  riderName: string;
  codAmount: number;
  deliveryStatus: "Out for Delivery" | "Delivered" | "Dispatched" | "Returned";
  dispatchedAt: string;
}

export const mockDeliveryMetrics = {
  activeDispatches: 8,
  codCollectedToday: "Rs. 34,500",
  completedDeliveries: 24,
  activeRiders: 4,
};

export const mockDeliveriesList: MockDelivery[] = [
  {
    id: "del-1",
    trackingNo: "TRK-9812",
    invoiceNo: "INV-10892",
    customerName: "Mrs. Farooq",
    phone: "0300-8472910",
    destination: "House 42, St 7, Gulberg III",
    riderName: "Kashif Ali (Bike 02)",
    codAmount: 2450,
    deliveryStatus: "Out for Delivery",
    dispatchedAt: "18:15 PKT",
  },
  {
    id: "del-2",
    trackingNo: "TRK-9811",
    invoiceNo: "INV-10885",
    customerName: "Zahid Mehmood",
    phone: "0321-4458921",
    destination: "Plaza 14, Main Market Gulberg",
    riderName: "Nabeel Khan (Bike 01)",
    codAmount: 8900,
    deliveryStatus: "Delivered",
    dispatchedAt: "17:30 PKT",
  },
  {
    id: "del-3",
    trackingNo: "TRK-9810",
    invoiceNo: "INV-10879",
    customerName: "Dr. Salman Rafique",
    phone: "0302-5551920",
    destination: "Sector G, DHA Phase 1",
    riderName: "Kashif Ali (Bike 02)",
    codAmount: 4110,
    deliveryStatus: "Dispatched",
    dispatchedAt: "19:00 PKT",
  },
];
