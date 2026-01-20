# EfactService WSDL Documentation

## 1. Overview

**Service Name:** `EfactServiceService`
**Target Namespace:**
`http://services.elfatoura.tradenet.com.tn/`

**Service Endpoint:**
`http://elfatoura.tradenet.com.tn:80/ElfatouraServices/EfactService`

**Protocol:** SOAP 1.1
**Style:** Document / Literal
**Transport:** HTTP

## 2. Service Description

The **EfactService** provides operations for managing electronic invoices (e-factures) and QR code verification.
It exposes three main SOAP operations:

1. `consultEfact`
2. `saveEfact`
3. `verifyQrCode`

## 3. Data Types

The service imports its XML schema from:

```
http://elfatoura.tradenet.com.tn:80/ElfatouraServices/EfactService?xsd=1
```

All request and response payloads are defined in this external XSD and belong to the namespace:

```
http://services.elfatoura.tradenet.com.tn/
```

## 4. Messages

### 4.1 consultEfact

**Request Message**

- Name: `consultEfact`
- Element: `tns:consultEfact`

**Response Message**

- Name: `consultEfactResponse`
- Element: `tns:consultEfactResponse`

### 4.2 saveEfact

**Request Message**

- Name: `saveEfact`
- Element: `tns:saveEfact`

**Response Message**

- Name: `saveEfactResponse`
- Element: `tns:saveEfactResponse`

### 4.3 verifyQrCode

**Request Message**

- Name: `verifyQrCode`
- Element: `tns:verifyQrCode`

**Response Message**

- Name: `verifyQrCodeResponse`
- Element: `tns:verifyQrCodeResponse`

## 5. Port Type (Interface)

### Port Type Name: `EfactService`

| Operation      | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| `consultEfact` | Consults an electronic invoice using provided search criteria |
| `saveEfact`    | Saves or submits an electronic invoice                        |
| `verifyQrCode` | Verifies the validity of an invoice QR code                   |

## 6. SOAP Actions

| Operation    | SOAP Action                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| consultEfact | `http://services.elfatoura.tradenet.com.tn/EfactService/consultEfactRequest` |
| saveEfact    | `http://services.elfatoura.tradenet.com.tn/EfactService/saveEfactRequest`    |
| verifyQrCode | `http://services.elfatoura.tradenet.com.tn/EfactService/verifyQrCodeRequest` |

## 7. Binding

**Binding Name:** `EfactServicePortBinding`
**Binding Type:** `tns:EfactService`

**SOAP Details:**

- Style: `document`
- Use: `literal`
- SOAP Action: empty (`""`)
- Transport: HTTP

Each operation uses:

```xml
<soap:body use="literal"/>
```

## 8. Service & Port

### Service Name

`EfactServiceService`

### Port Name

`EfactServicePort`

### Endpoint URL

```
http://elfatoura.tradenet.com.tn:80/ElfatouraServices/EfactService
```

## 9. Sample SOAP Envelope (Generic)

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ser="http://services.elfatoura.tradenet.com.tn/">
   <soapenv:Header/>
   <soapenv:Body>
      <ser:operationName>
         <!-- Request parameters -->
      </ser:operationName>
   </soapenv:Body>
</soapenv:Envelope>
```

Replace `operationName` with:

- `consultEfact`
- `saveEfact`
- `verifyQrCode`

## 10. Notes

- All operations are **synchronous**
- Errors are typically returned as SOAP Faults
