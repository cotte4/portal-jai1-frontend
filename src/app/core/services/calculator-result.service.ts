import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CalculatorResult {
  estimatedRefund: number;
  calculatedAt: string;
  documentName?: string;
  box2Federal?: number;
  box17State?: number;
  ocrConfidence?: string;
  fromBackend?: boolean; // True if synced from backend (cross-device)
  requiresReview?: boolean; // True if $0 result (likely OCR error, needs manual review)
}

@Injectable({
  providedIn: 'root'
})
export class CalculatorResultService {
  private readonly STORAGE_KEY = 'jai1_calculator_result';

  private resultSubject = new BehaviorSubject<CalculatorResult | null>(this.loadFromStorage());
  result$ = this.resultSubject.asObservable();

  private loadFromStorage(): CalculatorResult | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  saveResult(estimatedRefund: number, documentName?: string, extra?: Partial<CalculatorResult>): void {
    const result: CalculatorResult = {
      estimatedRefund,
      calculatedAt: new Date().toISOString(),
      documentName,
      ...extra
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result));
    this.resultSubject.next(result);
  }

  /**
   * Sync result from backend API response
   * Used when loading existing estimate from server (cross-device sync)
   */
  syncFromBackend(backendEstimate: {
    estimatedRefund: number;
    w2FileName?: string;
    box2Federal?: number;
    box17State?: number;
    ocrConfidence?: string;
    createdAt?: string;
    requiresReview?: boolean;
  }): void {
    const result: CalculatorResult = {
      estimatedRefund: backendEstimate.estimatedRefund,
      calculatedAt: backendEstimate.createdAt || new Date().toISOString(),
      documentName: backendEstimate.w2FileName,
      box2Federal: backendEstimate.box2Federal,
      box17State: backendEstimate.box17State,
      ocrConfidence: backendEstimate.ocrConfidence,
      fromBackend: true,
      requiresReview: backendEstimate.requiresReview
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(result));
    this.resultSubject.next(result);
  }

  getResult(): CalculatorResult | null {
    return this.resultSubject.value;
  }

  hasResult(): boolean {
    return this.resultSubject.value !== null;
  }

  clearResult(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.resultSubject.next(null);
  }
}

