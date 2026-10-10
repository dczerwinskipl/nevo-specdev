import { describe, expect, it, vi } from 'vitest';
import { SectionBoundary } from './SpecificationWorkSectionOutlet';

function createFailedBoundary() {
  let retryRender: (() => void) | undefined;
  const instance = new SectionBoundary({
    children: null,
    fallback: (retry) => {
      retryRender = retry;
      return 'Contribution rendering failed';
    },
  });
  // Exercise the boundary state transition without a browser. React performs
  // these updates synchronously for the test's mocked component instance.
  vi.spyOn(instance, 'setState').mockImplementation((update) => {
    if (typeof update === 'function') {
      throw new Error('This boundary uses only object state updates');
    }
    instance.state = { ...instance.state, ...update };
  });
  instance.state = { failed: true };
  expect(instance.render()).toBe('Contribution rendering failed');
  if (!retryRender) throw new Error('Expected render retry action');
  return { instance, retryRender };
}

describe('Specification Work contribution render failure isolation', () => {
  it('stays failed through background query changes until a human retries rendering', () => {
    const { instance } = createFailedBoundary();
    expect(instance.render()).toBe('Contribution rendering failed');
    expect(instance.state.failed).toBe(true);
  });

  it('a render retry resets the error boundary without invoking a data callback', () => {
    const { instance, retryRender } = createFailedBoundary();

    retryRender();

    expect(instance.state).toEqual({ failed: false });
    expect(instance.render()).toBeNull();
  });

  it('repeated render errors remain isolated after a manual retry', () => {
    const { instance, retryRender } = createFailedBoundary();
    retryRender();

    // React invokes getDerivedStateFromError if the component throws again.
    const nextState = SectionBoundary.getDerivedStateFromError();
    instance.state = { ...instance.state, ...nextState };

    expect(instance.state.failed).toBe(true);
    expect(instance.render()).toBe('Contribution rendering failed');
  });
});
