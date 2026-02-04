import { Pipe, PipeTransform } from '@angular/core';
import { formatUSDAmount } from '../../core/utils/currency-format';

@Pipe({
  name: 'usdAmount',
  standalone: true
})
export class UsdAmountPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '0.00';
    }
    return formatUSDAmount(value);
  }
}
