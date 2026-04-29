import type { StepDoc } from './types';

export const clickElementDoc: StepDoc = {
  name: 'click_element',
  title: 'Click Element',
  summary: 'Locate a UI element by natural-language description and click it.',
  description:
    'Uses the AI vision model to find the target element on the current screen, then clicks it. Useful when a UI layout may shift between runs. Slower and less deterministic than coordinate-based clicking; prefer the regular click step when the layout is stable. Requires the [ai] extras (torch, transformers).',
  parameters: [
    {
      name: 'target',
      type: 'string',
      required: true,
      description:
        'Natural language description of the UI element to click. Example: "Save button", "File menu".',
    },
    {
      name: 'click_type',
      type: 'string',
      required: false,
      description:
        'One of "click" (left, default), "double_click", "right_click", or "middle_click".',
    },
  ],
  example:
    '- action: click_element\n  target: "Save button"\n  description: "Save the file"',
};
