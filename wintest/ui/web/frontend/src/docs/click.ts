import type { StepDoc } from './types';

export const clickDoc: StepDoc = {
  name: 'click',
  title: 'Click',
  summary: 'Click on a UI element identified by the AI model.',
  description:
    'Takes a screenshot of the current screen, sends it to the AI vision model along with the target description, and performs a single left-click at the coordinates the model identifies. The target should be a natural language description of the element you want to click.',
  parameters: [
    {
      name: 'target',
      type: 'string',
      required: true,
      description:
        'Natural language description of the UI element to click (e.g. "File menu", "Save button", "the OK button in the dialog").',
    },
  ],
  example:
    '- type: click\n  target: "File menu"\n  description: "Open the File menu"',
};
