// Captures the current page as a compressed JPEG data URL, for attaching to
// an in-app feedback submission. html2canvas is loaded lazily so it never
// adds to the main bundle for people who never open the feedback dialog.
export async function captureScreenshot(): Promise<string | undefined> {
  try {
    const { default: html2canvas } = await import("html2canvas");

    const canvas = await html2canvas(document.body, {
      scale: Math.min(1, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });

    return canvas.toDataURL("image/jpeg", 0.7);
  } catch (error) {
    console.warn("Could not capture a feedback screenshot", error);
    return undefined;
  }
}
