import type { DemoSpecification } from '../../demo-catalogue';
export function buildDemoDocumentManifest(record: DemoSpecification) {
  return [{ id: 'spec', title: 'Specification', kind: 'markdown', summary: record.title }];
}
