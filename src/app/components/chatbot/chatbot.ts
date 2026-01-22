import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-chatbot',
  imports: [CommonModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css'
})
export class Chatbot implements OnInit {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  private readonly ALLOWED_CHATBOT_DOMAINS = ['app.relevanceai.com'];

  isChatOpen = false;
  chatbotUrl: SafeResourceUrl;

  constructor() {
    this.chatbotUrl = this.validateAndTrustUrl(
      'https://app.relevanceai.com/agents/bcbe5a/8cba1df1b42f-4044-a926-18f8ee83d3c8/84379516-1725-42b5-a261-6bfcfeaa328c/embed-chat?hide_tool_steps=false&hide_file_uploads=false&hide_conversation_list=false&bubble_style=agent&primary_color=%23685FFF&bubble_icon=pd%2Fchat&input_placeholder_text=Cuomo+bongeas%3F&hide_logo=false&hide_description=false'
    );
  }

  private validateAndTrustUrl(url: string): SafeResourceUrl {
    try {
      const parsedUrl = new URL(url);
      if (this.ALLOWED_CHATBOT_DOMAINS.includes(parsedUrl.hostname)) {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
      }
      console.error('Chatbot URL domain not in whitelist:', parsedUrl.hostname);
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    } catch {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
  }

  ngOnInit() {}

  openChat(): void {
    this.isChatOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeChat(): void {
    this.isChatOpen = false;
    document.body.style.overflow = '';
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  contactSupport(): void {
    this.router.navigate(['/messages']);
  }
}
