import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('tax-client-portal');
  protected showSplash = signal(true);
  protected splashFading = signal(false);

  ngOnInit(): void {
    // Start fade out after 2 seconds
    setTimeout(() => {
      this.splashFading.set(true);
      // Remove splash completely after fade animation (0.6s)
      setTimeout(() => {
        this.showSplash.set(false);
      }, 600);
    }, 2000);
  }
}
