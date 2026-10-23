/** Proposed prices — editable via env. Not claimed as validated. */
export const pricing = {
  starterMonthlyEur: Number(process.env.PLAN_STARTER_EUR ?? 79),
  growthMonthlyEur: Number(process.env.PLAN_GROWTH_EUR ?? 149),
  setupFeeEur: Number(process.env.SETUP_FEE_EUR ?? 149),
  currency: "EUR" as const,
};
