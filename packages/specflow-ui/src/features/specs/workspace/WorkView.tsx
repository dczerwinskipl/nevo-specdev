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
    <div className="divide-y divide-border-subtle max-w-content-standard">
      <div className="pb-6">
        <SpecificationSummarySection
          title={data.title}
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
        <div className="py-6">
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
