import type { StepDoc } from './types';
import { clickDoc } from './click';
import { doubleClickDoc } from './double_click';
import { rightClickDoc } from './right_click';
import { typeDoc } from './type';
import { pressKeyDoc } from './press_key';
import { hotkeyDoc } from './hotkey';
import { scrollDoc } from './scroll';
import { waitDoc } from './wait';
import { verifyDoc } from './verify';
import { launchApplicationDoc } from './launch_application';

export type { StepDoc, StepParam } from './types';

const allDocs: StepDoc[] = [
  launchApplicationDoc,
  clickDoc,
  doubleClickDoc,
  rightClickDoc,
  typeDoc,
  pressKeyDoc,
  hotkeyDoc,
  scrollDoc,
  waitDoc,
  verifyDoc,
];

export const stepDocs: Record<string, StepDoc> = Object.fromEntries(
  allDocs.map(doc => [doc.name, doc]),
);

export const stepDocList: StepDoc[] = allDocs;
