import { Component, inject, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatMessage } from '../../core/services/chatbot.service';

interface QuickAction {
  label: string;
  message: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css'
})
export class Chatbot implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  private router = inject(Router);
  private chatbotService = inject(ChatbotService);

  messages: ChatMessage[] = [];
  inputMessage: string = '';
  isTyping: boolean = false;
  showQuickActions: boolean = true;

  quickActions: QuickAction[] = [
    { label: 'Como funciona?', message: 'Como funciona el proceso de devolucion de impuestos?' },
    { label: 'Que documentos necesito?', message: 'Que documentos necesito para hacer mi declaracion de impuestos?' },
    { label: 'Cuanto tarda?', message: 'Cuanto tiempo tarda el proceso de devolucion?' }
  ];

  private shouldScrollToBottom = false;

  ngOnInit() {
    // Add welcome message from bot
    this.addBotMessage(
      'Hola! Soy el Asistente JAI1. Estoy aqui para ayudarte con tus consultas sobre devolucion de impuestos para estudiantes J-1. Como puedo ayudarte hoy?'
    );
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  sendMessage(message?: string) {
    const messageText = message || this.inputMessage.trim();

    if (!messageText || this.isTyping) {
      return;
    }

    // Hide quick actions after first message
    this.showQuickActions = false;

    // Add user message
    this.addUserMessage(messageText);
    this.inputMessage = '';

    // Show typing indicator
    this.isTyping = true;
    this.shouldScrollToBottom = true;

    // Send to chatbot service
    console.log('Sending message to chatbot service...');
    this.chatbotService.sendMessage(messageText, this.messages).subscribe({
      next: (response) => {
        console.log('Chatbot response received:', response);
        this.isTyping = false;
        this.addBotMessage(response);
      },
      error: (error) => {
        console.error('Chatbot error:', error);
        this.isTyping = false;
        this.addBotMessage(
          'Lo siento, hubo un problema al procesar tu mensaje. ' +
          (error.message || 'Por favor, intenta de nuevo.')
        );
      },
      complete: () => {
        console.log('Chatbot subscription completed');
      }
    });
  }

  onQuickAction(action: QuickAction) {
    this.sendMessage(action.message);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  goToSupport() {
    this.router.navigate(['/messages']);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private addUserMessage(content: string) {
    const message: ChatMessage = {
      id: this.chatbotService.generateMessageId(),
      content,
      sender: 'user',
      timestamp: new Date()
    };
    this.messages.push(message);
    this.shouldScrollToBottom = true;
  }

  private addBotMessage(content: string) {
    const message: ChatMessage = {
      id: this.chatbotService.generateMessageId(),
      content,
      sender: 'bot',
      timestamp: new Date()
    };
    this.messages.push(message);
    this.shouldScrollToBottom = true;
  }

  private scrollToBottom() {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      // Ignore scroll errors
    }
  }
}
