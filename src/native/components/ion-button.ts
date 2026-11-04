import { horizontalSelected, horizontalToolbarGroup, inVerticalToolbarLayout } from '../shared/toolbar-options.js';
import type { VerticalControlAreaOptions } from '../definitions.js';
import { createCandidate, appendItem } from '../shared/candidate.js';
import type { Candidate, Identify } from '../shared/candidate.js';
import { inFixedToolbar, isVerticalBarsToolbarAction, isVerticalBarsToolbarGroup } from '../shared/dom.js';

export const tag = 'ion-button';

export const read = (element: HTMLElement, id: Identify, options: VerticalControlAreaOptions = {}): Candidate | undefined => {
  const button = element as HTMLIonButtonElement;
  const verticalBars = inVerticalToolbarLayout(element);
  if (verticalBars && element.parentElement && isVerticalBarsToolbarGroup(element.parentElement)) return;
  const fill = button.fill ?? 'default';
  const group = element.parentElement?.matches('ion-buttons') ? element.parentElement : undefined;
  const submit = element.getAttribute('data-native-ui') === 'button-submit';
  if (!verticalBars && !submit && (!horizontalSelected(element, options) || (group && horizontalToolbarGroup(group, options)))) return;
  if (
    !inFixedToolbar(element) ||
    (verticalBars && !isVerticalBarsToolbarAction(element)) ||
    (!verticalBars && !submit && fill !== 'default' && !(group && fill === 'clear')) ||
    (!verticalBars && !submit && button.classList.contains('ion-color'))
  )
    return;
  const candidate = createCandidate(element, tag, id, options);
  const item = appendItem(candidate, element, id);
  if (!item) return;
  if (submit) item.buttonStyle = 'prominent';
  if (!verticalBars && !submit && (fill === 'clear' || (group && button.fill === undefined))) item.buttonFill = 'clear';
  return candidate;
};
