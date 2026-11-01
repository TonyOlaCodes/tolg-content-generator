/**
 * Original Apple Notes records. Values are preserved exactly as written.
 * `date` is "DD/MM" as recorded (no year), so it is flagged as incomplete.
 * `null` means no date was recorded.
 */

export interface SeedReading {
  odometerKm: number;
  rangeKm: number;
  date: string | null;
  note?: string;
}

export interface SeedPurchase {
  station: string;
  total: number | null;
  price: number | null;
  litres: number | null;
  date: string | null;
  note?: string;
  readings: SeedReading[];
}

export const SEED_VERSION = 1;

export const SEED_PURCHASES: SeedPurchase[] = [
  {
    station: "Circle K",
    total: null,
    price: null,
    litres: null,
    date: null,
    note: "No price or amount recorded. The final entry has an unverified date annotation of 5/11 that may conflict with the sequence.",
    readings: [
      { odometerKm: 394021, rangeKm: 465, date: null },
      { odometerKm: 394089, rangeKm: 345, date: null },
      { odometerKm: 394167, rangeKm: 287, date: null },
      { odometerKm: 394224, rangeKm: 238, date: "5/11", note: "Conflicting date annotation, unverified" },
    ],
  },
  {
    station: "Emo",
    total: 50.2,
    price: 2.129,
    litres: null,
    date: null,
    note: "Litres approximate, calculated from the recorded total and price.",
    readings: [
      { odometerKm: 394524, rangeKm: 381, date: "09/10" },
      { odometerKm: 394638, rangeKm: 294, date: "10/10" },
      { odometerKm: 394769, rangeKm: 185, date: "12/10" },
      { odometerKm: 394796, rangeKm: 159, date: "13/10" },
      { odometerKm: 394939, rangeKm: 49, date: "14/10" },
    ],
  },
  {
    station: "Emo",
    total: 50.01,
    price: 2.119,
    litres: null,
    date: null,
    note: "Litres approximate, calculated from the recorded total and price.",
    readings: [
      { odometerKm: 394947, rangeKm: 408, date: "14/10" },
      { odometerKm: 395057, rangeKm: 333, date: "14/10" },
      { odometerKm: 395223, rangeKm: 194, date: null, note: "Date unknown" },
      { odometerKm: 395388, rangeKm: 63, date: "19/10" },
    ],
  },
  {
    station: "Texaco",
    total: 75.22,
    price: 2.149,
    litres: 35,
    date: null,
    note: "Forgot to measure after buying 19/10.",
    readings: [
      { odometerKm: 395511, rangeKm: 554, date: "20/10" },
      { odometerKm: 395570, rangeKm: 494, date: null },
      { odometerKm: 395633, rangeKm: 441, date: null },
      { odometerKm: 395885, rangeKm: 226, date: null },
      { odometerKm: 395911, rangeKm: 196, date: null },
      { odometerKm: 395968, rangeKm: 146, date: null },
      { odometerKm: 396024, rangeKm: 107, date: null },
    ],
  },
  {
    station: "Emo",
    total: 75.92,
    price: null,
    litres: 35,
    date: null,
    note: "Price per litre calculated from total and litres.",
    readings: [
      { odometerKm: 396157, rangeKm: 629, date: null },
      { odometerKm: 396354, rangeKm: 392, date: null },
    ],
  },
];

export const SEED_READING_COUNT = SEED_PURCHASES.reduce((n, p) => n + p.readings.length, 0);
