import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../core/environment';
import { ApiErrorBody, Invoice } from '../models/api.models';

export interface CreateInvoiceLineDto {
  productId: string;
  productCode: string;
  productDescription: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.billingApiUrl;

  listInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.base}/api/invoices`).pipe(catchError(this.mapError));
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/api/invoices/${id}`).pipe(catchError(this.mapError));
  }

  createInvoice(lines: CreateInvoiceLineDto[]): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/api/invoices`, { lines }).pipe(catchError(this.mapError));
  }

  printInvoice(id: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/api/invoices/${id}/print`, {}).pipe(catchError(this.mapError));
  }

  assistantHint(code: string): Observable<{ suggestion: string }> {
    const q = encodeURIComponent(code);
    return this.http
      .get<{ suggestion: string }>(`${this.base}/api/assistant/product-hint?code=${q}`)
      .pipe(catchError(this.mapError));
  }

  private mapError(err: HttpErrorResponse): Observable<never> {
    const body = err.error as ApiErrorBody & { detail?: string; title?: string } | string | null;
    let message = err.message;
    if (body && typeof body === 'object') {
      message = body.message ?? body.detail ?? body.title ?? message;
    }
    return throwError(() => new Error(message));
  }
}
