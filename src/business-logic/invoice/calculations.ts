// src/business-logic/invoice/calculations.ts

/**
 * ---------------------------------------------------------------------
 * Invoice business calculations
 * ---------------------------------------------------------------------
 * Pure, deterministic functions.
 * No dependency on Zod, Express, TEIF, or IO.
 */

/**
 * Monetary rounding rule
 * TEIF-compatible: round to 3 decimals (can be adjusted centrally)
 */
export function round(amount: number): number {
  return Math.round(amount * 1000) / 1000;
}

/**
 * ---------------------------------------------------------------------
 * Line-level calculations
 * ---------------------------------------------------------------------
 */

export interface LineForCalculation {
  quantity: number;
  unitPrice: { amount: number };
  discountRate?: number;
}

/**
 * Calculate a single line total (HT)
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountRate?: number
): number {
  const base = quantity * unitPrice;
  const discount = discountRate !== undefined ? base * (discountRate / 100) : 0;

  return round(base - discount);
}

/**
 * Calculate invoice subtotal (HT)
 */
export function calculateSubtotal(lines: LineForCalculation[]): number {
  return round(
    lines.reduce(
      (sum, line) =>
        sum +
        calculateLineTotal(
          line.quantity,
          line.unitPrice.amount,
          line.discountRate
        ),
      0
    )
  );
}

/**
 * ---------------------------------------------------------------------
 * Allowances / Withholding
 * ---------------------------------------------------------------------
 */

export type InvoiceAllowance = {
  type: "DISCOUNT" | "SURCHARGE" | "WITHHOLDING";
  amount: { amount: number; currency?: string };
};

/**
 * Calculate total withholding amount
 * (only WITHHOLDING allowances are considered)
 */
export function calculateWithholding(allowances?: InvoiceAllowance[]): number {
  if (!allowances || allowances.length === 0) return 0;

  return round(
    allowances
      .filter(
        (a): a is InvoiceAllowance & { type: "WITHHOLDING" } =>
          a.type === "WITHHOLDING"
      )
      .reduce((sum, a) => sum + a.amount.amount, 0)
  );
}

/**
 * ---------------------------------------------------------------------
 * Invoice totals helpers
 * ---------------------------------------------------------------------
 */

/**
 * Calculate expected TTC
 * TTC = HT + TAX - WITHHOLDING
 */
export function calculateTotalTTC(params: {
  subtotalHT: number;
  totalTax: number;
  allowances?: InvoiceAllowance[];
}): number {
  const withholding = calculateWithholding(params.allowances);

  return round(params.subtotalHT + params.totalTax - withholding);
}
