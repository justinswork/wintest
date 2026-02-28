import type { StepDoc } from './types';

export const doubleClickDoc: StepDoc = {
  name: 'double_click',
  title: 'Double Click',
  summary: 'Double-click on a UI element.',
  description:
    'Works the same as click, but performs a double-click instead of a single click. Useful for opening files, selecting words in text editors, or any interaction that requires a double-click.',
  parameters: [
    {
      name: 'target',
      type: 'string',
      required: true,
      description:
        'Natural language description of the UI element to double-click (e.g. "the file icon named Report.docx").',
    },
  ],
  example:
    '- type: double_click\n  target: "the file icon named Report.docx"\n  description: "Open the report file"',
};
