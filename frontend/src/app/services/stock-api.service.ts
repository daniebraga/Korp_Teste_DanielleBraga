import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../core/environment';
import { Product } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.stockApiUrl;

  listProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.base}/api/products`).pipe(catchError(this.mapError));
  }

  createProduct(payload: { code: string; description: string; balance: number }): Observable<Product> {
    return this.http.post<Product>(`${this.base}/api/products`, payload).pipe(catchError(this.mapError));
  }

  updateProduct(id: string, payload: { code: string; description: string; balance: number }): Observable<Product> {
    return this.http.put<Product>(`${this.base}/api/products/${id}`, payload).pipe(catchError(this.mapError));
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/products/${id}`).pipe(catchError(this.mapError));
  }

  health(): Observable<{ status: string; service: string }> {
    return this.http.get<{ status: string; service: string }>(`${this.base}/health`).pipe(catchError(this.mapError));
  }

  private mapError(err: HttpErrorResponse): Observable<never> {
    const body = err.error as { message?: string; detail?: string; title?: string } | string | null;
    let message = err.message;
    if (body && typeof body === 'object') {
      message = body.message ?? body.detail ?? body.title ?? message;
    }
    return throwError(() => new Error(message));
  }
}
