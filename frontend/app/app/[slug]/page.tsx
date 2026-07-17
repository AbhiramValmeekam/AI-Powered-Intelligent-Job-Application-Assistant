import { notFound } from "next/navigation";
import {
  ProfileModule, JobsModule, AlertsModule, JdModule, TailorModule,
  CoverModule, AtsModule, SkillsModule, ScamModule, CompanyModule,
  InterviewModule, TrackerModule, VersionsModule, AnalyticsModule,
  LearningModule, AdvisorModule,
} from "@/lib/modules";

const REGISTRY: Record<string, React.ComponentType> = {
  profile: ProfileModule,
  jobs: JobsModule,
  alerts: AlertsModule,
  jd: JdModule,
  tailor: TailorModule,
  cover: CoverModule,
  ats: AtsModule,
  skills: SkillsModule,
  scam: ScamModule,
  company: CompanyModule,
  interview: InterviewModule,
  tracker: TrackerModule,
  versions: VersionsModule,
  analytics: AnalyticsModule,
  learning: LearningModule,
  advisor: AdvisorModule,
};

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const Comp = REGISTRY[slug];
  if (!Comp) notFound();
  return <Comp />;
}
