import assert from "node:assert/strict";
import test from "node:test";
import { PartySchema } from "../invoice.schema.js";

test("PartySchema – valid FISCAL_ID", () => {
  const result = PartySchema.safeParse({
    identifierType: "FISCAL_ID",
    identifier: "1234567AAM000",
    name: "ACME SARL",
  });

  assert.equal(result.success, true);
});

test("PartySchema – invalid FISCAL_ID format", () => {
  const result = PartySchema.safeParse({
    identifierType: "FISCAL_ID",
    identifier: "123ABC",
    name: "ACME SARL",
  });

  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some(
      (i) => i.path.join(".") === "identifier" && i.message.includes("fiscal")
    )
  );
});

test("PartySchema – valid CIN", () => {
  const result = PartySchema.safeParse({
    identifierType: "CIN",
    identifier: "01234567",
    name: "John Doe",
  });

  assert.equal(result.success, true);
});

test("PartySchema – CIN must be 8 digits", () => {
  const result = PartySchema.safeParse({
    identifierType: "CIN",
    identifier: "1234",
    name: "John Doe",
  });

  assert.equal(result.success, false);
});
