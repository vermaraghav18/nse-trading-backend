/**
 * Stock type used by the stock universe module.
 * This is our normalized internal stock shape.
 */
export type Stock = {
  id: string;
  instrumentKey: string;
  symbol: string;
  name: string;
  exchange: "NSE";
  sector: string;
  isActive: boolean;
};