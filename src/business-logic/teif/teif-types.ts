export interface TeifInvoiceXml {
  Invoice: {
    Header: {
      InvoiceNumber: string;
      IssueDate: string;
      InvoiceType: string;
      Currency: string;
    };
    Seller: PartyXml;
    Buyer: PartyXml;
    Lines: {
      Line: LineXml[];
    };
    Totals: {
      Subtotal: string;
      TaxTotal: string;
      GrandTotal: string;
    };
  };
}

interface PartyXml {
  Name: string;
  TaxId: string;
  Address: {
    Street: string;
    City: string;
    Country: string;
  };
}

interface LineXml {
  LineNumber: number;
  Description: string;
  Quantity: string;
  UnitPrice: string;
  LineTotal: string;
  TaxRate: string;
}
