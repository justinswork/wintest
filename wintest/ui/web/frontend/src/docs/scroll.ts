import type { StepDoc } from './types';

export const scrollDoc: StepDoc = {
  name: 'scroll',
  title: 'Scroll',
  summary: 'Scroll the mouse wheel.',
  description:
    'Scrolls the mouse wheel at the current cursor position. Positive values scroll up, negative values scroll down. The magnitude determines how far to scroll (each unit is roughly one "click" of the scroll wheel).',
  parameters: [
    {
      name: 'scroll_amount',
      type: 'number',
      required: true,
      description:
        'How far to scroll. Positive values scroll up, negative values scroll down (e.g. 3 for three clicks up, -5 for five clicks down).',
    },
  ],
  example:
    '- type: scroll\n  scroll_amount: -3\n  description: "Scroll down three clicks"',
};
