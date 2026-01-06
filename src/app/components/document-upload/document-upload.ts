import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, finalize } from 'rxjs';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { Document, DocumentType } from '../../core/models';

@Component({
  selector: 'app-document-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.css'
})
export class DocumentUpload implements OnInit, OnDestroy {
  private router = inject(Router);
  private documentService = inject(DocumentService);
  private w2SharedService = inject(W2SharedService);
  private dataRefreshService = inject(DataRefreshService);
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

  // Selected document type for upload
  selectedType: DocumentType = DocumentType.W2;
  documentTypes = [
    { value: DocumentType.W2, label: 'W2' },
    { value: DocumentType.PAYMENT_PROOF, label: 'Comprobante de Pago' },
    { value: DocumentType.OTHER, label: 'Otro' }
  ];

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
    this.isLoading = true;

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
        this.errorMessage = error.message || 'Error al cargar documentos';
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
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 25 * 1024 * 1024; // 25MB (matching backend)

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        this.errorMessage = `El archivo "${file.name}" no es valido. Solo se permiten PDF, PNG o JPG.`;
        continue;
      }

      // Validate file size
      if (file.size > maxSize) {
        this.errorMessage = `El archivo "${file.name}" es muy grande. Maximo 25MB.`;
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
        this.successMessage = `Archivo "${file.name}" subido correctamente!`;
        this.isUploading = false;

        // Mark this document type as uploaded (for green checkmark)
        this.uploadedTypes.add(this.selectedType);

        // If it's a W2, show the calculator popup
        if (this.selectedType === DocumentType.W2) {
          this.lastUploadedW2 = response.document;
          this.showW2Popup = true;
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error.message || `Error al subir "${file.name}"`;
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
        this.errorMessage = error.message || 'Error al descargar archivo';
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
        this.successMessage = 'Archivo eliminado correctamente';
        this.deletingDocId = null;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al eliminar archivo';
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
