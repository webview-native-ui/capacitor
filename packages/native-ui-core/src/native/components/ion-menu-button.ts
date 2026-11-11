import { horizontalSelected, horizontalToolbarGroup, inVerticalToolbarLayout } from '../shared/toolbar-options.js';
import { createCandidate, appendItem } from '../shared/candidate.js';
import type { Candidate, Identify } from '../shared/candidate.js';
import type { VerticalControlAreaOptions } from '../definitions.js';
import { inFixedToolbar, isVerticalBarsToolbarAction, isVerticalBarsToolbarGroup } from '../shared/dom.js';

export const tag = 'ion-menu-button';
// Menu actions share toolbar placement with ordinary buttons.
export const selector = tag;
export const shadowSelector = tag;

export const append = (candidate: Candidate, button: HTMLIonMenuButtonElement, id: Identify): boolean => {
  if (button.type !== 'button') return false;
  const content = !button.shadowRoot?.querySelector('slot')?.assignedNodes().length ? button.shadowRoot : button;
  return !!content && !!appendItem(candidate, button, id, content);
};

export const read = (group: HTMLElement, id: Identify, options: VerticalControlAreaOptions = {}): Candidate | undefined => {
  if (!inFixedToolbar(group)) return;
  if (inVerticalToolbarLayout(group)) {
    if (!isVerticalBarsToolbarAction(group)) return;
    if (group.parentElement && isVerticalBarsToolbarGroup(group.parentElement)) return;
  } else {
    if (!horizontalSelected(group, options)) return;
    if (group.parentElement && horizontalToolbarGroup(group.parentElement, options)) return;
  }
  const candidate = createCandidate(group, tag, id, options);
  if (!append(candidate, group as HTMLIonMenuButtonElement, id)) return;
  if (!inVerticalToolbarLayout(group)) candidate.control.items[0].buttonFill = 'clear';
  return candidate;
};
