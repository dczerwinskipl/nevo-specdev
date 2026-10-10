import { isValidElement, type ReactElement, type ReactNode } from 'react';

import { Button } from '../../components/actions/Button';
import { IconButton } from '../../components/actions/IconButton';
import { Icon, type IconGlyph } from '../../components/foundations/Icon';
import { Typography } from '../../components/foundations/Typography';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  OverflowMenu,
} from '../../components/overlays/Menu';
import { cn } from '../../lib';

export type WorkspaceHeaderActionTone = 'neutral' | 'danger';

export interface WorkspaceHeaderAction {
  id: string;
  label: string;
  icon?: IconGlyph;
  primary?: boolean;
  disabled?: boolean;
  tone?: WorkspaceHeaderActionTone;
  onPress: () => void;
}

export interface WorkspaceHeaderProps {
  actions?: readonly WorkspaceHeaderAction[];
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span';
  className?: string;
  icon?: IconGlyph;
  labels?: Partial<WorkspaceHeaderLabels>;
  status?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
  /** Primary defaults to h1; contextual Secondary headers use h2. */
  headingLevel?: 1 | 2;
}

export interface WorkspaceHeaderLabels {
  moreActions: string;
  menuScope?: string;
}

const defaultWorkspaceHeaderLabels: WorkspaceHeaderLabels = {
  moreActions: 'More actions',
};

export interface ResolvedWorkspaceHeaderActions {
  directPrimary?: WorkspaceHeaderAction;
  overflow: readonly WorkspaceHeaderAction[];
}

export function resolveWorkspaceHeaderActions(
  actions: readonly WorkspaceHeaderAction[] = [],
  compact = false,
): ResolvedWorkspaceHeaderActions {
  if (compact) return { overflow: actions };

  const primaryIndex = actions.findIndex((action) => action.primary && action.tone !== 'danger');
  if (primaryIndex < 0) return { overflow: actions };

  return {
    directPrimary: actions[primaryIndex],
    overflow: actions.filter((_, index) => index !== primaryIndex),
  };
}

function WorkspaceActionMenu({
  actions,
  className,
  label,
  navigationAction,
  scope,
}: {
  actions: readonly WorkspaceHeaderAction[];
  className?: string;
  label: string;
  navigationAction?: WorkspaceHeaderAction;
  scope?: string;
}) {
  if (actions.length === 0 && !navigationAction) return null;

  const items = (
    <>
      {actions.map((action) => (
        <MenuItem
          disabled={action.disabled}
          key={action.id}
          leadingIcon={action.icon}
          onSelect={action.onPress}
          tone={action.tone ?? 'neutral'}
        >
          {action.label}
        </MenuItem>
      ))}
      {navigationAction ? (
        <>
          {actions.length > 0 ? <MenuSeparator /> : null}
          <MenuItem leadingIcon={navigationAction.icon} onSelect={navigationAction.onPress}>
            {navigationAction.label}
          </MenuItem>
        </>
      ) : null}
    </>
  );

  if (scope) {
    return (
      <OverflowMenu className={className} label={scope} size="sm" triggerLabel={label}>
        {items}
      </OverflowMenu>
    );
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton
          aria-label={label}
          className={className}
          icon="ellipsis"
          size="sm"
          variant="ghost"
        />
      </MenuTrigger>
      <MenuContent align="end" sideOffset={4} aria-label={label} className="w-auto">
        {items}
      </MenuContent>
    </Menu>
  );
}

function DirectPrimaryAction({ action }: { action: WorkspaceHeaderAction }) {
  if (!action.icon) {
    return (
      <Button disabled={action.disabled} onClick={action.onPress} size="sm">
        {action.label}
      </Button>
    );
  }

  return (
    <Button
      aria-label={action.label}
      className="@max-sm:size-control-height-compact @max-sm:px-0 @max-sm:[&_[data-design-slot=label]]:sr-only"
      disabled={action.disabled}
      leadingIcon={action.icon}
      onClick={action.onPress}
      size="sm"
    >
      {action.label}
    </Button>
  );
}

