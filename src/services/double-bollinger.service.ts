import { getHistoricalDailySeries } from "./market-history.service";
import { getAllCandles } from "./candle.service";
import { getCachedHistorical1HSeries } from "./market-history-1h-cache.service";
import { getCachedLive1HCandles } from "./live-1h-cache.service";
import { Candle } from "../types/candle.types";
import { Intraday1HCandle } from "../types/intraday-1h.types";

const BOLLINGER_PERIOD = 20;
const STANDARD_DEVIATION_MULTIPLIER = 2;

export interface DoubleBollingerResult {
  id: number;
  symbol: string;
  
  // Daily timeframe
  dailyClose: number;
  dailyPercentB: number;
  dailyMiddleBand: number;
  dailyLowerBand: number;
  dailySignal: "AT_BOTTOM" | "NEUTRAL";
  dailyMiddleBandRising: boolean;
  
  // 1H timeframe
  oneHourClose: number;
  oneHourPercentB: number;
  oneHourMiddleBand: number;
  oneHourLowerBand: number;
  oneHourSignal: "AT_BOTTOM" | "AT_MIDDLE" | "NEUTRAL";
  
  // 2H proxy (using 1H data)
  twoHourClose: number;
  twoHourPercentB: number;
  twoHourMiddleBand: number;
  twoHourSignal: "AT_BOTTOM" | "AT_MIDDLE" | "NEUTRAL";
  
  // Confirmation grade
  confirmationGrade: "A" | "B" | "NONE";
  
  // EMA crossover (7 crosses above 14 on 1H)
  ema7: number;
  ema14: number;
  emaCrossover: boolean;
  
  // Price action (green candle closes above prior red on 1H)
  priceActionConfirm: boolean;
  
  // Volume (above 20-period average on 1H)
  volumeConfirm: boolean;
  
  // VWAP (price crossed above VWAP)
  vwapValue: number;
  vwapCrossover: boolean;
  
  // Final scoring
  checklistScore: number;
  isEntryReady: boolean;
  
