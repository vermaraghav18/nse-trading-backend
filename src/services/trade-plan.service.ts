import {
  ResistanceAnalysis,
  StockChartData,
  SupportAnalysis,
  TradePlan,
  TradePlanAction,
  TradePlanTone,
  ZoneOscillationSignal,
} from "../types/chart.types";

function getPrimarySupport(data: {
  support?: SupportAnalysis;
  supportClusters?: SupportAnalysis[];
}): SupportAnalysis | null {
  return data.supportClusters?.[0] ?? data.support ?? null;
}

function getPrimaryResistance(data: {
  resistance?: ResistanceAnalysis;
  resistanceClusters?: ResistanceAnalysis[];
}): ResistanceAnalysis | null {
  return data.resistanceClusters?.[0] ?? data.resistance ?? null;
}

function buildPlan(params: {
  action: TradePlanAction;
  actionTone: TradePlanTone;
  headline: string;
  notes: string[];
  upsideRoom: string;
  downsideCushion: string;
}): TradePlan {
  return {
    action: params.action,
    actionTone: params.actionTone,
    headline: params.headline,
    notes: params.notes,
    upsideRoom: params.upsideRoom,
    downsideCushion: params.downsideCushion,
  };
}

export function buildTradePlan(data: {
  intelligence: StockChartData["intelligence"];
  support: SupportAnalysis;
  supportClusters: SupportAnalysis[];
  resistance: ResistanceAnalysis;
  resistanceClusters: ResistanceAnalysis[];
  oscillationSignal: ZoneOscillationSignal;
}): TradePlan {
  const support = getPrimarySupport({
    support: data.support,
    supportClusters: data.supportClusters,
  });

  const resistance = getPrimaryResistance({
    resistance: data.resistance,
    resistanceClusters: data.resistanceClusters,
  });

  const supportDistance = support?.distancePercent ?? null;
  const resistanceDistance = resistance?.distancePercent ?? null;

  // relaxed from 1.5% to 3%
  const supportNear =
    Boolean(support?.inZone) ||
    (supportDistance !== null && supportDistance <= 3);

  const resistanceNear =
    Boolean(resistance?.inZone) ||
    (resistanceDistance !== null && resistanceDistance <= 3);

  const bullishSetup =
    data.intelligence.bias === "BULLISH" &&
    data.intelligence.confirmationStatus === "CONFIRMED";

  const bearishSetup =
    data.intelligence.bias === "BEARISH" &&
    data.intelligence.confirmationStatus === "CONFIRMED";

  const weakVolume = data.intelligence.volumeConfirmation === "LOW";
  const highVolume = data.intelligence.volumeConfirmation === "HIGH";

  const breakoutLikely = data.oscillationSignal === "BREAKOUT_LIKELY";
  const breakdownLikely = data.oscillationSignal === "BREAKDOWN_LIKELY";

  // BUY near support — relaxed
  if (
    bullishSetup &&
    supportNear &&
    !data.intelligence.nearHighCaution
  ) {
    return buildPlan({
      action: "BUY",
      actionTone: "emerald",
      headline: "Bullish setup near support with favorable upside potential.",
      notes: [
        "Trend and confirmation are bullish.",
        "Price is trading near support or inside the support zone.",
        "This is a stronger long-entry location than a random mid-range entry.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "Open",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "Near support",
    });
  }

  // BUY on compression breakout setup
  if (breakoutLikely && resistanceNear) {
    return buildPlan({
      action: "BUY",
      actionTone: "emerald",
      headline: "Narrow oscillation at resistance suggests breakout potential.",
      notes: [
        "Price is compressing near resistance without material rejection.",
        "Oscillation logic favors an upside break.",
        "Watch for volume expansion to confirm follow-through.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "Open",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "N/A",
    });
  }

  // BUY momentum in open range
  if (
    bullishSetup &&
    !supportNear &&
    !resistanceNear &&
    highVolume &&
    !data.intelligence.nearHighCaution
  ) {
    return buildPlan({
      action: "BUY",
      actionTone: "emerald",
      headline: "Bullish momentum is building in open range.",
      notes: [
        "Trend is bullish and confirmed.",
        "Price is not yet blocked by nearby resistance.",
        "High volume supports momentum continuation.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "Open",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "N/A",
    });
  }

  // SELL on breakdown setup
  if (breakdownLikely && supportNear) {
    return buildPlan({
      action: "SELL",
      actionTone: "red",
      headline: "Narrow oscillation at support suggests breakdown risk.",
      notes: [
        "Price is compressing at support without a convincing bounce.",
        "Oscillation logic favors a downside break.",
        "A clean break can turn support into overhead resistance.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "N/A",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "At risk",
    });
  }

  // SELL near resistance with bearish confirmation
  if (bearishSetup && resistanceNear) {
    return buildPlan({
      action: "SELL",
      actionTone: "red",
      headline: "Bearish setup is active near resistance.",
      notes: [
        "Price is trading close to resistance.",
        "Bias and confirmation are bearish.",
        "This is a weaker long location and a stronger sell/rejection zone.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "Limited",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "N/A",
    });
  }

  // SELL momentum in open range
  if (
    bearishSetup &&
    !supportNear &&
    !resistanceNear &&
    highVolume
  ) {
    return buildPlan({
      action: "SELL",
      actionTone: "red",
      headline: "Bearish momentum is building in open range.",
      notes: [
        "Trend is bearish and confirmed.",
        "Price is not yet near support.",
        "High volume supports downside continuation.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "N/A",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "Open",
    });
  }

  if (resistanceNear && !supportNear) {
    return buildPlan({
      action: "TRIM",
      actionTone: "amber",
      headline: "Price is near resistance with limited immediate upside.",
      notes: [
        "Nearest resistance is close to current price.",
        "Upside room looks limited versus nearby overhead supply.",
        "This is a reasonable place to reduce aggression or trim.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "Limited",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "N/A",
    });
  }

  if (supportNear && !bullishSetup) {
    return buildPlan({
      action: "HOLD",
      actionTone: "blue",
      headline: "Price is near support, but confirmation is not clean yet.",
      notes: [
        "Support is close, so downside is somewhat defended.",
        "The bullish trigger is not strong enough for a fresh buy call.",
        "Best posture is to hold and wait for cleaner confirmation.",
      ],
      upsideRoom:
        resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "N/A",
      downsideCushion:
        supportDistance !== null ? `${supportDistance}% above support` : "Near support",
    });
  }

  return buildPlan({
    action: "WAIT",
    actionTone: "slate",
    headline: "No high-quality edge right now.",
    notes: [
      "Current structure does not offer a clean entry advantage.",
      "Support and resistance should be monitored for the next move.",
      "Waiting is better than forcing a trade in a mixed zone.",
    ],
    upsideRoom:
      resistanceDistance !== null ? `${resistanceDistance}% to resistance` : "N/A",
    downsideCushion:
      supportDistance !== null ? `${supportDistance}% above support` : "N/A",
  });
}