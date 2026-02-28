import type { StepDoc } from './types';

export const rightClickDoc: StepDoc = {
  name: 'right_click',
  title: 'Right Click',
  summary: 'Right-click on a UI element.',
  description:
    'Performs a right-click (context menu click) on the identified UI element. Typically used to open context menus for additional options.',
  parameters: [
    {
      name: 'target',
      type: 'string',
      required: true,
      description:
        'Natural language description of the UI element to right-click (e.g. "the desktop background", "the selected text").',
    },
  ],
  example:
    '- type: right_click\n  target: "the selected text"\n  description: "Open context menu on selection"',
};
