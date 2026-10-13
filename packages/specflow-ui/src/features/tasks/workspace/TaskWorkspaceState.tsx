import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TaskWorkspaceData } from './taskWorkspaceModel';
import { descriptionScrollOwner } from '../../documents/description/DocumentDescription';

function useWorkspaceState(data: TaskWorkspaceData) {
  const [description, setDescription] = useState(false);
  const [instruction, setInstruction] = useState(false);
  const [allSessions, setAllSessions] = useState(false);
  const [event, setEvent] = useState<string | null>(null);
  const [decision, setDecision] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const scroll = useRef(new Map<string, number>());
  return {
    data,
    description,
    setDescription,
    instruction,
    setInstruction,
    allSessions,
    setAllSessions,
    event,
    setEvent,
    decision,
    setDecision,
    feedback,
    setFeedback,
    error,
    setError,
    message,
    setMessage,
    reading,
    setReading,
    scroll,
  };
}
const Context = createContext<ReturnType<typeof useWorkspaceState> | null>(null);
export function TaskWorkspaceState({
  data,
  children,
}: {
  readonly data: TaskWorkspaceData;
  readonly children: ReactNode;
}) {
  const value = useWorkspaceState(data);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTaskWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('Task workspace state is required');
  return value;
}
/** Page-local scroll survives the host remounting a previous Secondary entry. */
export function useWorkspaceScroll(key: string) {
  const { scroll } = useTaskWorkspace();
  const ref = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const captureBeforeNavigation = () => {
    if (ref.current) scroll.current.set(key, descriptionScrollOwner(ref.current).scrollTop);
    leaving.current = true;
  };
  useLayoutEffect(() => {
    if (!ref.current) return;
    let restored = false;
    const frame = requestAnimationFrame(() => {
      if (!ref.current) return;
      // Resolve after the host has laid out the new page. A short page can acquire
      // a scroll owner when its preserved disclosures are restored.
      const owner = descriptionScrollOwner(ref.current);
      owner.scrollTop = scroll.current.get(key) ?? 0;
      restored = true;
    });
    const save = (event: Event) => {
      if (!restored || leaving.current || !ref.current) return;
      const owner = descriptionScrollOwner(ref.current);
      if (event.target === owner) scroll.current.set(key, owner.scrollTop);
    };
    // The narrow host shares a viewport across pages; the wide host has one per
    // surface. Capture observes either without depending on host DOM classes.
    document.addEventListener('scroll', save, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', save, true);
    };
  }, [key, scroll]);
  return { ref, captureBeforeNavigation };
}
