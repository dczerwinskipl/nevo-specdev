import { Home, MessagesSquare, ListChecks, Files, GitCompare, FolderGit2 } from 'lucide-react';

const specificationViews = [
  { id: 'overview', to: '/specs/$specId', labelKey: 'specification.viewOverview', icon: Home },
  {
    id: 'sessions',
    to: '/specs/$specId/sessions',
    labelKey: 'specification.viewSessions',
    icon: MessagesSquare,
  },
  { id: 'tasks', to: null, labelKey: 'specification.viewTasks', icon: ListChecks },
  {
    id: 'documents',
    to: '/specs/$specId/documents',
    labelKey: 'specification.viewDocuments',
    icon: Files,
  },
  {
    id: 'changes',
    to: '/specs/$specId/changes',
    labelKey: 'specification.changesHeading',
    icon: GitCompare,
    requiresGit: true,
  },
  {
    id: 'repository',
    to: '/specs/$specId/repository',
    labelKey: 'specification.viewRepository',
    icon: FolderGit2,
    requiresGit: true,
  },
] as const;

export function productNavigationItems(specId: string | null, pathname: string, hasGit?: boolean) {
  return specificationViews
    .filter((view) => !('requiresGit' in view && hasGit === false))
    .map((view) => {
      const path = specId && view.to?.replace('$specId', encodeURIComponent(specId));
      return {
        ...view,
        active: Boolean(
          path &&
          (pathname === path || (view.id !== 'overview' && pathname.startsWith(`${path}/`))),
        ),
      };
    });
}