export interface WorkspaceHeaderIdentityProps extends Pick<
  WorkspaceHeaderProps,
  'as' | 'icon' | 'status' | 'subtitle' | 'title' | 'headingLevel'
> {}

/** Product-owned heading content; the workspace owns its surrounding action chrome. */
export function WorkspaceHeaderIdentity({
  as,
  icon,
  status,
  subtitle,
  title,
  headingLevel = 1,
}: WorkspaceHeaderIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {icon ? <Icon className="shrink-0 text-action-primary" name={icon} size="md" /> : null}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Typography
            as={as ?? (headingLevel === 2 ? 'h2' : 'h1')}
            className="min-w-0 truncate outline-none"
            data-workspace-header-title="true"
            tabIndex={-1}
            variant="title-sm"
          >
            {title}
          </Typography>
          {status ? <div className="shrink-0">{status}</div> : null}
        </div>
        {subtitle ? (
          <Typography as="div" className="truncate text-content-muted" variant="body-sm">
            {subtitle}
          </Typography>
        ) : null}
      </div>
    </div>
  );
}

/** One owner of action placement for desktop headers, including custom Secondary content. */
export function WorkspaceHeaderFrame({
  content,
  actions = [],
  labels: labelsProp,
  className,
}: {
  content: ReactNode;
  actions?: readonly WorkspaceHeaderAction[];
  labels?: Partial<WorkspaceHeaderLabels>;
  className?: string;
}) {
  const resolved = resolveWorkspaceHeaderActions(actions);
  const labels = { ...defaultWorkspaceHeaderLabels, ...labelsProp };

  return (
    <div
      className={cn('flex w-full min-w-0 items-center justify-between gap-3', className)}
      data-workspace-header="true"
    >
      <div className="min-w-0 flex-1">{content}</div>
      {resolved.directPrimary || resolved.overflow.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {resolved.directPrimary ? <DirectPrimaryAction action={resolved.directPrimary} /> : null}
          <WorkspaceActionMenu
            actions={resolved.overflow}
            label={labels.moreActions}
            scope={labels.menuScope}
          />
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceHeader({
  actions = [],
  as,
  className,
  icon,
  labels,
  status,
  subtitle,
  title,
  headingLevel = 1,
}: WorkspaceHeaderProps) {
  return (
    <WorkspaceHeaderFrame
      actions={actions}
      className={className}
      labels={labels}
      content={
        <WorkspaceHeaderIdentity
          as={as}
          headingLevel={headingLevel}
          icon={icon}
          status={status}
          subtitle={subtitle}
          title={title}
        />
      }
    />
  );
}

export function isWorkspaceHeaderElement(
  node: ReactNode,
): node is ReactElement<WorkspaceHeaderProps, typeof WorkspaceHeader> {
  return isValidElement(node) && node.type === WorkspaceHeader;
}

export function getWorkspaceHeaderActions(node: ReactNode): readonly WorkspaceHeaderAction[] {
  return isWorkspaceHeaderElement(node) ? (node.props.actions ?? []) : [];
}

export function getWorkspaceHeaderLabels(node: ReactNode): WorkspaceHeaderLabels {
  return {
    ...defaultWorkspaceHeaderLabels,
    ...(isWorkspaceHeaderElement(node) ? node.props.labels : undefined),
  };
}

export function CompactWorkspaceActions({
  className,
  header,
  actions,
  labels: actionLabels,
  navigationAction,
}: {
  className?: string;
  header?: ReactNode;
  actions?: readonly WorkspaceHeaderAction[];
  labels?: Partial<WorkspaceHeaderLabels>;
  navigationAction?: WorkspaceHeaderAction;
}) {
  const labels = actionLabels
    ? { ...defaultWorkspaceHeaderLabels, ...actionLabels }
    : getWorkspaceHeaderLabels(header);
  return (
    <WorkspaceActionMenu
      actions={
        resolveWorkspaceHeaderActions(actions ?? getWorkspaceHeaderActions(header), true).overflow
      }
      className={className}
      label={labels.moreActions}
      navigationAction={navigationAction}
      scope={labels.menuScope}
    />
  );
}
