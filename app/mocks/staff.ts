// app/mocks/staff.ts
// TODO: connect logic with backend staff and shift roster service in next phase

export interface MockStaffMember {
  id: string;
  name: string;
  role: "Cashier" | "Branch Manager" | "Inventory Stocker" | "Rider";
  shift: "Shift A (Morning)" | "Shift B (Evening)" | "Full Day";
  phone: string;
  assignedRegister: string;
  status: "On-Duty" | "Off-Duty" | "On-Break";
  startingFloat: number;
}

export const mockStaffMetrics = {
  totalStaff: 8,
  activeOnDuty: 3,
  activeRegisters: 2,
  activeShift: "Shift A (Morning)",
};

export const mockStaffList: MockStaffMember[] = [
  {
    id: "staff-1",
    name: "Hamza Malik",
    role: "Cashier",
    shift: "Shift A (Morning)",
    phone: "0300-8472910",
    assignedRegister: "Register #01",
    status: "On-Duty",
    startingFloat: 15000,
  },
  {
    id: "staff-2",
    name: "Bilal Raza",
    role: "Cashier",
    shift: "Shift B (Evening)",
    phone: "0321-4458921",
    assignedRegister: "Register #02",
    status: "Off-Duty",
    startingFloat: 10000,
  },
  {
    id: "staff-3",
    name: "Asad Khan",
    role: "Branch Manager",
    shift: "Full Day",
    phone: "0302-5551920",
    assignedRegister: "Manager Station",
    status: "On-Duty",
    startingFloat: 0,
  },
  {
    id: "staff-4",
    name: "Ayesha Bibi",
    role: "Cashier",
    shift: "Shift A (Morning)",
    phone: "0333-4819201",
    assignedRegister: "Relief Register",
    status: "On-Duty",
    startingFloat: 5000,
  },
];
