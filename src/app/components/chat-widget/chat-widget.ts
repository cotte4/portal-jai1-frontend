import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.css'
})
export class ChatWidget {
  private router = inject(Router);

  isOpen = false;
  showTooltip = true;

  constructor() {
    // Hide tooltip after 5 seconds
    setTimeout(() => {
      this.showTooltip = false;
    }, 5000);
  }

  openChat() {
    this.router.navigate(['/chatbot']);
  }

  hideTooltip() {
    this.showTooltip = false;
  }
}
