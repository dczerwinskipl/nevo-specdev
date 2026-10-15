import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useAppServices } from '../useAppServices';
import { specsOverviewQueryOptions } from '../../features/specs/overview/queries';
import { getHttpErrorStatus } from '../../features/specs/httpErrorStatus';
import type { SpecsCollection } from '../../features/specs/overview/model';
import { useNavigationTransition } from './NavigationTransition';
import { pickerEntries } from './pickerEntries';
export interface SpecificationSwitcherIdentity {
  specId: string;
  title: string;
  displayKey?: string;
  collection: SpecsCollection;
  identityAvailable: boolean;
}
export function useSpecificationSwitcher({
  specId,
  title,
  displayKey,
  collection,
  identityAvailable,
}: SpecificationSwitcherIdentity) {
  const committed = useRef(false);
  const router = useRouter();
  const { specsOverviewApi } = useAppServices();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const routePending = useRouterState({ select: (state) => state.status === 'pending' });
  const { guardPending } = useNavigationTransition();
  const pending = routePending || guardPending;
  const [failure, setFailure] = useState(false);
  const query = useQuery({
    ...specsOverviewQueryOptions(specsOverviewApi, collection),
    enabled: open,
  });
  const denied = [401, 403, 404].includes(getHttpErrorStatus(query.error) ?? 0);
  const entries = pickerEntries(
    denied ? [] : (query.data?.items ?? []),
    identityAvailable ? { id: specId, title, key: displayKey } : undefined,
    term,
  );
  const choose = async (id: string) => {
    if (pending) return;
    if (id === specId) {
      setOpen(false);
      return;
    }
    setFailure(false);
    try {
      await router.navigate({
        to: '/specs/$specId',
        params: { specId: id },
        search: { collection },
      });
      if (router.state.location.pathname === `/specs/${encodeURIComponent(id)}`) {
        committed.current = true;
        setOpen(false);
      }
    } catch {
      setFailure(true);
    }
  };
  return {
    open,
    term,
    setTerm,
    pending,
    failure,
    query,
    entries,
    choose,
    committed,
    onOpenChange: (value: boolean) => {
      if (value) {
        setFailure(false);
        committed.current = false;
        setTerm('');
      }
      setOpen(value);
    },
  };
}
