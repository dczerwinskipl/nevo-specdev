import { useMemo, useState } from 'react';
import { AppShell } from '@nevo/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { SpecificationSurface } from './SpecificationSurface';
import { createSpecificationWorkspaceFixture } from '../../../test-support/specs/workspace/fixtures';
import { TestServicesRouterContext } from '../../../test-support/app/TestServicesRouterContext';
import { createSpecFlowQueryClient } from '../../app/queryClient';
import { createSpecFlowAppServices } from '../../services';
import { UiModulesProvider } from '../../app/ui-modules/UiModulesProvider';
import { builtInUiModuleRegistry } from '../../app/ui-modules/builtInUiModules';
import { StoryLocalization } from '../../i18n/StoryLocalization';
import { specificationKeys } from './queries';

function StandaloneSurface({
  state = 'ready',
  custom = false,
}: {
  state?: 'ready' | 'loading' | 'error';
  custom?: boolean;
}) {
  const [backs, setBacks] = useState(0);
  const setup = useMemo(() => {
    const query = createSpecFlowQueryClient();
    query.setDefaultOptions({ queries: { retry: false, retryOnMount: false } });
    if (state === 'error')
      query
        .getQueryCache()
        .build(query, { queryKey: specificationKeys.detail('standalone') })
        .setState({ status: 'error', error: new Error('Unavailable') });
    const services = createSpecFlowAppServices({
      specificationApi: {
        getSpecificationWorkspace: () =>
          new Promise(() => {
            /* Keep the loading fixture pending without a network request. */
          }),
      },
    });
    return { query, services };
  }, [state]);
  return (
    <QueryClientProvider client={setup.query}>
      <UiModulesProvider modules={builtInUiModuleRegistry}>
        <TestServicesRouterContext services={setup.services}>
          <StoryLocalization locale="en">
            <AppShell navigation={<span>Navigation</span>}>
              <SpecificationSurface
                specId="standalone"
                data={
                  state === 'ready'
                    ? createSpecificationWorkspaceFixture('working', 'standalone')
                    : undefined
                }
                overviewHref="/?collection=archive"
                onBack={() => setBacks((value) => value + 1)}
                renderBackLink={
                  custom
                    ? (children, className) => (
                        <button
                          className={className}
                          onClick={() => setBacks((value) => value + 1)}
                        >
                          {children}
                        </button>
                      )
                    : undefined
                }
              />
              <output aria-label="Back callbacks">{backs}</output>
            </AppShell>
          </StoryLocalization>
        </TestServicesRouterContext>
      </UiModulesProvider>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'SpecFlow/Contracts/Standalone specification navigation',
  component: StandaloneSurface,
  tags: ['contract'],
} satisfies Meta<typeof StandaloneSurface>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {
  play: async ({ canvas, userEvent }) => {
    const back = canvas.getByRole('link', { name: 'Back to Specifications' });
    await expect(back).toHaveAttribute('href', '/?collection=archive');
    await userEvent.click(back);
    await expect(canvas.getByLabelText('Back callbacks')).toHaveTextContent('1');
  },
};
export const Loading: Story = { ...Ready, args: { state: 'loading' } };
export const Unavailable: Story = { ...Ready, args: { state: 'error' } };
export const CustomLink: Story = {
  args: { custom: true },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByRole('link', { name: 'Back to Specifications' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Back to Specifications' }));
    await expect(canvas.getByLabelText('Back callbacks')).toHaveTextContent('1');
  },
};

export const MobileStandalone: Story = {
  ...Ready,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: async (context) => {
    await Ready.play?.(context);
    await expect(context.canvas.queryByRole('link', { name: 'All specifications' })).toBeNull();
  },
};
