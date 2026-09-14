import { Clock3 } from "lucide-react";
import { useParams } from "react-router-dom";

import { Heading } from "@/components/typography/heading";

const featureNames: Record<string, string> = {
  calendar: "Calendar",
  collaborators: "Collaborators",
  conferences: "Conferences",
  "cv-builder": "CV Builder",
  dissemination: "Dissemination",
  documents: "Documents",
  funding: "Funding",
  "hdr-students": "HDR students",
  "journal-rankings-research-lists": "Journal rankings & research lists",
  "log-real-time-activity": "Log real time activity",
  "reviews-hdr-examinations": "Reviews, HDR examinations",
  teaching: "Teaching",
};

interface FutureFeaturePageProps {
  feature?: string;
}

export default function FutureFeaturePage({ feature: featureOverride }: FutureFeaturePageProps) {
  const { feature = "" } = useParams();
  const featureName = featureNames[featureOverride ?? feature] ?? "This feature";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <section className="w-full max-w-xl rounded-xl border bg-card px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          <Clock3 className="h-6 w-6" />
        </div>
        <Heading level="h2" className="mt-5">
          {featureName}
        </Heading>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          This feature will be available in a future version of Research in Motion.
        </p>
      </section>
    </div>
  );
}
