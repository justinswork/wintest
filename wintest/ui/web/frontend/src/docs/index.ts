import type { StepDoc } from './types';
import { clickDoc } from './click';
import { clickElementDoc } from './click_element';
import { typeDoc } from './type';
import { pressKeyDoc } from './press_key';
import { hotkeyDoc } from './hotkey';
import { scrollDoc } from './scroll';
import { waitDoc } from './wait';
import { verifyDoc } from './verify';
import { verifyScreenshotDoc } from './verify_screenshot';
import { compareSavedFileDoc } from './compare_saved_file';
import { launchApplicationDoc } from './launch_application';
import { setVariableDoc } from './set_variable';
import { loopDoc } from './loop';

export type { StepDoc, StepParam } from './types';

const allDocs: StepDoc[] = [
  launchApplicationDoc,
  clickDoc,
  clickElementDoc,
  typeDoc,
  pressKeyDoc,
  hotkeyDoc,
  scrollDoc,
  waitDoc,
  verifyDoc,
  verifyScreenshotDoc,
  compareSavedFileDoc,
  setVariableDoc,
  loopDoc,
];

export const stepDocs: Record<string, StepDoc> = Object.fromEntries(
  allDocs.map(doc => [doc.name, doc]),
);

export const stepDocList: StepDoc[] = allDocs;
