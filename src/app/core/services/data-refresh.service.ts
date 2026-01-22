import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataRefreshService {
  private refreshSubjects = new Map<string, Subject<void>>();

  triggerRefresh(route: string): void {
    const subject = this.refreshSubjects.get(route);
    if (subject) {
      subject.next();
    }
  }

  onRefresh(route: string): Observable<void> {
    if (!this.refreshSubjects.has(route)) {
      this.refreshSubjects.set(route, new Subject<void>());
    }
    return this.refreshSubjects.get(route)!.asObservable();
  }

  refreshDashboard(): void {
    this.triggerRefresh('/dashboard');
  }

  refreshAdminDashboard(): void {
    this.triggerRefresh('/admin/dashboard');
  }
}
