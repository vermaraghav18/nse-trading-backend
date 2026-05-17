import { fetchAllNseIndexQuotes } from "../integrations/nse/index-quotes.client";
import { fetchNseIndexStocks, mapIndexSymbolToNseName } from "../integrations/nse/nse-stocks.client";
import { fetchOiForSymbol, isFoEligible } from "./futures-oi.service";
import type { HeatmapCell, HeatmapResponse, HeatmapIndex } from "../types/heatmap.types";

/**
 * Color mapping for percentage changes
 */
function getColor(percentChange: number): "green" | "red" | "gray" {
  if (percentChange > 0) return "green";
  if (percentChange < 0) return "red";
  return "gray";
}

/**
 * Calculate intensity (0-1) based on absolute percentage change
 */
function calculateIntensity(percentChange: number): number {
  const absChange = Math.abs(percentChange);
  // Cap at 10% for max intensity
  return Math.min(absChange / 10, 1);
}

/**
 * Fetch heatmap data for all indices
 */
export async function getIndicesHeatmap(): Promise<HeatmapResponse> {
  try {
    console.log("[heatmap-service] Fetching indices heatmap data from NSE");
    
    const nseData = await fetchAllNseIndexQuotes();
    
    if (!nseData || Object.keys(nseData).length === 0) {
      throw new Error("No index data received from NSE");
    }
    
    // Convert Record to array of values
    const indexArray = Object.values(nseData);
    
    // Convert to heatmap cells
    const heatmapCells: HeatmapCell[] = indexArray.map((item) => ({
      symbol: item.symbol,
      name: item.symbol,
      value: item.lastPrice,
      percentChange: item.pChange,
      previousClose: item.previousClose,
      volume: 0, // NSE index quotes don't have volume
      color: getColor(item.pChange),
      intensity: calculateIntensity(item.pChange),
    }));
    
    console.log(`[heatmap-service] Successfully processed ${heatmapCells.length} indices from NSE`);
    
    return {
      ok: true,
      data: heatmapCells,
      timestamp: new Date().toISOString(),
      category: "indices",
    };
  } catch (error) {
    console.error("[heatmap-service] Failed to fetch indices heatmap:", error);
    throw new Error(`Failed to fetch indices heatmap: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch heatmap data for stocks in a specific index
 */
export async function getStocksHeatmap(indexSymbol: string): Promise<HeatmapResponse> {
  try {
    console.log(`[heatmap-service] Fetching stocks heatmap for ${indexSymbol}`);
    
    // Map symbol to NSE API format
    const nseName = mapIndexSymbolToNseName(indexSymbol);
    
    // Fetch stock data directly from NSE
    const nseData = await fetchNseIndexStocks(nseName);
    
    if (!nseData.data || nseData.data.length === 0) {
      console.warn(`[heatmap-service] No stocks found for ${indexSymbol}`);
      return {
        ok: true,
        data: [],
        timestamp: new Date().toISOString(),
        category: "stocks",
      };
    }
    
    console.log(`[heatmap-service] Processing ${nseData.data.length} stocks from NSE`);
    
    // Convert NSE data to heatmap cells
    const cells: HeatmapCell[] = nseData.data
      .filter(stock => {
        // Filter out the index itself (it's included in the response)
        const upperSymbol = stock.symbol?.toUpperCase() || "";
        const upperIdentifier = stock.identifier?.toUpperCase() || "";
        const upperIndex = indexSymbol.toUpperCase();
        const nseName = mapIndexSymbolToNseName(indexSymbol).toUpperCase();
        
        // Exclude if symbol matches our index OR NSE's index name
        return upperSymbol !== upperIndex && 
               upperIdentifier !== upperIndex && 
               upperSymbol !== nseName &&
               !upperSymbol.includes("NIFTY");
      })
      .map(stock => ({
        symbol: stock.symbol,
        name: stock.symbol,
        value: stock.lastPrice,
        percentChange: stock.pChange,
        previousClose: stock.previousClose,
        volume: stock.totalTradedVolume,
        weightage: stock.weight,
        color: getColor(stock.pChange),
        intensity: calculateIntensity(stock.pChange),
      }));
    
    // Sort by weightage if available, otherwise by absolute % change
    if (cells.some(c => c.weightage !== undefined)) {
      cells.sort((a, b) => (b.weightage || 0) - (a.weightage || 0));
      console.log(`[heatmap-service] Sorted ${cells.length} stocks by weightage`);
    } else {
      cells.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
      console.log(`[heatmap-service] Sorted ${cells.length} stocks by % change (no weightage data)`);
    }
    
    // ========== ENRICH WITH FUTURES OI DATA ==========
    // Filter F&O eligible stocks
    const foStocks = cells.filter(cell => isFoEligible(cell.symbol));
    console.log(`[heatmap-service] Found ${foStocks.length} F&O eligible stocks out of ${cells.length} total`);
    
    if (foStocks.length > 0) {
      // Batch fetch OI data in parallel
      console.log(`[heatmap-service] Fetching OI data for ${foStocks.length} stocks in parallel...`);
      const oiResults = await Promise.allSettled(
        foStocks.map(cell => fetchOiForSymbol(cell.symbol))
      );
      
      // Create OI lookup map
      const oiMap = new Map<string, any>();
      let successCount = 0;
      oiResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          oiMap.set(foStocks[idx].symbol, result.value);
          if (result.value.buildupType !== 'NO_DATA') {
            successCount++;
          }
        }
      });
      console.log(`[heatmap-service] Successfully fetched OI data for ${successCount} stocks`);
      
      // Enrich cells with OI data
      cells.forEach(cell => {
        const oiData = oiMap.get(cell.symbol);
        
        if (oiData && oiData.buildupType !== 'NO_DATA') {
          cell.buildupType = oiData.buildupType;
          cell.oiChangePct = oiData.oiChangePct;
          cell.currentOi = oiData.currentOi;
          cell.prevOi = oiData.prevOi;
          cell.isFoEligible = oiData.isF0Eligible;
        } else if (isFoEligible(cell.symbol)) {
          // Mark as F&O eligible but no data available
          cell.isFoEligible = true;
          cell.buildupType = 'NO_DATA';
        }
      });
    }
    // ========== END OI ENRICHMENT ==========
    
    console.log(`[heatmap-service] Successfully processed ${cells.length} stocks for ${indexSymbol}`);
    
    return {
      ok: true,
      data: cells,
      timestamp: nseData.timestamp,
      category: "stocks",
    };
  } catch (error) {
    console.error(`[heatmap-service] Failed to fetch stocks heatmap for ${indexSymbol}:`, error);
    throw new Error(`Failed to fetch stocks heatmap: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all supported indices with their categories
 */
export function getSupportedIndices(): HeatmapIndex[] {
  return [
    // Broad Market
    { symbol: "NIFTY50", name: "Nifty 50", category: "Broad Market" },
    { symbol: "NIFTYNEXT50", name: "Nifty Next 50", category: "Broad Market" },
    { symbol: "NIFTY100", name: "Nifty 100", category: "Broad Market" },
    { symbol: "NIFTY200", name: "Nifty 200", category: "Broad Market" },
    { symbol: "NIFTY500", name: "Nifty 500", category: "Broad Market" },
    { symbol: "NIFTYMIDCAP50", name: "Nifty Midcap 50", category: "Broad Market" },
    { symbol: "NIFTYMIDCAP100", name: "Nifty Midcap 100", category: "Broad Market" },
    { symbol: "NIFTYSMALLCAP50", name: "Nifty Smallcap 50", category: "Broad Market" },
    { symbol: "NIFTYSMALLCAP100", name: "Nifty Smallcap 100", category: "Broad Market" },
    
    // Sectoral
    { symbol: "NIFTYBANK", name: "Nifty Bank", category: "Sectoral" },
    { symbol: "NIFTYAUTO", name: "Nifty Auto", category: "Sectoral" },
    { symbol: "NIFTYFMCG", name: "Nifty FMCG", category: "Sectoral" },
    { symbol: "NIFTYIT", name: "Nifty IT", category: "Sectoral" },
    { symbol: "NIFTYMEDIA", name: "Nifty Media", category: "Sectoral" },
    { symbol: "NIFTYMETAL", name: "Nifty Metal", category: "Sectoral" },
    { symbol: "NIFTYPHARMA", name: "Nifty Pharma", category: "Sectoral" },
    { symbol: "NIFTYPSUBANK", name: "Nifty PSU Bank", category: "Sectoral" },
    { symbol: "NIFTYPVTBANK", name: "Nifty Private Bank", category: "Sectoral" },
    { symbol: "NIFTYREALTY", name: "Nifty Realty", category: "Sectoral" },
    { symbol: "NIFTYFINSERVICE", name: "Nifty Financial Services", category: "Sectoral" },
    { symbol: "NIFTYHEALTHCARE", name: "Nifty Healthcare", category: "Sectoral" },
    { symbol: "NIFTYOILGAS", name: "Nifty Oil & Gas", category: "Sectoral" },
    
    // Thematic
    { symbol: "NIFTYCOMMODITIES", name: "Nifty Commodities", category: "Thematic" },
    { symbol: "NIFTYCONSUMPTION", name: "Nifty Consumption", category: "Thematic" },
    { symbol: "NIFTYCPSE", name: "Nifty CPSE", category: "Thematic" },
    { symbol: "NIFTYENERGY", name: "Nifty Energy", category: "Thematic" },
    { symbol: "NIFTYINFRA", name: "Nifty Infrastructure", category: "Thematic" },
  ];
}