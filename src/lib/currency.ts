export function formatNaira(price: string | number | undefined): string {
  const num = Number(price) || 0
  return `₦${num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}