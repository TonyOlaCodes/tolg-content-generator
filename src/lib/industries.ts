import { Industry } from "@prisma/client";

export const INDUSTRY_LABELS: Record<Industry, string> = {
  CAR_DETAILING: "Car detailing & valeting",
  CLEANING: "Cleaning",
  MOBILE_MECHANICS: "Mobile mechanics",
  BARBERS_SALONS: "Barbers & salons",
  GARDEN_MAINTENANCE: "Garden maintenance",
  WINDOW_CLEANING: "Window cleaning",
  OTHER: "Other appointment-based service",
};

export type ServiceTemplate = {
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
};

export const DETAILING_SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    name: "Exterior Wash & Wax",
    description: "Hand wash, dry and protective wax for a clean finish.",
    durationMinutes: 90,
    priceCents: 4500,
  },
  {
    name: "Interior Deep Clean",
    description: "Vacuum, wipe-down, plastics, mats and glass interior.",
    durationMinutes: 120,
    priceCents: 6500,
  },
  {
    name: "Full Detail Package",
    description: "Exterior + interior detail for a complete refresh.",
    durationMinutes: 210,
    priceCents: 12000,
  },
  {
    name: "Mobile Express Valet",
    description: "On-site express clean at the customer location.",
    durationMinutes: 75,
    priceCents: 5500,
  },
];

export function defaultOperatingHours() {
  return {
    0: { closed: true, start: "09:00", end: "17:00" },
    1: { closed: false, start: "09:00", end: "18:00" },
    2: { closed: false, start: "09:00", end: "18:00" },
    3: { closed: false, start: "09:00", end: "18:00" },
    4: { closed: false, start: "09:00", end: "18:00" },
    5: { closed: false, start: "09:00", end: "18:00" },
    6: { closed: false, start: "10:00", end: "16:00" },
  };
}

export function detailingIntakeFields() {
  return [
    { key: "vehicleMake", label: "Vehicle make", type: "text", required: true },
    { key: "vehicleModel", label: "Vehicle model", type: "text", required: true },
    { key: "vehicleSize", label: "Vehicle size", type: "select", required: true, options: ["Small", "Medium", "Large", "Van/SUV"] },
    { key: "vehicleCondition", label: "Vehicle condition", type: "select", required: false, options: ["Good", "Average", "Heavy soiling"] },
  ];
}
