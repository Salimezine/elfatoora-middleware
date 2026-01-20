import assert from "node:assert";
import { describe, it } from "node:test";
import {
  extractRefTtnVal,
  parseConsultEfactResponse,
} from "../parse-consult-efact-response";

describe("parseConsultEfactResponse", () => {
  it("should parse valid SOAP response with items", () => {
    const soapXml = `
    <Envelope>
      <Body>
        <consultEfactResponse>
          <items>
            <item>
              <documentNumber>DOC001</documentNumber>
              <idSaveEfact>123</idSaveEfact>
              <documentType>INVOICE</documentType>
              <dateProcess>2024-01-01</dateProcess>
              <dateDocument>2024-01-01</dateDocument>
              <amountTax>100</amountTax>
              <amount>1000</amount>
              <generatedRef>REF001</generatedRef>
            </item>
          </items>
        </consultEfactResponse>
      </Body>
    </Envelope>
  `;

    const result = parseConsultEfactResponse(soapXml);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].documentNumber, "DOC001");
  });

  it("should handle SOAP Fault response", () => {
    const soapXml = `
    <Envelope>
      <Body>
        <Fault>
          <faultstring>Authentication failed</faultstring>
        </Fault>
      </Body>
    </Envelope>
  `;

    const result = parseConsultEfactResponse(soapXml);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "Authentication failed");
  });

  it("should return error for invalid XML", () => {
    const result = parseConsultEfactResponse("invalid xml");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "Invalid XML response");
  });

  it("should handle backward compatibility with efactCriteria", () => {
    const soapXml = `
    <Envelope>
      <Body>
        <return>
          <efactCriteria>
            <documentNumber>DOC002</documentNumber>
            <amount>500</amount>
          </efactCriteria>
        </return>
      </Body>
    </Envelope>
  `;

    const result = parseConsultEfactResponse(soapXml);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[0].amount, 500);
  });

  it("should parse acknowledgments", () => {
    const soapXml = `
    <Envelope>
      <Body>
        <consultEfactResponse>
          <items>
            <item>
              <documentNumber>DOC003</documentNumber>
              <listAcknowlegments>
                <acknowledgment>
                  <code>200</code>
                  <message>Success</message>
                </acknowledgment>
              </listAcknowlegments>
            </item>
          </items>
        </consultEfactResponse>
      </Body>
    </Envelope>
  `;

    const result = parseConsultEfactResponse(soapXml);
    assert.strictEqual(result.items[0].acknowledgments?.length, 1);
    assert.strictEqual(result.items[0].acknowledgments?.[0].code, "200");
  });
});

describe("extractRefTtnVal", () => {
  it("should extract RefTtnVal from valid XML", () => {
    const xmlContent = `
    <Invoice>
      <RefTtnVal>
        <ReferenceTTN>
          <text>#text</text>
        </ReferenceTTN>
        <ReferenceDate>
          <DateText>
            <text>1609201239</text>
          </DateText>
        </ReferenceDate>
        <ReferenceCEV>QR123BASE64</ReferenceCEV>
      </RefTtnVal>
    </Invoice>
  `;

    const result = extractRefTtnVal(xmlContent);
    assert.ok(result);
    assert.strictEqual(result.qrCodeBase64, "QR123BASE64");
  });

  it("should return undefined for empty input", () => {
    const result = extractRefTtnVal("");
    assert.strictEqual(result, undefined);
  });

  it("should return undefined for invalid XML", () => {
    const result = extractRefTtnVal("invalid xml");
    assert.strictEqual(result, undefined);
  });

  it("should throw error for incomplete RefTtnVal data", () => {
    const xmlContent = `
    <Invoice>
      <RefTtnVal>
        <ReferenceTTN>
          <text>#text</text>
        </ReferenceTTN>
      </RefTtnVal>
    </Invoice>
  `;

    assert.throws(
      () => extractRefTtnVal(xmlContent),
      /Incomplete RefTtnVal data/,
    );
  });
});
