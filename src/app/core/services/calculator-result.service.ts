import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CalculatorResult {
  estimatedRefund: number;
  calculatedAt: string;
  documentName?: string;
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

  saveResult(estimatedRefund: number, documentName?: string): void {
    const result: CalculatorResult = {
      estimatedRefund,
      calculatedAt: new Date().toISOString(),
      documentName
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

