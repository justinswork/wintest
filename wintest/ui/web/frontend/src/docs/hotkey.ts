import type { StepDoc } from './types';

export const hotkeyDoc: StepDoc = {
  name: 'hotkey',
  title: 'Hotkey',
  summary: 'Press a key combination.',
  description:
    'Presses multiple keys simultaneously (a keyboard shortcut). The keys are held down in order and released in reverse order. Requires at least two keys. Common modifier keys: ctrl, alt, shift, win.',
  parameters: [
    {
      name: 'keys',
      type: 'string[]',
      required: true,
      description:
        'List of keys to press together (minimum 2). Examples: ["ctrl", "c"] for copy, ["ctrl", "shift", "s"] for save-as, ["alt", "f4"] to close a window.',
    },
  ],
  example:
    '- type: hotkey\n  keys: ["ctrl", "s"]\n  description: "Save the file"',
};
