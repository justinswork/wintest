import type { StepDoc } from './types';

export const clickDoc: StepDoc = {
  name: 'click',
  title: 'Click',
  summary: 'Click at captured coordinates.',
  description:
    'Performs a click at pixel-exact coordinates (typically recorded by the Test Builder by clicking on the screenshot). Fast, deterministic, no AI required. For clicks that locate a target by natural-language description, use the click_element step.',
  parameters: [
    {
      name: 'click_x',
      type: 'number',
      required: true,
      description: 'Normalized horizontal click coordinate (0.0–1.0).',
    },
    {
      name: 'click_y',
      type: 'number',
      required: true,
      description: 'Normalized vertical click coordinate (0.0–1.0).',
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
    '- action: click\n  click_type: double_click\n  click_x: 0.35\n  click_y: 0.62\n  description: "Open the report file"',
};