  // Entry/Exit levels
  entryPrice: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  
  notes: string[];
}

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function calculateMean(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function calculateStandardDeviation(values: number[], mean: number): number {
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

function calculateBollinger(
  closes: number[]
): { middleBand: number; upperBand: number; lowerBand: number; percentB: number } | null {
  if (closes.length < BOLLINGER_PERIOD) {
    return null;
  }

  const window = closes.slice(-BOLLINGER_PERIOD);
  const mean = calculateMean(window);
  const std = calculateStandardDeviation(window, mean);
  
  const middleBand = roundTo2(mean);
  const upperBand = roundTo2(mean + STANDARD_DEVIATION_MULTIPLIER * std);
  const lowerBand = roundTo2(mean - STANDARD_DEVIATION_MULTIPLIER * std);
  
  const currentClose = closes[closes.length - 1];
  const bandWidth = upperBand - lowerBand;
  const percentB = bandWidth === 0 ? 0.5 : (currentClose - lowerBand) / bandWidth;
  
  return {
    middleBand,
    upperBand,
    lowerBand,
    percentB: roundTo2(percentB)
  };
}

function calculateEMA(closes: number[], period: number): number {
  if (closes.length < period) {
    return closes[closes.length - 1];
  }
  
  const multiplier = 2 / (period + 1);
  let ema = calculateMean(closes.slice(0, period));
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  
  return roundTo2(ema);
}

function calculateVWAP(candles: Array<{high: number; low: number; close: number; volume: number}>): number {
  if (candles.length === 0) return 0;
  
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  
  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativePV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
  }
  
  return cumulativeVolume === 0 ? 0 : roundTo2(cumulativePV / cumulativeVolume);
}

export async function getDoubleBollingerConfirmation(): Promise<DoubleBollingerResult[]> {
  try {
    const [dailyHistory, liveDaily, oneHourHistory, live1H] = await Promise.all([
      getHistoricalDailySeries(),
      getAllCandles(),
      Promise.resolve(getCachedHistorical1HSeries()),
      Promise.resolve(getCachedLive1HCandles()),
    ]);

    const liveDailyMap = new Map<string, Candle>(
      liveDaily.map((c) => [c.instrumentKey, c])
    );
    const live1HMap = new Map<string, Intraday1HCandle>(
      live1H.map((c) => [c.instrumentKey, c])
    );
    
    const results: DoubleBollingerResult[] = [];

    for (const dailySeries of dailyHistory) {
      const symbol = dailySeries.symbol;
      const instrumentKey = dailySeries.instrumentKey;
      
      // DAILY BOLLINGER
      const dailyCandles = dailySeries.candles.slice(1).reverse();
      const dailyCloses = dailyCandles.map((c) => c[4]);
      
      const liveDailyCandle = liveDailyMap.get(instrumentKey);
      if (liveDailyCandle) {
        if (dailyCloses.length > 0 && dailyCandles[dailyCloses.length - 1][0] === liveDailyCandle.date) {
          dailyCloses[dailyCloses.length - 1] = liveDailyCandle.close;
        } else {
          dailyCloses.push(liveDailyCandle.close);
        }
      }
      
      const dailyBollinger = calculateBollinger(dailyCloses);
      if (!dailyBollinger) continue;
      
      const dailyClose = dailyCloses[dailyCloses.length - 1];
      const dailyPercentB = dailyBollinger.percentB;
      const dailySignal = dailyPercentB < 0.2 ? "AT_BOTTOM" : "NEUTRAL";
      
      // CRITERIA 1: Skip if daily is not at bottom
if (dailySignal !== "AT_BOTTOM") {
  console.log(`${symbol}: Daily %B = ${dailyPercentB.toFixed(2)} (skipped - not at bottom)`);
  continue;
}
      
      // CRITERIA 2: CHECK DAILY MIDDLE BAND DIRECTION (Must be RISING)
      if (dailyCandles.length < 5) continue;
      
      const dailyMiddleBands = [];
      for (let i = Math.max(0, dailyCandles.length - 5); i < dailyCandles.length; i++) {
        const windowStart = Math.max(0, i - 19);
        const windowCloses = dailyCloses.slice(windowStart, i + 1);
        if (windowCloses.length >= 20) {
          const mean = calculateMean(windowCloses.slice(-20));
          dailyMiddleBands.push(mean);
        }
      }
      
      let risingCount = 0;
      for (let i = 1; i < dailyMiddleBands.length; i++) {
        if (dailyMiddleBands[i] > dailyMiddleBands[i - 1]) {
          risingCount++;
        }
      }
      
      const isDailyMiddleBandRising = risingCount >= 3;
      
      // REJECT if Daily middle band is FALLING (Grade C - breakdown scenario)
      if (!isDailyMiddleBandRising) continue;
      
      // 1H BOLLINGER
      const oneHourSeries = oneHourHistory.find((s) => s.symbol === symbol);
      if (!oneHourSeries) continue;
      
      const oneHourCandles = oneHourSeries.candles.slice(1).reverse();
      const oneHourCloses = oneHourCandles.map((c) => c[4]);
      const oneHourHighs = oneHourCandles.map((c) => c[2]);
      const oneHourLows = oneHourCandles.map((c) => c[3]);
      const oneHourVolumes = oneHourCandles.map((c) => c[5]);
      
      const live1HCandle = live1HMap.get(instrumentKey);
      if (live1HCandle) {
        if (oneHourCloses.length > 0 && oneHourCandles[oneHourCloses.length - 1][0] === live1HCandle.dateTime) {
          oneHourCloses[oneHourCloses.length - 1] = live1HCandle.close;
          oneHourHighs[oneHourHighs.length - 1] = live1HCandle.high;
          oneHourLows[oneHourLows.length - 1] = live1HCandle.low;
          oneHourVolumes[oneHourVolumes.length - 1] = live1HCandle.volume;
        } else {
          oneHourCloses.push(live1HCandle.close);
          oneHourHighs.push(live1HCandle.high);
          oneHourLows.push(live1HCandle.low);
          oneHourVolumes.push(live1HCandle.volume);
        }
      }
      
      const oneHourBollinger = calculateBollinger(oneHourCloses);
      if (!oneHourBollinger) continue;
      
      const oneHourClose = oneHourCloses[oneHourCloses.length - 1];
      const oneHourPercentB = oneHourBollinger.percentB;
      
      let oneHourSignal: "AT_BOTTOM" | "AT_MIDDLE" | "NEUTRAL";
      if (oneHourPercentB < 0.2) {
        oneHourSignal = "AT_BOTTOM";
      } else if (oneHourPercentB >= 0.4 && oneHourPercentB <= 0.6) {
        oneHourSignal = "AT_MIDDLE";
      } else {
        oneHourSignal = "NEUTRAL";
      }
      
      // 2H PROXY (use every 2nd 1H candle)
      const twoHourCloses = oneHourCloses.filter((_, idx) => idx % 2 === 0);
      const twoHourHighs = oneHourHighs.filter((_, idx) => idx % 2 === 0);
      const twoHourLows = oneHourLows.filter((_, idx) => idx % 2 === 0);
      
      const twoHourBollinger = calculateBollinger(twoHourCloses);
      if (!twoHourBollinger) continue;
      
      const twoHourClose = twoHourCloses[twoHourCloses.length - 1];
      const twoHourPercentB = twoHourBollinger.percentB;
      
      let twoHourSignal: "AT_BOTTOM" | "AT_MIDDLE" | "NEUTRAL";
      if (twoHourPercentB < 0.2) {
        twoHourSignal = "AT_BOTTOM";
      } else if (twoHourPercentB >= 0.4 && twoHourPercentB <= 0.6) {
        twoHourSignal = "AT_MIDDLE";
      } else {
        twoHourSignal = "NEUTRAL";
      }
      
      // CRITERIA 3: CONFIRMATION GRADE (1H/2H position)
      let confirmationGrade: "A" | "B" | "NONE" = "NONE";
      
      // Grade A: Price is taking support AT the middle band (within 2% of SMA20)
      const oneHourDistanceFromMiddle = Math.abs(oneHourClose - oneHourBollinger.middleBand) / oneHourBollinger.middleBand;
      const twoHourDistanceFromMiddle = Math.abs(twoHourClose - twoHourBollinger.middleBand) / twoHourBollinger.middleBand;
      
      const oneHourAtMiddleSupport = oneHourDistanceFromMiddle <= 0.02;
      const twoHourAtMiddleSupport = twoHourDistanceFromMiddle <= 0.02;
      
      if (oneHourAtMiddleSupport || twoHourAtMiddleSupport) {
        confirmationGrade = "A";
      } else if (oneHourSignal === "AT_BOTTOM" || twoHourSignal === "AT_BOTTOM") {
        // Grade B: Check BOTH 1H and 2H for bullish candle pattern
        
        // Check 1H candle
        const oneHourLatest = {
          open: oneHourCandles[oneHourCandles.length - 1][1],
          close: oneHourClose,
          low: oneHourLows[oneHourLows.length - 1],
          high: oneHourHighs[oneHourHighs.length - 1]
        };
        
        const oneHourIsGreen = oneHourLatest.close > oneHourLatest.open;
        const oneHourBody = Math.abs(oneHourLatest.close - oneHourLatest.open);
        const oneHourLowerWick = Math.min(oneHourLatest.open, oneHourLatest.close) - oneHourLatest.low;
        const oneHourHasRejectionWick = oneHourLowerWick > oneHourBody * 0.5;
        
        const oneHourBullish = oneHourIsGreen && oneHourHasRejectionWick;
        
        // Check 2H candle (combined from last 2x 1H candles)
        let twoHourBullish = false;
        if (oneHourCandles.length >= 2) {
          const twoHourOpen = oneHourCandles[oneHourCandles.length - 2][1];
          const twoHourCloseValue = twoHourClose;
          const twoHourLow = Math.min(oneHourLows[oneHourLows.length - 1], oneHourLows[oneHourLows.length - 2]);
          const twoHourHigh = Math.max(oneHourHighs[oneHourHighs.length - 1], oneHourHighs[oneHourHighs.length - 2]);
          
          const twoHourIsGreen = twoHourCloseValue > twoHourOpen;
          const twoHourBody = Math.abs(twoHourCloseValue - twoHourOpen);
          const twoHourLowerWick = Math.min(twoHourOpen, twoHourCloseValue) - twoHourLow;
          const twoHourHasRejectionWick = twoHourLowerWick > twoHourBody * 0.5;
          
          twoHourBullish = twoHourIsGreen && twoHourHasRejectionWick;
        }
        
        if (oneHourBullish || twoHourBullish) {
          confirmationGrade = "B";
        }
      }
      
      if (confirmationGrade === "NONE") continue;
      
      // CRITERIA 4: CHECKLIST (need 3 of 4)
      
      // EMA CROSSOVER
      const ema7 = calculateEMA(oneHourCloses, 7);
      const ema14 = calculateEMA(oneHourCloses, 14);
      const emaCrossover = ema7 > ema14;
      
      // PRICE ACTION
      let priceActionConfirm = false;
      if (oneHourCandles.length >= 2) {
        const current = {
          open: oneHourCandles[oneHourCandles.length - 1][1],
          close: oneHourClose,
          high: oneHourHighs[oneHourHighs.length - 1]
        };
        const previous = {
          open: oneHourCandles[oneHourCandles.length - 2][1],
          close: oneHourCandles[oneHourCandles.length - 2][4],
          high: oneHourHighs[oneHourHighs.length - 2]
        };
        
        const currentIsGreen = current.close > current.open;
        const previousIsRed = previous.close < previous.open;
        
        if (currentIsGreen && current.close > previous.high) {
          priceActionConfirm = true;
        }
      }
      
      // VOLUME
      let volumeConfirm = false;
      if (oneHourVolumes.length >= 21) {
        const avgVolume = calculateMean(oneHourVolumes.slice(-21, -1));
        const currentVolume = oneHourVolumes[oneHourVolumes.length - 1];
        volumeConfirm = currentVolume > avgVolume;
      }
      
      // VWAP
      const todayCandles = oneHourCandles.slice(-10).map((c, idx) => ({
        high: oneHourHighs[oneHourHighs.length - 10 + idx],
        low: oneHourLows[oneHourLows.length - 10 + idx],
        close: c[4],
        volume: oneHourVolumes[oneHourVolumes.length - 10 + idx]
      }));
      
      const vwapValue = calculateVWAP(todayCandles);
      const vwapCrossover = oneHourClose > vwapValue;
      
      // CHECKLIST SCORE
      const checklistScore = [emaCrossover, priceActionConfirm, volumeConfirm, vwapCrossover].filter(Boolean).length;
      const isEntryReady = checklistScore >= 3;
      
      // ENTRY/EXIT LEVELS
      let entryPrice: number | null = null;
      let stopLoss: number | null = null;
      let target1: number | null = null;
      let target2: number | null = null;
      
      if (isEntryReady) {
        entryPrice = roundTo2(oneHourClose);
        
        const oneHourSwingLow = Math.min(...oneHourLows.slice(-5));
        stopLoss = roundTo2(Math.min(oneHourSwingLow, oneHourBollinger.lowerBand));
        
        target1 = dailyBollinger.middleBand;
        target2 = dailyBollinger.upperBand;
      }
      
      // NOTES
      const notes: string[] = [];
      
      notes.push(`Daily %B: ${dailyPercentB.toFixed(2)} (bottom band signal)`);
      notes.push(`Daily Middle Band: ${isDailyMiddleBandRising ? 'RISING ✓' : 'FALLING ✗'}`);
      
      if (confirmationGrade === "A") {
        notes.push(`Grade A: 1H/2H at middle band while daily at bottom - early reversal signal`);
      } else if (confirmationGrade === "B") {
        notes.push(`Grade B: 1H/2H at bottom with bullish candle - bounce attempt starting`);
      }
      
      notes.push(`Checklist: ${checklistScore}/4 confirmations`);
      
      if (!emaCrossover) notes.push(`⏳ Waiting: 7 EMA needs to cross above 14 EMA`);
      if (!priceActionConfirm) notes.push(`⏳ Waiting: Green candle needs to close above prior red high`);
      if (!volumeConfirm) notes.push(`⏳ Waiting: Volume needs to exceed 20-period average`);
      if (!vwapCrossover) notes.push(`⏳ Waiting: Price needs to cross above VWAP`);
      
      if (isEntryReady) {
        notes.push(`✅ ENTRY READY: 3+ confirmations met`);
      }
      
      results.push({
        id: parseInt(dailySeries.id),
        symbol,
        dailyClose,
        dailyPercentB,
        dailyMiddleBand: dailyBollinger.middleBand,
        dailyLowerBand: dailyBollinger.lowerBand,
        dailySignal,
        dailyMiddleBandRising: isDailyMiddleBandRising,
        oneHourClose,
        oneHourPercentB,
        oneHourMiddleBand: oneHourBollinger.middleBand,
        oneHourLowerBand: oneHourBollinger.lowerBand,
        oneHourSignal,
        twoHourClose,
        twoHourPercentB,
        twoHourMiddleBand: twoHourBollinger.middleBand,
        twoHourSignal,
        confirmationGrade,
        ema7,
        ema14,
        emaCrossover,
        priceActionConfirm,
        volumeConfirm,
        vwapValue,
        vwapCrossover,
        checklistScore,
        isEntryReady,
        entryPrice,
        stopLoss,
        target1,
        target2,
        notes
      });
    }
    
    return results.sort((a, b) => {
      if (a.confirmationGrade !== b.confirmationGrade) {
        return a.confirmationGrade === "A" ? -1 : 1;
      }
      return b.checklistScore - a.checklistScore;
    });
  } catch (error) {
    console.error("Error in getDoubleBollingerConfirmation:", error);
    return [];
  }
}