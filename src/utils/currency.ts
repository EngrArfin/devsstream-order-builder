export function roundHalfUpPercent(amountPoisha: number, percent: number): number {
  return Math.floor((amountPoisha * percent + 50) / 100);
}

export function roundHalfUpToWholeBdt(amountPoisha: number): number {
  return Math.floor((amountPoisha + 50) / 100);
}

export function formatPoishaAsBdt(
  poisha: number,
  options: { decimals?: number; withUnit?: boolean } = {}
): string {
  const { decimals = 2, withUnit = true } = options;
  const bdt = poisha / 100;
  const formatted = bdt.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withUnit ? `${formatted} BDT` : formatted;
}
