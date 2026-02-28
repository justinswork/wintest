import type { StepDoc } from './types';

export const launchApplicationDoc: StepDoc = {
  name: 'launch_application',
  title: 'Launch Application',
  summary: 'Launch an application and manage its window.',
  description:
    'Starts an application from the given path and optionally identifies its window by title for automated focus management. Once launched, the runner will automatically bring the application window to the foreground before each subsequent step. Can be used multiple times in a test to launch different applications.',
  parameters: [
    {
      name: 'app_path',
      type: 'string',
      required: true,
      description:
        'Path to the application executable (e.g. "notepad.exe", "C:\\\\Program Files\\\\MyApp\\\\app.exe").',
    },
    {
      name: 'app_title',
      type: 'string',
      required: false,
      description:
        'Window title to match for focus management and graceful close. If omitted, the runner skips window focusing and uses process termination to close the app.',
    },
    {
      name: 'wait_seconds',
      type: 'number',
      required: false,
      description:
        'Seconds to wait after launching for the application to become ready. Defaults to the global wait_after_launch setting.',
    },
  ],
  example:
    '- type: launch_application\n  app_path: "notepad.exe"\n  app_title: "Notepad"\n  wait_seconds: 3\n  description: "Launch Notepad"',
};
