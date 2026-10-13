import { useUiModules } from '../../../app/ui-modules/UiModulesProvider';
import { SpecificationWorkSectionOutlet } from './SpecificationWorkSectionOutlet';
import { SpecificationAttentionOutlet } from './SpecificationAttentionOutlet';
import type { SpecificationWorkspaceData } from './model';
import { SpecificationSummarySection, PreparationSection } from './sections';

export interface WorkViewProps {
  readonly specId?: string;
  readonly data: SpecificationWorkspaceData;
}

/**
 * Specification Workspace work view composition root.
 * Coordinates section layout without monolithic state management.
 */
export function WorkView({ specId, data }: WorkViewProps) {
  const modules = useUiModules();
  return (
    <div className="@container/work min-w-0 max-w-content-standard">
      <div className="pb-3">
        <SpecificationSummarySection
          title={data.title}
          specId={specId ?? data.id}
          intro={data.intro}
          isEmpty={data.isEmpty}
          mainDocumentId={data.mainDocumentId}
        />
      </div>

      <SpecificationAttentionOutlet specId={specId ?? data.id} data={data} />

      <SpecificationWorkSectionOutlet
        slot="context"
        specId={specId ?? data.id}
        data={data}
        modules={modules}
      />

      {data.isEmpty ? (
        <div className="border-t border-border-default py-4 @min-[40rem]/work:py-5">
          <PreparationSection />
        </div>
      ) : null}

      <SpecificationWorkSectionOutlet
        slot="main"
        specId={specId ?? data.id}
        data={data}
        modules={modules}
      />

      <SpecificationWorkSectionOutlet
        slot="related"
        specId={specId ?? data.id}
        data={data}
        modules={modules}
      />
    </div>
  );
}
