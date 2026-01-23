import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, finalize } from 'rxjs';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { ToastService } from '../../core/services/toast.service';
import { CalculatorResultService } from '../../core/services/calculator-result.service';
import { Document, DocumentType } from '../../core/models';
import { APP_CONSTANTS } from '../../core/constants/app.constants';

@Component({
  selector: 'app-document-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentUpload implements OnInit, OnDestroy {
  private router = inject(Router);
  private documentService = inject(DocumentService);
  private w2SharedService = inject(W2SharedService);
  private dataRefreshService = inject(DataRefreshService);
  private toastService = inject(ToastService);
  private calculatorResultService = inject(CalculatorResultService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  uploadedFiles: Document[] = [];
  dragOver: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  hasLoaded: boolean = false;
  private isLoadingInProgress: boolean = false;
  isUploading: boolean = false;
  deletingDocId: string | null = null;

  // W2 Calculator Popup
  showW2Popup: boolean = false;
  lastUploadedW2: Document | null = null;

  // Confirmation popup
  showConfirmPopup: boolean = false;
  pendingFile: File | null = null;

  // Track which document types have been uploaded
  uploadedTypes: Set<DocumentType> = new Set();

  // Toggle to show upload view even when all docs are complete
  showUploadView: boolean = false;

  // Selected document type for upload
  selectedType: DocumentType = DocumentType.W2;
  documentTypes = [
    { value: DocumentType.W2, label: 'W2' },
    { value: DocumentType.PAYMENT_PROOF, label: 'Comprobante de Pago' },
    { value: DocumentType.OTHER, label: 'Otro' }
  ];

  // Payment Instructions Modal
  showPaymentInstructions: boolean = false;

  // Check if payment proof tab is selected
  get isPaymentProofSelected(): boolean {
    return this.selectedType === DocumentType.PAYMENT_PROOF;
  }

  openPaymentInstructions() {
    this.showPaymentInstructions = true;
  }

  closePaymentInstructions() {
    this.showPaymentInstructions = false;
  }

  ngOnInit() {
    this.loadDocuments();

    // Auto-refresh on navigation
    this.subscriptions.add(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects === '/documents')
      ).subscribe(() => this.loadDocuments())
    );

    // Allow other components to trigger refresh
    this.subscriptions.add(
      this.dataRefreshService.onRefresh('/documents').subscribe(() => this.loadDocuments())
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadDocuments() {
    if (this.isLoadingInProgress) return;
    this.isLoadingInProgress = true;
    // Keep hasLoaded = false until API completes to show loading spinner

    this.documentService.getDocuments().pipe(
      finalize(() => {
        this.hasLoaded = true;
        this.isLoading = false;
        this.isLoadingInProgress = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (documents) => {
        this.uploadedFiles = documents;

        // Populate uploadedTypes from existing documents
        this.uploadedTypes.clear();
        documents.forEach(doc => this.uploadedTypes.add(doc.type));
      },
      error: (error) => {
        this.toastService.error(error.message || 'Error al cargar documentos');
      }
    });
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    this.processFiles(files);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;

    const files = event.dataTransfer?.files;
    if (files) {
      this.processFiles(files);
    }
  }

  processFiles(files: FileList) {
    this.errorMessage = '';
    this.successMessage = '';

    // Allowed file types
    const allowedTypes = APP_CONSTANTS.SUPPORTED_DOCUMENT_TYPES;
    const maxSize = APP_CONSTANTS.MAX_FILE_SIZE_BYTES;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        this.toastService.warning(`El archivo "${file.name}" no es válido. Solo se permiten PDF, PNG o JPG.`);
        continue;
      }

      // Validate file size
      if (file.size > maxSize) {
        this.toastService.warning(`El archivo "${file.name}" es muy grande. Máximo 25MB.`);
        continue;
      }

      // Show confirmation popup instead of direct upload
      this.pendingFile = file;
      this.showConfirmPopup = true;
      break; // Only process one file at a time for confirmation
    }

    // Clear the input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.value = '';
  }

  // Confirmation popup actions
  confirmUpload() {
    this.showConfirmPopup = false;
    if (this.pendingFile) {
      this.uploadFile(this.pendingFile);
      this.pendingFile = null;
    }
  }

  cancelUpload() {
    this.showConfirmPopup = false;
    this.pendingFile = null;
    this.successMessage = '';
    this.errorMessage = '';
  }

  getSelectedTypeLabel(): string {
    const found = this.documentTypes.find(t => t.value === this.selectedType);
    return found?.label || '';
  }

  uploadFile(file: File) {
    this.isUploading = true;

    this.documentService.upload(file, this.selectedType).subscribe({
      next: (response) => {
        this.uploadedFiles.push(response.document);
        this.toastService.success(`Archivo "${file.name}" subido correctamente!`);
        this.isUploading = false;

        // Mark this document type as uploaded (for green checkmark)
        this.uploadedTypes.add(this.selectedType);

        // If it's a W2, only show calculator popup if user doesn't have an existing estimate
        if (this.selectedType === DocumentType.W2) {
          const existingResult = this.calculatorResultService.getResult();
          const hasValidEstimate = existingResult && existingResult.estimatedRefund > 0;

          if (!hasValidEstimate) {
            // No estimate or estimate is 0 - offer to calculate
            this.lastUploadedW2 = response.document;
            this.showW2Popup = true;
          } else {
            // User already has an estimate - just upload the document, don't ask
            // Keep existing estimatedRefund value
          }
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastService.error(error.message || `Error al subir "${file.name}"`);
        this.isUploading = false;
        this.cdr.detectChanges();
      }
    });
  }

  downloadFile(doc: Document) {
    this.documentService.getDownloadUrl(doc.id).subscribe({
      next: (response) => {
        window.open(response.url, '_blank');
      },
      error: (error) => {
        this.toastService.error(error.message || 'Error al descargar archivo');
      }
    });
  }

  removeFile(doc: Document, index: number) {
    // Prevent double-click
    if (this.deletingDocId) {
      return;
    }

    if (doc.isReviewed) {
      this.errorMessage = 'Este documento ya fue revisado. Contacta soporte para eliminarlo.';
      return;
    }

    this.deletingDocId = doc.id;
    this.errorMessage = '';

    this.documentService.delete(doc.id).subscribe({
      next: () => {
        this.uploadedFiles.splice(index, 1);
        this.toastService.success('Archivo eliminado correctamente');
        this.deletingDocId = null;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastService.error(error.message || 'Error al eliminar archivo');
        this.deletingDocId = null;
        this.cdr.detectChanges();
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getFileIcon(type: string): string {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    return '📎';
  }

  getDocumentTypeLabel(type: DocumentType): string {
    const found = this.documentTypes.find(t => t.value === type);
    return found?.label || type;
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // Check if all required documents are uploaded
  get allRequiredDocsUploaded(): boolean {
    return this.uploadedTypes.has(DocumentType.W2) &&
           this.uploadedTypes.has(DocumentType.PAYMENT_PROOF);
  }

  get hasW2(): boolean {
    return this.uploadedTypes.has(DocumentType.W2);
  }

  get hasPaymentProof(): boolean {
    return this.uploadedTypes.has(DocumentType.PAYMENT_PROOF);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goToTaxForm() {
    this.router.navigate(['/tax-form']);
  }

  // W2 Popup actions
  goToCalculator() {
    this.showW2Popup = false;
    if (this.lastUploadedW2) {
      this.w2SharedService.notifyW2Uploaded({
        file: new File([], this.lastUploadedW2.fileName),
        source: 'documents',
        document: this.lastUploadedW2
      });
    }
    this.router.navigate(['/tax-calculator']);
  }

  closeW2Popup() {
    this.showW2Popup = false;
    this.lastUploadedW2 = null;
  }
}
