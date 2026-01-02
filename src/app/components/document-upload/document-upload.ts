import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { Document, DocumentType } from '../../core/models';

@Component({
  selector: 'app-document-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.css'
})
export class DocumentUpload implements OnInit {
  private router = inject(Router);
  private documentService = inject(DocumentService);
  private w2SharedService = inject(W2SharedService);

  uploadedFiles: Document[] = [];
  dragOver: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  isUploading: boolean = false;

  // W2 Calculator Popup
  showW2Popup: boolean = false;
  lastUploadedW2: Document | null = null;

  // Selected document type for upload
  selectedType: DocumentType = DocumentType.W2;
  documentTypes = [
    { value: DocumentType.W2, label: 'W2' },
    { value: DocumentType.PAYMENT_PROOF, label: 'Comprobante de Pago' },
    { value: DocumentType.OTHER, label: 'Otro' }
  ];

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.isLoading = true;
    this.documentService.getDocuments().subscribe({
      next: (documents) => {
        this.uploadedFiles = documents;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al cargar documentos';
        this.isLoading = false;
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

      // Upload file
      this.uploadFile(file);
    }

    // Clear the input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.value = '';
  }

  uploadFile(file: File) {
    this.isUploading = true;

    this.documentService.upload(file, this.selectedType).subscribe({
      next: (response) => {
        this.uploadedFiles.push(response.document);
        this.successMessage = `Archivo "${file.name}" subido correctamente!`;
        this.isUploading = false;

        // If it's a W2, show the calculator popup
        if (this.selectedType === DocumentType.W2) {
          this.lastUploadedW2 = response.document;
          this.showW2Popup = true;
        }
      },
      error: (error) => {
        this.errorMessage = error.message || `Error al subir "${file.name}"`;
        this.isUploading = false;
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
    if (doc.isReviewed) {
      this.errorMessage = 'Este documento ya fue revisado. Contacta soporte para eliminarlo.';
      return;
    }

    this.documentService.delete(doc.id).subscribe({
      next: () => {
        this.uploadedFiles.splice(index, 1);
        this.successMessage = 'Archivo eliminado correctamente';
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al eliminar archivo';
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
