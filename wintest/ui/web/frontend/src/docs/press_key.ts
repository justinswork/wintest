import type { StepDoc } from './types';

export const pressKeyDoc: StepDoc = {
  name: 'press_key',
  title: 'Press Key',
  summary: 'Press a single keyboard key.',
  description:
    'Presses and releases a single keyboard key. Use this for keys like Enter, Tab, Escape, arrow keys, function keys, etc. For key combinations (e.g. Ctrl+C), use the hotkey step instead.',
  parameters: [
    {
      name: 'key',
      type: 'string',
      required: true,
      description:
        'The key to press. Examples: "enter", "tab", "escape", "backspace", "delete", "up", "down", "left", "right", "f1" through "f12", "home", "end", "pageup", "pagedown".',
    },
  ],
  example:
    '- type: press_key\n  key: "enter"\n  description: "Press Enter to confirm"',
};
