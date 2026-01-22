import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'emptyValue',
  standalone: true
})
export class EmptyValuePipe implements PipeTransform {
  transform(value: any, placeholder: string = '---'): string {
    if (value === null || value === undefined || value === '') {
      return placeholder;
    }
    return String(value);
  }
}
