import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLineTotal,
  calculateSubtotal,
  calculateTotalTTC,
  calculateWithholding,
  round,
  type InvoiceAllowance,
  type LineForCalculation,
} from "../calculations";

/**
 * ---------------------------------------------------------------------
 * round()
 * ---------------------------------------------------------------------
 */
test("round: rounds to 3 decimals", () => {
  assert.equal(round(10.1234), 10.123);
  assert.equal(round(10.1235), 10.124);
});

test("round: handles integers", () => {
  assert.equal(round(10), 10);
});

test("round: handles floating point precision issues", () => {
  assert.equal(round(0.1 + 0.2), 0.3);
});

/**
 * ---------------------------------------------------------------------
 * calculateLineTotal()
 * ---------------------------------------------------------------------
 */
test("calculateLineTotal: without discount", () => {
  assert.equal(calculateLineTotal(2, 50), 100);
});

test("calculateLineTotal: with discount", () => {
  assert.equal(calculateLineTotal(2, 50, 10), 90);
});

test("calculateLineTotal: zero quantity", () => {
  assert.equal(calculateLineTotal(0, 100), 0);
});

test("calculateLineTotal: applies rounding", () => {
  assert.equal(calculateLineTotal(3, 33.3333), 100);
});

/**
 * ---------------------------------------------------------------------
 * calculateSubtotal()
 * ---------------------------------------------------------------------
 */
test("calculateSubtotal: multiple lines", () => {
  const lines: LineForCalculation[] = [
    { quantity: 2, unitPrice: { amount: 50 } },
    { quantity: 1, unitPrice: { amount: 100 }, discountRate: 10 },
  ];

  // 100 + 90
  assert.equal(calculateSubtotal(lines), 190);
});

test("calculateSubtotal: empty array returns 0", () => {
  assert.equal(calculateSubtotal([]), 0);
});

test("calculateSubtotal: rounding on accumulated total", () => {
  const lines: LineForCalculation[] = [
    { quantity: 1, unitPrice: { amount: 33.3333 } },
    { quantity: 2, unitPrice: { amount: 33.3333 } },
  ];

  // 33.333 + 66.666 = 99.999 → 100
  assert.equal(calculateSubtotal(lines), 100);
});

/**
 * ---------------------------------------------------------------------
 * calculateWithholding()
 * ---------------------------------------------------------------------
 */
test("calculateWithholding: undefined allowances", () => {
  assert.equal(calculateWithholding(), 0);
});

test("calculateWithholding: ignores non-withholding allowances", () => {
  const allowances: InvoiceAllowance[] = [
    { type: "DISCOUNT", amount: { amount: 50 } },
    { type: "SURCHARGE", amount: { amount: 20 } },
  ];

  assert.equal(calculateWithholding(allowances), 0);
});

test("calculateWithholding: sums withholding only", () => {
  const allowances: InvoiceAllowance[] = [
    { type: "WITHHOLDING", amount: { amount: 10 } },
    { type: "WITHHOLDING", amount: { amount: 5.5555 } },
    { type: "DISCOUNT", amount: { amount: 100 } },
  ];

  // 10 + 5.5555 = 15.5555 → 15.556
  assert.equal(calculateWithholding(allowances), 15.556);
});

/**
 * ---------------------------------------------------------------------
 * calculateTotalTTC()
 * ---------------------------------------------------------------------
 */
test("calculateTotalTTC: without withholding", () => {
  const total = calculateTotalTTC({
    subtotalHT: 100,
    totalTax: 19,
  });

  assert.equal(total, 119);
});

test("calculateTotalTTC: with withholding", () => {
  const allowances: InvoiceAllowance[] = [
    { type: "WITHHOLDING", amount: { amount: 10 } },
  ];

  const total = calculateTotalTTC({
    subtotalHT: 200,
    totalTax: 38,
    allowances,
  });

  // 200 + 38 - 10
  assert.equal(total, 228);
});

test("calculateTotalTTC: rounding final result", () => {
  const allowances: InvoiceAllowance[] = [
    { type: "WITHHOLDING", amount: { amount: 0.3333 } },
  ];

  const total = calculateTotalTTC({
    subtotalHT: 100.1111,
    totalTax: 19.2222,
    allowances,
  });

  // 100.111 + 19.222 - 0.333 = 118.999 → 119
  assert.equal(total, 119);
});
