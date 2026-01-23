import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ViewChild, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, finalize } from 'rxjs';
import { DocumentService } from '../../core/services/document.service';
import { W2SharedService } from '../../core/services/w2-shared.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AnimationService } from '../../core/services/animation.service';
import { Document, DocumentType } from '../../core/models';

@Component({
  selector: 'app-document-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.css'
})
export class DocumentUpload implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private documentService = inject(DocumentService);
  private w2SharedService = inject(W2SharedService);
  private dataRefreshService = inject(DataRefreshService);
  private animationService = inject(AnimationService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  // Template references for animations
  @ViewChild('uploadZone') uploadZoneRef!: ElementRef<HTMLElement>;
  @ViewChild('filesSection') filesSectionRef!: ElementRef<HTMLElement>;
  @ViewChildren('fileCard') fileCardRefs!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('progressBarFill') progressBarFillRef!: ElementRef<HTMLElement>;
  @ViewChild('successCheckmark') successCheckmarkRef!: ElementRef<HTMLElement>;

  // Track previously rendered file count for animation
  private previousFileCount = 0;

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

  ngAfterViewInit() {
    // Subscribe to file card changes to animate new cards
    this.fileCardRefs.changes.subscribe(() => {
      this.animateNewFileCards();
    });
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.animationService.killAnimations();
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

        // Animate initial file cards after view updates
        setTimeout(() => this.animateInitialFileCards(), 0);
      })
    ).subscribe({
      next: (documents) => {
        this.uploadedFiles = documents;
        this.previousFileCount = 0; // Reset for initial animation

        // Populate uploadedTypes from existing documents
        this.uploadedTypes.clear();
        documents.forEach(doc => this.uploadedTypes.add(doc.type));
      },
      error: (error) => {
        this.errorMessage = error.message || 'Error al cargar documentos';
      }
    });
  }

  /**
   * Animate initial file cards on page load
   */
  private animateInitialFileCards() {
    if (this.fileCardRefs && this.fileCardRefs.length > 0) {
      const cards = this.fileCardRefs.toArray().map(ref => ref.nativeElement);
      this.animationService.staggerIn(cards, {
        direction: 'left',
        distance: 30,
        stagger: 0.08
      });
      this.previousFileCount = this.uploadedFiles.length;
    }
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    this.processFiles(files);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.dragOver) {
      this.dragOver = true;
      // Pulse animation on drag over
      if (this.uploadZoneRef?.nativeElement) {
        this.animationService.pulse(this.uploadZoneRef.nativeElement, {
          scale: 1.02,
          duration: 0.3,
          repeat: -1
        });
      }
    }
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    // Stop pulse animation
    if (this.uploadZoneRef?.nativeElement) {
      this.animationService.killElementAnimations(this.uploadZoneRef.nativeElement);
      // Reset scale
      import('gsap').then(({ gsap }) => {
        gsap.to(this.uploadZoneRef.nativeElement, { scale: 1, duration: 0.2 });
      });
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;

    // Stop pulse animation and reset scale
    if (this.uploadZoneRef?.nativeElement) {
      this.animationService.killElementAnimations(this.uploadZoneRef.nativeElement);
      import('gsap').then(({ gsap }) => {
        gsap.to(this.uploadZoneRef.nativeElement, { scale: 1, duration: 0.2 });
      });
    }

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
    this.previousFileCount = this.uploadedFiles.length;

    // Animate progress bar if available
    if (this.progressBarFillRef?.nativeElement) {
      this.animationService.progressBar(this.progressBarFillRef.nativeElement, 100, {
        duration: 1.5
      });
    }

    this.documentService.upload(file, this.selectedType).subscribe({
      next: (response) => {
        this.uploadedFiles.push(response.document);
        this.successMessage = `Archivo "${file.name}" subido correctamente!`;
        this.isUploading = false;

        // Mark this document type as uploaded (for green checkmark)
        this.uploadedTypes.add(this.selectedType);

        // Animate success checkmark if available
        if (this.successCheckmarkRef?.nativeElement) {
          this.animationService.successCheck(this.successCheckmarkRef.nativeElement);
        }

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

  /**
   * Animate new file cards sliding in from left
   */
  private animateNewFileCards() {
    const currentCount = this.fileCardRefs.length;
    if (currentCount > this.previousFileCount) {
      // Animate only the new cards
      const newCards = this.fileCardRefs.toArray().slice(this.previousFileCount);
      newCards.forEach((cardRef, index) => {
        this.animationService.slideIn(cardRef.nativeElement, 'left', {
          delay: index * 0.1,
          distance: 30
        });
      });
      this.previousFileCount = currentCount;
    }
  }

  /**
   * Animate file card deletion with fade and scale out
   */
  private animateFileCardDelete(element: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      import('gsap').then(({ gsap }) => {
        gsap.to(element, {
          opacity: 0,
          scale: 0.8,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: resolve
        });
      });
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

  async removeFile(doc: Document, index: number) {
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

    // Get the file card element for animation
    const fileCardElement = this.fileCardRefs.toArray()[index]?.nativeElement;

    this.documentService.delete(doc.id).subscribe({
      next: async () => {
        // Animate deletion before removing from array
        if (fileCardElement) {
          await this.animateFileCardDelete(fileCardElement);
        }
        this.uploadedFiles.splice(index, 1);
        this.previousFileCount = this.uploadedFiles.length;
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
