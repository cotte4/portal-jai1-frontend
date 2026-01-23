import { Component, inject, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AnimationService } from '../../core/services/animation.service';
import { HoverScaleDirective } from '../../shared/directives';
import { gsap } from 'gsap';

@Component({
  selector: 'app-chatbot',
  imports: [CommonModule, HoverScaleDirective],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css'
})
export class Chatbot implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private animationService = inject(AnimationService);

  @ViewChild('heroIcon') heroIconRef!: ElementRef;

  isChatOpen = false;
  chatbotUrl: SafeResourceUrl;

  private floatAnimation: gsap.core.Tween | null = null;
  private modalTimeline: gsap.core.Timeline | null = null;

  constructor() {
    this.chatbotUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://app.relevanceai.com/agents/bcbe5a/8cba1df1b42f-4044-a926-18f8ee83d3c8/84379516-1725-42b5-a261-6bfcfeaa328c/embed-chat?hide_tool_steps=false&hide_file_uploads=false&hide_conversation_list=false&bubble_style=agent&primary_color=%23685FFF&bubble_icon=pd%2Fchat&input_placeholder_text=Cuomo+bongeas%3F&hide_logo=false&hide_description=false'
    );
  }

  ngOnInit() {}

  ngAfterViewInit() {
    // Animate page entrance
    this.animatePageEntrance();

    // Start float animation on hero icon (GSAP replacement for CSS @keyframes float)
    setTimeout(() => this.startFloatAnimation(), 100);
  }

  ngOnDestroy() {
    this.animationService.killAnimations();
    if (this.floatAnimation) {
      this.floatAnimation.kill();
    }
    if (this.modalTimeline) {
      this.modalTimeline.kill();
    }
  }

  private animatePageEntrance() {
    // Stagger entrance for hero section
    const hero = document.querySelector('.chatbot-hero') as HTMLElement;
    if (hero) {
      this.animationService.scaleIn(hero, { duration: 0.5 });
    }

    // Stagger entrance for feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    if (featureCards.length > 0) {
      this.animationService.staggerIn(featureCards, {
        direction: 'up',
        stagger: 0.1,
        delay: 0.2
      });
    }

    // Animate instruction bubble
    const instructionBubble = document.querySelector('.instruction-bubble') as HTMLElement;
    if (instructionBubble) {
      gsap.fromTo(instructionBubble,
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, delay: 0.5, ease: 'back.out(1.2)' }
      );

      // Pulse animation for instruction bubble (GSAP replacement for CSS @keyframes pulse)
      gsap.to(instructionBubble, {
        boxShadow: '0 8px 48px rgba(104, 95, 255, 0.6)',
        duration: 1,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
      });
    }

    // Animate bubble arrow bounce (GSAP replacement for CSS @keyframes bounce)
    const bubbleArrow = document.querySelector('.bubble-arrow') as HTMLElement;
    if (bubbleArrow) {
      gsap.to(bubbleArrow, {
        y: 8,
        duration: 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
      });
    }

    // Animate help section
    const helpSection = document.querySelector('.help-section') as HTMLElement;
    if (helpSection) {
      this.animationService.fadeIn(helpSection, { delay: 0.7 });
    }
  }

  private startFloatAnimation() {
    const heroIcon = document.querySelector('.hero-icon') as HTMLElement;
    if (heroIcon) {
      // GSAP float animation (replacement for CSS @keyframes float)
      this.floatAnimation = gsap.to(heroIcon, {
        y: -10,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
      });
    }
  }

  openChat(): void {
    this.isChatOpen = true;
    document.body.style.overflow = 'hidden';

    // Animate modal entrance
    setTimeout(() => this.animateModalOpen(), 0);
  }

  private animateModalOpen() {
    const overlay = document.querySelector('.chat-modal-overlay') as HTMLElement;
    const modal = document.querySelector('.chat-modal') as HTMLElement;

    if (overlay && modal) {
      this.modalTimeline = gsap.timeline();

      // Fade in overlay
      this.modalTimeline.fromTo(overlay,
        { opacity: 0 },
        { opacity: 1, duration: 0.2 }
      );

      // Scale + fade entrance for modal (GSAP replacement for CSS @keyframes slideUp)
      this.modalTimeline.fromTo(modal,
        { opacity: 0, scale: 0.9, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.2)' },
        '-=0.1'
      );
    }
  }

  closeChat(): void {
    const overlay = document.querySelector('.chat-modal-overlay') as HTMLElement;
    const modal = document.querySelector('.chat-modal') as HTMLElement;

    if (overlay && modal) {
      // Animate modal close
      gsap.timeline()
        .to(modal, {
          opacity: 0,
          scale: 0.95,
          y: 20,
          duration: 0.25,
          ease: 'power2.in'
        })
        .to(overlay, {
          opacity: 0,
          duration: 0.2
        }, '-=0.1')
        .call(() => {
          this.isChatOpen = false;
          document.body.style.overflow = '';
        });
    } else {
      this.isChatOpen = false;
      document.body.style.overflow = '';
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  contactSupport(): void {
    this.router.navigate(['/messages']);
  }
}
