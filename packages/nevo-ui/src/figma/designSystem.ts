import {
  createComponentAuthoring,
  defineDesignSystem,
  defineFigmaExportProfile,
} from '@nevo/figma-core/authoring';
import { designSpecs as appDesignSpecs } from '../app/shell/AppShell.figma';
import { designSpec as standaloneShellDesignSpec } from '../app/shell/StandaloneShell.figma';
import { designSpecs as environmentDesignSpecs } from '../components/foundations/Environment/Environment.figma';
import { designSpec as buttonDesignSpec } from '../components/actions/Button/Button.figma';
import { designSpec as iconButtonDesignSpec } from '../components/actions/IconButton/IconButton.figma';
import { designSpec as linkDesignSpec } from '../components/actions/Link/Link.figma';
import { designSpec as timelineDesignSpec } from '../components/content/Timeline/Timeline.figma';
import { designSpec as dataTableDesignSpec } from '../components/data/DataTable/DataTable.figma';
import { designSpec as alertDesignSpec } from '../components/feedback/Alert/Alert.figma';
import { designSpec as badgeDesignSpec } from '../components/feedback/Badge/Badge.figma';
import { designSpec as emptyStateDesignSpec } from '../components/feedback/EmptyState/EmptyState.figma';
import { designSpec as skeletonDesignSpec } from '../components/feedback/Skeleton/Skeleton.figma';
import { designSpec as spinnerDesignSpec } from '../components/feedback/Spinner/Spinner.figma';
import { designSpec as toastDesignSpec } from '../components/feedback/Toast/Toast.figma';
import { designSpec as fieldDesignSpec } from '../components/forms/Field/Field.figma';
import { designSpec as checkboxDesignSpec } from '../components/forms/Checkbox/Checkbox.figma';
import { designSpec as inputGroupDesignSpec } from '../components/forms/InputGroup/InputGroup.figma';
import { designSpec as radioGroupDesignSpec } from '../components/forms/RadioGroup/RadioGroup.figma';
import { designSpecs as segmentedControlDesignSpecs } from '../components/forms/SegmentedControl/SegmentedControl.figma';
import { designSpecs as selectDesignSpecs } from '../components/forms/Select/Select.figma';
import { designSpec as textAreaDesignSpec } from '../components/forms/TextArea/TextArea.figma';
import { designSpec as textInputDesignSpec } from '../components/forms/TextInput/TextInput.figma';
import { designSpec as switchDesignSpec } from '../components/forms/Switch/Switch.figma';
import { designSpec as passwordInputDesignSpec } from '../components/forms/PasswordInput/PasswordInput.figma';
import { designSpec as numberInputDesignSpec } from '../components/forms/NumberInput/NumberInput.figma';
import { designSpec as datePickerDesignSpec } from '../components/forms/DateTime/DatePicker/DatePicker.figma';
import { designSpec as timePickerDesignSpec } from '../components/forms/DateTime/TimePicker/TimePicker.figma';
import { designSpec as dateRangePickerDesignSpec } from '../components/forms/DateTime/DateRangePicker/DateRangePicker.figma';
import { designSpec as dateTimePickerDesignSpec } from '../components/forms/DateTime/DateTimePicker/DateTimePicker.figma';
import { designSpec as dateTimePickersOverviewDesignSpec } from '../components/forms/DateTime/DateTimePickersOverview.figma';
import { designSpec as separatorDesignSpec } from '../components/layout/Separator/Separator.figma';
import { designSpec as breadcrumbsDesignSpec } from '../components/navigation/Breadcrumbs/Breadcrumbs.figma';
import { designSpec as paginationDesignSpec } from '../components/navigation/Pagination/Pagination.figma';
import { designSpec as sideNavigationDesignSpec } from '../components/navigation/SideNavigation/SideNavigation.figma';
import { designSpecs as tabsDesignSpecs } from '../components/navigation/Tabs/Tabs.figma';
import { designSpec as alertDialogDesignSpec } from '../components/overlays/AlertDialog/AlertDialog.figma';
import { designSpec as dialogDesignSpec } from '../components/overlays/Dialog/Dialog.figma';
import { designSpec as drawerDesignSpec } from '../components/overlays/Drawer/Drawer.figma';
import { designSpecs as menuDesignSpecs } from '../components/overlays/Menu/Menu.figma';
import { designSpec as popoverDesignSpec } from '../components/overlays/Popover/Popover.figma';
import { designSpec as tooltipDesignSpec } from '../components/overlays/Tooltip/Tooltip.figma';
import { designSpec as messageComposerDesignSpec } from '../components/patterns/MessageComposer/MessageComposer.figma';
import { designSpec as cardDesignSpec } from '../components/surfaces/Card/Card.figma';
import { designSpec as surfaceDesignSpec } from '../components/surfaces/Surface/Surface.figma';

import { designSpec as statusIndicatorDesignSpec } from '../components/feedback/StatusIndicator/StatusIndicator.figma';
import { designSpec as progressDesignSpec } from '../components/feedback/Progress/Progress.figma';
import { designSpec as collapsibleDesignSpec } from '../components/content/Collapsible/Collapsible.figma';
import { designSpec as informationListDesignSpec } from '../components/content/InformationList/InformationList.figma';
// Deliberately explicit: this is the single deterministic registration point for
// design authoring modules. Runtime component barrels never export *.figma files.
export const nevoUiDesignSystem = defineDesignSystem([
  ...environmentDesignSpecs,
  buttonDesignSpec,
  iconButtonDesignSpec,
  linkDesignSpec,
  separatorDesignSpec,
  textInputDesignSpec,
  textAreaDesignSpec,
  inputGroupDesignSpec,
  fieldDesignSpec,
  checkboxDesignSpec,
  radioGroupDesignSpec,
  switchDesignSpec,
  numberInputDesignSpec,
  passwordInputDesignSpec,
  datePickerDesignSpec,
  timePickerDesignSpec,
  dateRangePickerDesignSpec,
  dateTimePickerDesignSpec,
  dateTimePickersOverviewDesignSpec,
  ...tabsDesignSpecs,
  ...segmentedControlDesignSpecs,
  surfaceDesignSpec,
  cardDesignSpec,
  messageComposerDesignSpec,
  dataTableDesignSpec,
  timelineDesignSpec,
  alertDesignSpec,
  badgeDesignSpec,
  emptyStateDesignSpec,
  skeletonDesignSpec,
  spinnerDesignSpec,
  toastDesignSpec,
  sideNavigationDesignSpec,
  breadcrumbsDesignSpec,
  paginationDesignSpec,
  drawerDesignSpec,
  dialogDesignSpec,
  alertDialogDesignSpec,
  tooltipDesignSpec,
  popoverDesignSpec,
  ...menuDesignSpecs,
  ...selectDesignSpecs,
  statusIndicatorDesignSpec,
  progressDesignSpec,
  collapsibleDesignSpec,
  informationListDesignSpec,
  ...appDesignSpecs,
  standaloneShellDesignSpec,
] as const);

export const { componentRef, slot, variantProperty } = createComponentAuthoring(nevoUiDesignSystem);

export const nevoUiFigmaExportProfile = defineFigmaExportProfile(nevoUiDesignSystem, {
  id: 'nevo-ui',
  owner: '@nevo/ui',
  displayName: 'Nevo UI design system',
  roots: nevoUiDesignSystem.map((definition) => definition.component),
  resources: 'owned',
});
