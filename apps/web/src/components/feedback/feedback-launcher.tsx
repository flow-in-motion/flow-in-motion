import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { captureScreenshot } from "@/lib/capture-screenshot";
import { FeedbackDialog } from "./feedback-dialog";

interface FeedbackLauncherProps {
  tenantId: string;
}

/**
 * A persistent, always-visible feedback entry point. Captures a screenshot
 * of the page *before* opening the dialog (so the capture never includes
 * the dialog itself), then hands it to FeedbackDialog as a starting point
 * the person can remove before sending.
 */
export function FeedbackLauncher({ tenantId }: FeedbackLauncherProps) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<
    string | undefined
  >();

  async function handleTrigger() {
    setCapturing(true);
    const screenshot = await captureScreenshot();
    setScreenshotDataUrl(screenshot);
    setCapturing(false);
    setOpen(true);
  }

  if (!tenantId) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        onClick={handleTrigger}
        disabled={capturing}
        size="icon"
        aria-label="Share feedback"
        title="Share feedback"
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </Button>

      <FeedbackDialog
        open={open}
        tenantId={tenantId}
        initialScreenshotDataUrl={screenshotDataUrl}
        onOpenChange={setOpen}
      />
    </>
  );
}
