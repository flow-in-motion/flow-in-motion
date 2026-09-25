/** Progress for the workspace's selected stages, in their configured order. */
export function buildPaperProgressByStage(
  orderedStages: readonly { value: string }[],
): Map<string, number> {
  return new Map(orderedStages.map((stage, index) => [
    stage.value,
    Math.round(((index + 1) / orderedStages.length) * 100),
  ]));
}
