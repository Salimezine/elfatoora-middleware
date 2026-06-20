import * as assert from "node:assert";
import { Buffer } from "node:buffer";
import { describe, test } from "node:test";
// Set required env vars for env() before any module import that calls it
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.PUBLIC_BASE_URL = "http://localhost:3000";
process.env.TTN_HANDLING_MODE = "WS";
import { submitToTTN, TTNCredentials } from "../submit-to-ttn";

describe("submitToTTN", () => {
  const mockCredentials: TTNCredentials = {
    login: "testuser",
    password: "testpass",
    taxId: "1234567",
  };

  const mockSignedXml = '<?xml version="1.0"?><invoice><id>123</id></invoice>';

  test("should submit XML as string and return success", async () => {
    const mockResponse = '<?xml version="1.0"?><soap:Envelope></soap:Envelope>';

    global.fetch = async () =>
      new Response(mockResponse, { status: 200, statusText: "OK" });

    const result = await submitToTTN(mockSignedXml, mockCredentials);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.rawResponse, mockResponse);
    assert.strictEqual(result.error, undefined);
  });

  test("should submit XML as Buffer and return success", async () => {
    const mockResponse = '<?xml version="1.0"?><soap:Envelope></soap:Envelope>';
    const xmlBuffer = Buffer.from(mockSignedXml, "utf8");

    global.fetch = async () =>
      new Response(mockResponse, { status: 200, statusText: "OK" });

    const result = await submitToTTN(xmlBuffer, mockCredentials);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.rawResponse, mockResponse);
  });

  test("should handle HTTP error response", async () => {
    global.fetch = async () =>
      new Response("Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      });

    const result = await submitToTTN(mockSignedXml, mockCredentials);

    assert.strictEqual(result.success, false);
    assert.match(result.error!, /HTTP 500/);
  });

  test("should detect and extract SOAP fault", async () => {
    const soapFaultResponse = `<?xml version="1.0"?>
<soap:Envelope>
  <soap:Body>
    <soap:Fault>
      <faultcode>Client</faultcode>
      <faultstring>Invalid credentials</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;

    global.fetch = async () =>
      new Response(soapFaultResponse, { status: 200, statusText: "OK" });

    const result = await submitToTTN(mockSignedXml, mockCredentials);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "Invalid credentials");
  });

  test("should escape XML special characters in credentials", async () => {
    const credentialsWithSpecialChars: TTNCredentials = {
      login: "test&user<>",
      password: "pass\"word'",
      taxId: "123<456",
    };

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.match(init?.body as string, /test&amp;user&lt;&gt;/);
      assert.match(init?.body as string, /pass&quot;word&apos;/);
      assert.match(init?.body as string, /123&lt;456/);
      return new Response(
        '<?xml version="1.0"?><soap:Envelope></soap:Envelope>',
        {
          status: 200,
        },
      );
    };

    await submitToTTN(mockSignedXml, credentialsWithSpecialChars);
  });

  test("should handle SOAP fault with faultcode marker", async () => {
    const faultResponse = `<response><faultcode>ServerFault</faultcode></response>`;

    global.fetch = async () =>
      new Response(faultResponse, { status: 200, statusText: "OK" });

    const result = await submitToTTN(mockSignedXml, mockCredentials);

    assert.strictEqual(result.success, false);
  });

  test("should include rawResponse in all results", async () => {
    const mockResponse = "Raw response content";

    global.fetch = async () =>
      new Response(mockResponse, { status: 200, statusText: "OK" });

    const result = await submitToTTN(mockSignedXml, mockCredentials);

    assert.strictEqual(result.rawResponse, mockResponse);
  });
});
