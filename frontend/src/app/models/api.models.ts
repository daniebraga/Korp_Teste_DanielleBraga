export interface Product {
  id: string;
  code: string;
  description: string;
  balance: number;
}

export interface InvoiceLine {
  id: string;
  productId: string;
  productCode: string;
  productDescription: string;
  quantity: number;
}

export interface Invoice {
  id: string;
  sequentialNumber: number;
  status: 'Aberta' | 'Fechada';
  lines: InvoiceLine[];
}

export interface ApiErrorBody {
  message?: string;
}
