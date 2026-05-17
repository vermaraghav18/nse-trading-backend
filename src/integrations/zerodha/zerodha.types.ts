/**
 * Type definitions for Zerodha Kite Connect API
 */

export interface ZerodhaCredentials {
  apiKey: string;
  apiSecret: string;
  clientId: string;
  redirectUrl: string;
  requestToken?: string;
  accessToken?: string;
}

export interface ZerodhaSessionData {
  user_id: string;
  user_name: string;
  email: string;
  user_type: string;
  broker: string;
  access_token: string;
  refresh_token?: string;
  login_time: string;
}

export interface ZerodhaQuote {
  instrument_token: number;
  timestamp: string;
  last_price: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume?: number;
  buy_quantity?: number;
  sell_quantity?: number;
  last_quantity?: number;
  average_price?: number;
  last_trade_time?: string;
}

export interface ZerodhaHistoricalData {
  status: string;
  data: {
    candles: [string, number, number, number, number, number, number][]; // [date, open, high, low, close, volume, oi]
  };
}

export interface ZerodhaInstrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
}

export interface ZerodhaRateLimitInfo {
  callsToday: number;
  callsThisHour: number;
  callsThisMinute: number;
  limitExceeded: boolean;
  resetAt: Date;
}