import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  Input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, finalize } from 'rxjs';
import { ConsentFormService } from '../../core/services/consent-form.service';
import { ToastService } from '../../core/services/toast.service';
import { ConsentFormPrefilledResponse } from '../../core/models';

// Consent form clause text (matches backend template)
const CONSENT_CLAUSES = [
  `1. A fin de que la empresa proceda a tramitar la Declaracion Jurada de impuestos y asi eventualmente recibir la correspondiente devolucion, el cliente la proveera en el plazo de 5 dias, a contar desde la extension del recibo de pago, de cualquier tipo de informacion que requiera la primera en relacion a la preparacion de la declaracion jurada; incluyendo aclaraciones como si ha recibido beneficios bajo el CARES Act o asistencias relacionadas con la COVID-19.-`,
  `2. El cliente informara en un plazo de 5 dias a la empresa el eventual cambio en sus datos de contacto, computables desde que se produzcan los mismos.-`,
  `3. La empresa se obliga a enviar al cliente las declaraciones juradas finales a presentar frente al IRS, en conjunto con el instructivo pertinente para ser presentada frente al organismo.-`,
  `4. El cliente no podra modificar dato alguno del documento recibido y referenciado en punto 3; siendo ello unicamente posible si la empresa lo habilita y luego verifica.-`,
  `5. El cliente no podra endilgar a la empresa tipo de responsabilidad alguna para el caso en que a causa de un cambio introducido y no autorizado por ella, provoque un resultado desfavorable en la devolucion de impuestos; asi como tampoco cuando sin mediar cambio alguno, el resultado fuere identico.-`,
  `6. El cliente asume de forma personal y exclusiva el pago de todo tipo de deuda (v.gr tributaria) que pudiere sobrevenir o manifestarse durante la tramitacion frente al IRS; sin nada que reclamar a la empresa y no siendo la misma una co-obligada al pago / fiadora.-`,
  `7. Para el eventual caso en que asi existiere la mentada deuda tributaria, la empresa realizara un calculo de deuda estimativo de acuerdo a las reglamentaciones y leyes que resulten aplicables, pero siempre siendo el IRS quien determine el monto final adeudado. De esta manera, la empresa informara fehacientemente al cliente sobre los medios de pago habilitados por el IRS para poder cancelar dicha deuda.-`,
  `8. El cliente abonara a la empresa una tarifa del 11% del monto total reembolsable consignado en la declaracion jurada siempre que el tramite nunca haya sido iniciado por cuenta propia, de la siguiente manera: DOLARES ESTADOUNIDENSES TREINTA (U$S 30.-) contra la firma del presente, y lo restante una vez recibida la devolucion, descontando lo abonado liminarmente. En los supuestos en donde el rol de la empresa fuere de verificacion, gestion o eventualmente el de destrabar un tax return ya iniciado / presentado por cuenta del cliente, el abonara a la empresa una tarifa del 22% del monto total reembolsable una vez recibida la devolucion. En ambos casos, el lugar y modalidad de pago sera el que fehacientemente comunique la empresa.`,
  `9. El segundo pago indicado anteriormente debera efectuarse sin necesidad de requerimiento alguno dentro de los 10 dias habiles de figurado como "Refund sent" / "Refund approved and sent" el reembolso de impuestos, pues queda pactada la mora automatica por el transcurso del tiempo, devengando a favor de la empresa y a partir del vencimiento del decimo dia, un interes punitorio del tres por ciento (3%) mensual acumulativo; quedando expresamente pactada la via ejecutiva para el reclamo de cualquier suma que se adeude como consecuencia del presente contrato.-`,
  `10. El cliente reconoce que el monto de dinero abonado a la empresa abarca tanto la preparacion, detalle, presentacion y seguimiento del denominado tax return; desligando completamente a ella de todo tipo de cargo y costo que incluyan los envios postales, siendo tambien de aplicacion lo dispuesto en punto 6 y concordantes.-`,
  `11. El cliente contactara a la empresa de inmediato en caso de querer cancelar su solicitud de reembolso, sin posibilidad alguna de obtener un reintegro de lo indicado en punto 8.-`,
  `12. La empresa asume la obligacion de restituir el primer pago indicado en punto 8 si el resultado del tramite fuere el de rechazado en dos oportunidades. El reintegro debera realizarse dentro de los 10 dias habiles de dicho resultado en la cuenta bancaria que indique fehacientemente el cliente.-`,
  `13. El cliente comprende que para el eventual caso en donde su solicitud fuere auditada, la empresa cobrara un monto a determinar en base a una estimacion de los costos por gastos y asistencia durante ese proceso, independientemente de si las comunicaciones se realizan mediante la empresa o con su persona. Para el pago del importe se aplica lo dispuesto en punto 8.-`,
  `14. El cliente declara conocer y comprender que frente a la eventual auditoria referenciada anteriormente, su derecho a recibir un reembolso podria frustrarse si no satisface las necesidades del IRS frente a un pedido de informacion / comprobantes; aplicandose, ademas, lo dispuesto en punto 5 y 11 en lo pertinente.-`,
  `15. El cliente declara comprender que los plazos de reembolso normales y habituales son fijados por el IRS y que los mismos resultan ser estimativos de acuerdo a tramites de igual caracteristica cuando se haya obrado con la debida diligencia necesaria; recibiendo asistencia de la empresa en casos de retraso para su contacto directo con el organismo. Asimismo, todo importe que pueda arrojarse en las paginas webs de la empresa, incluyendo el resultado de la calculadora, resulta ser estimativo, ya que los montos finales a reembolsar eventualmente, son decision del IRS.-`,
  `16. El cliente declara conocer que el tax return unicamente se realiza en cuentas bancarias estadounidenses sin excepcion, ya sea via deposito o via cheque, siempre y cuando la misma se encuentre a su nombre, ya que para el caso en que asi no lo fuere, el reintegro podria rechazarse; aplicandose lo dispuesto en punto 5 y 11 en lo pertinente.-`,
  `17. La empresa asume la obligacion de desechar todo tipo de informacion sensible sobre la persona del cliente una vez que la misma ya no se requiera para los fines indicados en el presente, asi como tambien comprometerse ella a no recibir ningun reembolso ni ejecutar pagos a nombre de terceros.-`,
  `18. La empresa acepta la obligacion de asumir a su cargo y costa el correspondiente y debido asesoramiento profesional cuando las circunstancias asi lo demanden, implicando en consecuencia que su rol a los fines contractuales no resulta el de un asesoramiento contable y/o tributario y/o legal u otra disciplina que resulte aplicable.-`,
  `19. El cliente podra prestar su consentimiento para que la empresa pueda grabarlo y/o fotografiarlo y/o grabar su voz, incluyendo citas, parrafos y sonidos, servirse de su nombre, voz, imagen y semejanza y cualquier dato biografico que podria haber suministrado, a fin de ser utilizados dentro de sus paginas web, medios de publicidad, marketing, promocion comercial o version derivada de ello como suerte de testimonio en base a su experiencia con el tramite, y entonces aceptara que no percibira contraprestacion alguna, por lo que bajo ninguna circunstancia recibira o reclamara ello a la empresa, asi como tampoco pagos residuales y/o regalias; acordando irrevocablemente que la empresa pueda usar todo ello sin limitacion y confirmando que cualquier declaracion hecha sera verdad y no violara ni infringira los derechos de cualquier persona o entidad. Dicho consentimiento se prestara via domicilio electronico constituido en los terminos aqui indicados y en cumplimiento integro a la Ley 25.326 y su decreto reglamentario.-`,
  `20. A todos los efectos legales del presente contrato, las partes se someten a la jurisdiccion y competencia de la Justicia Ordinaria del Departamento Judicial Mar del Plata, con expresa renuncia a cualquier otro fuero y/o jurisdiccion que pudiere corresponderles.-`,
];

