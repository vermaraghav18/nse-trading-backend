import { Stock } from "../../types/stock.types";
import { STOCK_SECTOR_MAP } from "./sector-map";
import { UpstoxInstrument } from "./upstox.types";

/**
 * Converts raw Upstox instruments into our internal stock model.
 * Sector is enriched from a local stock-sector map.
 */
export function mapUpstoxInstrumentsToStocks(
  instruments: UpstoxInstrument[]
): Stock[] {
  return instruments
    .filter((instrument) => {
      const isNse = instrument.exchange === "NSE";
      const hasSymbol = Boolean(instrument.trading_symbol);
      const isEquityLike =
        instrument.segment === "NSE_EQ" ||
        instrument.instrument_type === "EQ";

      return isNse && hasSymbol && isEquityLike;
    })
    .map((instrument, index) => {
      const symbol = instrument.trading_symbol;
      const sector = STOCK_SECTOR_MAP[symbol] || "Unknown";

      return {
        id: String(index + 1),
        instrumentKey: instrument.instrument_key,
        symbol,
        name: instrument.name || symbol,
        exchange: "NSE" as const,
        sector,
        isActive: true,
      };
    });
}