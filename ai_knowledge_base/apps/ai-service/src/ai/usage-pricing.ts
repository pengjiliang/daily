export interface ModelPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export function modelCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const raw = process.env.AI_MODEL_PRICING;
  if (!raw) return null;
  try {
    const prices = JSON.parse(raw) as Record<string, ModelPricing>;
    const price = prices[model];
    if (!price || !Number.isFinite(price.inputUsdPerMillion) || !Number.isFinite(price.outputUsdPerMillion)) {
      return null;
    }
    return Math.round(((inputTokens * price.inputUsdPerMillion + outputTokens * price.outputUsdPerMillion) / 1_000_000) * 1e8) / 1e8;
  } catch {
    return null;
  }
}
