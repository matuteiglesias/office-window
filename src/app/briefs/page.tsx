import { CsvTable } from "@/components/CsvTable";
import { MarkdownDocument } from "@/components/MarkdownDocument";
import { SectionCard } from "@/components/SectionCard";
import {
  getAiJobs,
  getBriefDocs,
  getBriefIndex,
} from "@/lib/server/officeArtifacts";

const BRIEF_COLUMNS = [
  "project_id",
  "brief_type",
  "brief_path",
  "bundle_path",
  "title",
  "Title",
];

export default async function BriefsPage() {
  const [briefIndex, aiJobs, briefs] = await Promise.all([
    getBriefIndex(),
    getAiJobs(),
    getBriefDocs(8),
  ]);

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">Staff output</div>
        <h1>Briefs</h1>
        <p>
          Generated markdown briefs and indexes. Raw bundles are not rendered by
          default because they can contain private paths and context.
        </p>
      </header>

      <SectionCard title="Brief index" eyebrow="brief_index.csv">
        <CsvTable rows={briefIndex} preferredColumns={BRIEF_COLUMNS} maxRows={20} />
      </SectionCard>

      <SectionCard title="AI jobs" eyebrow="ai_jobs.csv">
        <CsvTable rows={aiJobs} preferredColumns={BRIEF_COLUMNS} maxRows={20} />
      </SectionCard>

      <section className="doc-grid">
        {briefs.map((brief) => (
          <MarkdownDocument
            key={brief.relPath}
            title={brief.name}
            content={brief.content}
          />
        ))}
      </section>
    </div>
  );
}
