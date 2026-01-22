import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Document } from '../models';

export interface W2UploadEvent {
  file: File;
  source: 'documents' | 'calculator';
  document?: Document;
}

@Injectable({
  providedIn: 'root'
})
export class W2SharedService {
  // Track if W2 has been uploaded (from either source)
  private w2UploadedSubject = new BehaviorSubject<W2UploadEvent | null>(null);
  w2Uploaded$ = this.w2UploadedSubject.asObservable();

  // Store pending W2 file from calculator that needs to be saved
  private pendingW2File: File | null = null;

  // Notify when W2 is uploaded
  notifyW2Uploaded(event: W2UploadEvent) {
    this.w2UploadedSubject.next(event);
  }

  // Store file temporarily from calculator
  setPendingW2(file: File) {
    this.pendingW2File = file;
  }

  // Get and clear pending W2
  getPendingW2(): File | null {
    const file = this.pendingW2File;
    this.pendingW2File = null;
    return file;
  }

  // Check if there's a pending W2
  hasPendingW2(): boolean {
    return this.pendingW2File !== null;
  }

  // Clear the W2 state
  clear() {
    this.w2UploadedSubject.next(null);
    this.pendingW2File = null;
  }
}

