import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { consultDocumentWS } from "../consult-doc.js";

describe("consultDocumentWS", () => {
  const mockCredentials = {
    login: "testuser",
    password: "testpass",
    taxId: "1234567",
  };

  let fetchMock: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;

  beforeEach(() => {
    fetchMock = global.fetch as any;
  });

  afterEach(() => {
    global.fetch = fetchMock;
  });

  it("should successfully consult a document", async () => {
    const mockResponse = `<?xml version="1.0"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <consultEfactResponse>
            <items>
              <item>
                <documentNumber>DOC001</documentNumber>
                <status>VALID</status>
              </item>
            </items>
          </consultEfactResponse>
        </soap:Body>
      </soap:Envelope>`;

    global.fetch = async () =>
      new Response(mockResponse, { status: 200, statusText: "OK" });

    const result = await consultDocumentWS(
      "DOC001",
      mockCredentials.taxId,
      mockCredentials,
    );
    assert.strictEqual(result.success, true);
    assert.ok("item" in result && result.item);
  });

  it("should handle HTTP errors", async () => {
    global.fetch = async () =>
      new Response("Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      });

    const result = await consultDocumentWS(
      "DOC001",
      mockCredentials.taxId,
      mockCredentials,
    );
    assert.strictEqual(result.success, false);
    assert.ok("error" in result && result.error.includes("HTTP 500"));
  });

  it("should handle empty response items", async () => {
    const mockResponse = `<?xml version="1.0"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <consultEfactResponse>
            <items></items>
          </consultEfactResponse>
        </soap:Body>
      </soap:Envelope>`;

    global.fetch = async () =>
      new Response(mockResponse, { status: 200, statusText: "OK" });

    const result = await consultDocumentWS(
      "DOC001",
      mockCredentials.taxId,
      mockCredentials,
    );
    assert.strictEqual(result.success, false);
    assert.ok("error" in result && result.error.includes("No items found"));
  });

  it("should escape XML special characters in credentials", async () => {
    let capturedBody = "";
    global.fetch = async (_, init) => {
      capturedBody = init?.body as string;
      return new Response("<soap:Envelope></soap:Envelope>", { status: 200 });
    };

    await consultDocumentWS("DOC001", "<id>", {
      login: "user&pass",
      password: 'pass"word',
    });

    assert.ok(capturedBody.includes("&amp;"));
    assert.ok(capturedBody.includes("&quot;"));
    assert.ok(capturedBody.includes("&lt;"));
  });

  it("should include rawResponse in result", async () => {
    const mockResponse = `<response>test</response>`;
    global.fetch = async () => new Response(mockResponse, { status: 200 });

    const result = await consultDocumentWS(
      "DOC001",
      mockCredentials.taxId,
      mockCredentials,
    );
    assert.strictEqual(result.rawResponse, mockResponse);
  });
});