@Component({
  selector: 'app-consent-form',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consent-form.html',
  styleUrl: './consent-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsentForm implements OnInit, OnDestroy, AfterViewInit {
  private consentFormService = inject(ConsentFormService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;
  @Output() signed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Input() isModal = false;

  // State
  isLoading = false;
  hasLoaded = false;
  isSigning = false;
  prefilledData: ConsentFormPrefilledResponse | null = null;

  // Signature canvas
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  hasSignature = false;

  // Clauses
  clauses = CONSENT_CLAUSES;

  ngOnInit() {
    this.loadPrefilledData();
  }

  ngAfterViewInit() {
    this.initCanvas();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.removeCanvasListeners();
  }

  private loadPrefilledData() {
    this.isLoading = true;
    this.consentFormService.getPrefilled().pipe(
      finalize(() => {
        this.hasLoaded = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.prefilledData = data;
      },
      error: (error) => {
        this.toastService.error(error.error?.message || 'Error al cargar datos');
      }
    });
  }

  private initCanvas() {
    if (!this.signatureCanvas?.nativeElement) return;

    const canvas = this.signatureCanvas.nativeElement;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Configure drawing style
    this.ctx.strokeStyle = '#1D345D';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Add event listeners
    this.addCanvasListeners();
  }

  private addCanvasListeners() {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;

    // Mouse events
    canvas.addEventListener('mousedown', this.startDrawing.bind(this));
    canvas.addEventListener('mousemove', this.draw.bind(this));
    canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

    // Touch events
    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    canvas.addEventListener('touchend', this.stopDrawing.bind(this));
  }

  private removeCanvasListeners() {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;

    canvas.removeEventListener('mousedown', this.startDrawing.bind(this));
    canvas.removeEventListener('mousemove', this.draw.bind(this));
    canvas.removeEventListener('mouseup', this.stopDrawing.bind(this));
    canvas.removeEventListener('mouseout', this.stopDrawing.bind(this));
    canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    canvas.removeEventListener('touchend', this.stopDrawing.bind(this));
  }

  private startDrawing(e: MouseEvent) {
    this.isDrawing = true;
    const rect = this.signatureCanvas.nativeElement.getBoundingClientRect();
    this.lastX = e.clientX - rect.left;
    this.lastY = e.clientY - rect.top;
  }

  private draw(e: MouseEvent) {
    if (!this.isDrawing || !this.ctx) return;

    const rect = this.signatureCanvas.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.lastX = x;
    this.lastY = y;
    this.hasSignature = true;
    this.cdr.detectChanges();
  }

  private stopDrawing() {
    this.isDrawing = false;
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.signatureCanvas.nativeElement.getBoundingClientRect();
    this.isDrawing = true;
    this.lastX = touch.clientX - rect.left;
    this.lastY = touch.clientY - rect.top;
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!this.isDrawing || !this.ctx) return;

    const touch = e.touches[0];
    const rect = this.signatureCanvas.nativeElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.lastX = x;
    this.lastY = y;
    this.hasSignature = true;
    this.cdr.detectChanges();
  }

  clearSignature() {
    if (!this.ctx || !this.signatureCanvas?.nativeElement) return;

    const canvas = this.signatureCanvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasSignature = false;
    this.cdr.detectChanges();
  }

  getSignatureAsBase64(): string {
    if (!this.signatureCanvas?.nativeElement) return '';
    return this.signatureCanvas.nativeElement.toDataURL('image/png');
  }

  signAgreement() {
    if (!this.hasSignature) {
      this.toastService.warning('Por favor, firma el documento antes de continuar');
      return;
    }

    if (!this.prefilledData?.canSign) {
      this.toastService.error('Por favor, completa tu perfil antes de firmar');
      return;
    }

    this.isSigning = true;
    this.cdr.detectChanges();

    const signature = this.getSignatureAsBase64();

    this.consentFormService.sign(signature).pipe(
      finalize(() => {
        this.isSigning = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.toastService.success('Acuerdo firmado exitosamente');
        this.signed.emit();

        // Open download in new tab
        if (response.downloadUrl) {
          window.open(response.downloadUrl, '_blank');
        }
      },
      error: (error) => {
        this.toastService.error(error.error?.message || 'Error al firmar el acuerdo');
      }
    });
  }

  cancel() {
    this.cancelled.emit();
  }

  get formattedDate(): string {
    if (!this.prefilledData?.date) return '';
    const { day, month, year } = this.prefilledData.date;
    return `${day} de ${month} de ${year}`;
  }
}
