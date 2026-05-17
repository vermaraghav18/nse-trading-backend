import { env } from "../../config/env";
import { UpstoxOhlcQuotesResponse } from "./ohlc.types";

/**
 * Fetches today's OHLC for indices using historical candle endpoint
 * This endpoint works without auth and supports indices
 */
async function fetchIndexOhlcViaHistoricalCandles(
  instrumentKey: string
): Promise<{ last_price: number; ohlc: any } | null> {
  try {
    const today = new Date();
    const toDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const fromDate = toDate; // Same day for today's candle
    
    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `https://api.upstox.com/v3/historical-candle/${encodedKey}/days/1/${toDate}/${fromDate}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const candles = json.data?.candles;
    
    if (!candles || candles.length === 0) {
      return null;
    }

    // Latest candle: [timestamp, open, high, low, close, volume, oi]
    const latest = candles[0];
    return {
      last_price: latest[4], // close price
      ohlc: {
        open: latest[1],
        high: latest[2],
        low: latest[3],
        close: latest[4],
      },
    };
  } catch (error) {
    console.warn(`[ohlc-client] Failed to fetch index ${instrumentKey}:`, error);
    return null;
  }
}

/**
 * Fetches current-day OHLC snapshot for multiple instruments from Upstox.
 * Handles both stocks (NSE_EQ) and indices (NSE_INDEX) using appropriate endpoints.
 */
export async function fetchUpstoxCurrentDayOhlc(
  instrumentKeys: string[]
): Promise<UpstoxOhlcQuotesResponse> {
  if (instrumentKeys.length === 0) {
    return {
      status: "success",
      data: {},
    };
  }

  // Separate stocks from indices
  const stocks = instrumentKeys.filter(key => key.startsWith("NSE_EQ|"));
  const indices = instrumentKeys.filter(key => key.startsWith("NSE_INDEX|"));
  
  const mergedData: Record<string, any> = {};

  // Fetch stocks using /ohlc endpoint (supports instrument_key)
  // Split into chunks of 10 to avoid API rate limits
  if (stocks.length > 0) {
    try {
      const CHUNK_SIZE = 10; // CHANGED: Reduced from 50 to 10 for better rate limit handling
      const chunks: string[][] = [];
      
      for (let i = 0; i < stocks.length; i += CHUNK_SIZE) {
        chunks.push(stocks.slice(i, i + CHUNK_SIZE));
      }
      
      console.log(`[ohlc-client] Fetching ${stocks.length} stocks in ${chunks.length} chunks`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          const encodedStocks = encodeURIComponent(chunk.join(","));
          const stockUrl = `https://api.upstox.com/v2/market-quote/ohlc?instrument_key=${encodedStocks}&interval=1d`;

          const stockResponse = await fetch(stockUrl, {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${env.upstoxAnalyticsToken}`,
            },
          });

          if (!stockResponse.ok) {
            const errorText = await stockResponse.text();
            console.warn(`[ohlc-client] Failed to fetch chunk of ${chunk.length} stocks: ${stockResponse.status}`);
            console.warn(`[ohlc-client] Error: ${errorText}`);
            failCount += chunk.length;
            console.log(`[ohlc-client] Successfully fetched 0/${chunk.length} stocks`);
            
            // Continue to next chunk even if this one fails
            if (i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // CHANGED: Increased delay
            }
            continue;
          }

          const stockJson = await stockResponse.json();
          
          if (stockJson.data) {
            let chunkSuccess = 0;
            for (const [key, value] of Object.entries(stockJson.data)) {
              const ohlcData = value as any;
              
              mergedData[key] = {
                last_price: ohlcData.last_price,
                instrument_token: ohlcData.instrument_token || key,
                prev_ohlc: ohlcData.prev_ohlc || null,
                live_ohlc: ohlcData.ohlc ? {
                  open: ohlcData.ohlc.open,
                  high: ohlcData.ohlc.high,
                  low: ohlcData.ohlc.low,
                  close: ohlcData.ohlc.close,
                  volume: ohlcData.ohlc.volume,
                  ts: ohlcData.ohlc.ts || Date.now(),
                } : null,
              };
              chunkSuccess++;
            }
            successCount += chunkSuccess;
            console.log(`[ohlc-client] Successfully fetched ${chunkSuccess}/${chunk.length} stocks`);
          }
        } catch (error) {
          console.error(`[ohlc-client] Chunk ${i + 1}/${chunks.length} error:`, error);
          failCount += chunk.length;
          console.log(`[ohlc-client] Successfully fetched 0/${chunk.length} stocks`);
        }
        
        // CHANGED: Increased delay between chunks from 100ms to 1000ms (1 second)
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`[ohlc-client] Total stocks: ${successCount} succeeded, ${failCount} failed (${stocks.length} total)`);
    } catch (error) {
      console.error("[ohlc-client] Error fetching stocks:", error);
      throw error;
    }
  }

  // Fetch indices using historical candle endpoint (no auth needed, works for indices)
  if (indices.length > 0) {
    console.log(`[ohlc-client] Fetching ${indices.length} indices via historical-candle endpoint`);
    
    let indexSuccessCount = 0;
    
    for (const indexKey of indices) {
      const indexData = await fetchIndexOhlcViaHistoricalCandles(indexKey);
      
      if (indexData) {
        mergedData[indexKey] = {
          last_price: indexData.last_price,
          instrument_token: indexKey,
          prev_ohlc: null,
          live_ohlc: {
            open: indexData.ohlc.open,
            high: indexData.ohlc.high,
            low: indexData.ohlc.low,
            close: indexData.ohlc.close,
            volume: 0,
            ts: Date.now(),
          },
        };
        indexSuccessCount++;
      }
      
      // CHANGED: Increased delay from 50ms to 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`[ohlc-client] Successfully fetched ${indexSuccessCount}/${indices.length} indices`);
  }

  return {
    status: "success",
    data: mergedData,
  };
}