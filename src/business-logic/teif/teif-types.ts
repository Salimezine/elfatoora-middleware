export interface TeifInvoiceXml {
  TEIF: {
    "@_version": TeifVersion;
    "@_controlingAgency": TeifControllingAgency;

    InvoiceHeader: TeifInvoiceHeader;
    InvoiceBody: TeifInvoiceBody;
    "ds:Signature"?: TeifSignature[];
    RefTtnVal?: TeifRefTtnVal;
    AdditionnalDocuments?: unknown;
  };
}

export type TeifVersion =
  | "1.8.8"
  | "1.8.7"
  | "1.8.6"
  | "1.8.5"
  | "1.8.4"
  | "1.8.3"
  | "1.8.2"
  | "1.8.1";

export type TeifControllingAgency = "TTN" | "Tunisie TradeNet";

export interface TeifInvoiceHeader {
  MessageSenderIdentifier: TeifMessageIdentifier;
  MessageRecieverIdentifier: TeifMessageIdentifier;
}

export interface TeifMessageIdentifier {
  "@_type": string;
  "#text": string;
}

export type TeifDocumentType = {
  "@_code": string;
  "#text": string;
};

export interface TeifInvoiceBody {
  Bgm: TeifBgm;
  Dtm: TeifDtm;
  PartnerSection: TeifPartnerSection;
  PytSection?: TeifPytSection;
  LinSection: TeifLinSection;
  InvoiceMoa?: TeifInvoiceMoa;
  InvoiceTax?: TeifInvoiceTax;
}

export interface TeifBgm {
  DocumentIdentifier: string;
  DocumentType: TeifDocumentType;
}

export interface TeifDtm {
  DateText: TeifDateText[];
}

export interface TeifDateText {
  "@_format": string;
  "@_functionCode": string;
  "#text": string;
}

export interface TeifPartnerSection {
  PartnerDetails: TeifPartnerDetails[];
}

export interface TeifPartnerDetails {
  "@_functionCode": string;
  Nad: TeifNad;
  RffSection?: TeifRffSection[];
  CtaSection?: TeifCtaSection[];
}

export interface TeifNad {
  PartnerIdentifier: TeifIdentifier;
  PartnerName: TeifPartnerName;
  PartnerAdresses?: TeifPartnerAddresses;
}

export interface TeifIdentifier {
  "@_type": string;
  "#text": string;
}

export interface TeifPartnerName {
  "@_nameType": string;
  "#text": string;
}

export interface TeifPartnerAddresses {
  "@_lang": string;
  StreetName?: string;
  CityName?: string;
  CountrySubDivisionCode?: string;
  PostCodeIdentifier?: string;
  CountryIdentificationCode?: string;
}

export interface TeifRffSection {
  Reference: TeifReference;
}

export interface TeifReference {
  "@_refID": string;
  "#text": string;
}

export interface TeifCtaSection {
  Contact: TeifContact;
  Communication?: TeifCommunication;
}

export interface TeifContact {
  "@_functionCode": string;
  NameAndAddress?: string;
  DepartmentOrSubDepartmentIdentification?: string;
}

export interface TeifCommunication {
  CommunicationAddressCode?: string;
  CommunicationAddress?: string;
}

export interface TeifPytSection {
  PytSectionDetails: TeifPytSectionDetails[];
}

export interface TeifPytSectionDetails {
  Pyt: TeifPyt;
  PytFii?: TeifPytFii;
}

export interface TeifPyt {
  PaymentConditionCode?: string;
  PaymentDueDate?: string;
  PaymentTermsDescription?: string;
}

export interface TeifPytFii {
  "@_functionCode": string;
  FinancialInstitutionInformation?: string;
}

export interface TeifLinSection {
  Lin: TeifLine[];
}

export interface TeifLine {
  ItemIdentifier: string;
  LinImd: TeifLinImd;
  LinQty?: TeifLinQty;
  LinTax?: TeifLinTax;
  LinMoa?: TeifLinMoa;
}

export interface TeifLinImd {
  "@_lang": string;
  ItemDescription: string;
}

export interface TeifLinQty {
  Quantity: string;
  UnitBasisQuantity?: string;
}

export interface TeifLinTax {
  TaxTypeCode?: string;
  TaxCategoryCode?: string;
  TaxRate?: string;
}

export interface TeifLinMoa {
  UnitPriceMoa?: TeifMoa;
  LineTotalMoa?: TeifMoa;
  AllowanceChargeMoa?: TeifMoa[];
}

export interface TeifMoa {
  "@_amountTypeCode": string;
  "@_currencyCodeList"?: string;
  Amount: string;
}

export interface TeifInvoiceMoa {
  AmountDetails: TeifAmountDetail[];
}

export interface TeifAmountDetail {
  Moa: TeifMoa;
}

export interface TeifInvoiceTax {
  InvoiceTaxDetails: TeifInvoiceTaxDetail[];
}

export interface TeifInvoiceTaxDetail {
  Tax: TeifTax;
  AmountDetails?: TeifAmountDetail[];
}

export interface TeifTax {
  TaxTypeCode?: string;
  TaxCategoryCode?: string;
  TaxRate?: string;
}

export interface TeifSignature {
  "@_Id": string;
  "@_xmlns:ds": string;
  SignedInfo: TeifSignedInfo;
  SignatureValue: TeifSignatureValue;
  KeyInfo: TeifKeyInfo;
  Object?: TeifSignatureObject;
}

export interface TeifSignedInfo {
  CanonicalizationMethod: { "@_Algorithm": string };
  SignatureMethod: { "@_Algorithm": string };
  Reference: TeifSignatureReference[];
}

export interface TeifSignatureReference {
  "@_Id": string;
  "@_Type": string;
  "@_URI": string;
  Transforms?: { Transform: Array<{ "@_Algorithm": string }> };
  DigestMethod: { "@_Algorithm": string };
  DigestValue: string;
}

export interface TeifSignatureValue {
  "@_Id": string;
  "#text": string;
}

export interface TeifKeyInfo {
  X509Data: TeifX509Data;
}

export interface TeifX509Data {
  X509Certificate: string[];
}

export interface TeifSignatureObject {
  QualifyingProperties: TeifQualifyingProperties;
}

export interface TeifQualifyingProperties {
  SignedProperties: TeifSignedProperties;
}

export interface TeifSignedProperties {
  SignedSignatureProperties?: unknown;
  SignedDataObjectProperties?: unknown;
}

export interface TeifRefTtnVal {
  ReferenceTTN: TeifReferenceTTN;
  ReferenceDate: TeifReferenceDate;
  ReferenceCEV: string;
}

export interface TeifReferenceTTN {
  "@_refID": string;
  "#text": string;
}

export interface TeifReferenceDate {
  DateText: TeifDateText;
}
