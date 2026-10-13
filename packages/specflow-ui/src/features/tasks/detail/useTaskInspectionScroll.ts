import { useLayoutEffect, useRef } from 'react';
import { descriptionScrollOwner } from '../../documents/description/DocumentDescription';
import { useTaskViewState } from './TaskViewState';

/** Remember a keyed inspection across a nested evidence push, after workspace focus restores. */
export function useTaskInspectionScroll(taskId: string, key: string) {
  const root = useRef<HTMLDivElement>(null);
  const { state, saveInspectionScroll } = useTaskViewState(taskId);
  const initial = useRef(state.inspectionScroll?.[key] ?? 0);
  const prepared = useRef(false);
  useLayoutEffect(() => {
    if (!root.current) return;
    const owner = descriptionScrollOwner(root.current);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        owner.scrollTop = initial.current;
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      if (!prepared.current) saveInspectionScroll(key, owner.scrollTop);
    };
  }, [key, saveInspectionScroll]);
  return {
    root,
    remember: () => {
      if (root.current) {
        prepared.current = true;
        saveInspectionScroll(key, descriptionScrollOwner(root.current).scrollTop);
      }
    },
  };
}
