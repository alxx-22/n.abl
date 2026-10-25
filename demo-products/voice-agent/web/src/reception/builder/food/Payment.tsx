// Paying for a phone order, for any business that sells food: on the phone
// with the demo card, on collection, or the caller's choice. The preset says
// where the choice is kept (the restaurant's money.takeaway_payment).

import type { OrderPayment } from '../../../../../src/presets/food/ordering.ts';
import { Choice } from '../fields.tsx';

export function TakeawayPayment({ legend, value, onChange }: { legend: string; value: OrderPayment; onChange: (v: OrderPayment) => void }) {
  return (
    <Choice
      legend={legend} value={value}
      options={[
        { value: 'phone', label: 'Pay on the phone', hint: 'the receptionist takes the demo card' },
        { value: 'collection', label: 'Pay on collection', hint: 'no card on the phone' },
        { value: 'either', label: 'The caller chooses' },
      ]}
      onChange={onChange}
    />
  );
}
