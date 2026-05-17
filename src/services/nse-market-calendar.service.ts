/**
 * NSE equity market calendar guard.
 * Purpose:
 * - block weekends
 * - block NSE equity trading holidays
 * - block outside normal market hours
 *
 * Timezone handled using Asia/Kolkata local time.
 */

type MarketSessionStatus = {
  isTradingDay: boolean;
  isMarketOpenNow: boolean;
  reason:
    | "MARKET_OPEN"
    | "WEEKEND"
    | "HOLIDAY"
    | "BEFORE_MARKET_OPEN"
    | "AFTER_MARKET_CLOSE";
  holidayName: string | null;
  localDate: string;
  localTime: string;
};

const NSE_MARKET_OPEN_HOUR = 9;
const NSE_MARKET_OPEN_MINUTE = 15;

const NSE_MARKET_CLOSE_HOUR = 15;
const NSE_MARKET_CLOSE_MINUTE = 30;

/**
 * 2026 NSE equity trading holidays (official list).
 * Format: YYYY-MM-DD
 *
 * Important:
 * Update this list each year from official NSE circular.
 */
const NSE_EQUITY_TRADING_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-26": "Republic Day",
  "2026-03-03": "Holi",
  "2026-03-26": "Shri Ram Navami",
  "2026-03-31": "Shri Mahavir Jayanti",
  "2026-04-03": "Good Friday",
  "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2026-05-01": "Maharashtra Day",
  "2026-05-28": "Bakri Id",
  "2026-06-26": "Muharram",
  "2026-09-14": "Ganesh Chaturthi",
  "2026-10-02": "Mahatma Gandhi Jayanti",
  "2026-10-20": "Dussehra",
  "2026-11-10": "Diwali-Balipratipada",
  "2026-11-24": "Prakash Gurpurb Sri Guru Nanak Dev",
  "2026-12-25": "Christmas",
};

/**
 * Some exchange notices can create exceptional sessions
 * (for example special live trading / muhurat / mock sessions).
 *
 * Keep this OFF by default unless you intentionally want to allow it.
 */
const MANUALLY_ALLOWED_SPECIAL_TRADING_DATES = new Set<string>([
  // Example:
  // "2026-02-01",
]);

function getIndiaNowParts(date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
  isoDate: string;
  timeLabel: string;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  const year = Number(part("year"));
  const month = Number(part("month"));
  const day = Number(part("day"));
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));
  const weekday = part("weekday");

  const isoDate = `${part("year")}-${part("month")}-${part("day")}`;
  const timeLabel = `${part("hour")}:${part("minute")}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    isoDate,
    timeLabel,
  };
}

function isWeekend(weekday: string): boolean {
  return weekday === "Sat" || weekday === "Sun";
}

function isHolidayDate(isoDate: string): {
  isHoliday: boolean;
  holidayName: string | null;
} {
  const holidayName = NSE_EQUITY_TRADING_HOLIDAYS_2026[isoDate] ?? null;

  return {
    isHoliday: Boolean(holidayName),
    holidayName,
  };
}

function isWithinNormalMarketHours(hour: number, minute: number): boolean {
  const totalMinutes = hour * 60 + minute;
  const openMinutes = NSE_MARKET_OPEN_HOUR * 60 + NSE_MARKET_OPEN_MINUTE;
  const closeMinutes = NSE_MARKET_CLOSE_HOUR * 60 + NSE_MARKET_CLOSE_MINUTE;

  return totalMinutes >= openMinutes && totalMinutes <= closeMinutes;
}

export function getNseMarketSessionStatus(date = new Date()): MarketSessionStatus {
  const india = getIndiaNowParts(date);

  if (MANUALLY_ALLOWED_SPECIAL_TRADING_DATES.has(india.isoDate)) {
    return {
      isTradingDay: true,
      isMarketOpenNow: true,
      reason: "MARKET_OPEN",
      holidayName: null,
      localDate: india.isoDate,
      localTime: india.timeLabel,
    };
  }

  if (isWeekend(india.weekday)) {
    return {
      isTradingDay: false,
      isMarketOpenNow: false,
      reason: "WEEKEND",
      holidayName: null,
      localDate: india.isoDate,
      localTime: india.timeLabel,
    };
  }

  const holidayCheck = isHolidayDate(india.isoDate);

  if (holidayCheck.isHoliday) {
    return {
      isTradingDay: false,
      isMarketOpenNow: false,
      reason: "HOLIDAY",
      holidayName: holidayCheck.holidayName,
      localDate: india.isoDate,
      localTime: india.timeLabel,
    };
  }

  const totalMinutes = india.hour * 60 + india.minute;
  const openMinutes = NSE_MARKET_OPEN_HOUR * 60 + NSE_MARKET_OPEN_MINUTE;
  const closeMinutes = NSE_MARKET_CLOSE_HOUR * 60 + NSE_MARKET_CLOSE_MINUTE;

  if (totalMinutes < openMinutes) {
    return {
      isTradingDay: true,
      isMarketOpenNow: false,
      reason: "BEFORE_MARKET_OPEN",
      holidayName: null,
      localDate: india.isoDate,
      localTime: india.timeLabel,
    };
  }

  if (totalMinutes > closeMinutes) {
    return {
      isTradingDay: true,
      isMarketOpenNow: false,
      reason: "AFTER_MARKET_CLOSE",
      holidayName: null,
      localDate: india.isoDate,
      localTime: india.timeLabel,
    };
  }

  return {
    isTradingDay: true,
    isMarketOpenNow: isWithinNormalMarketHours(india.hour, india.minute),
    reason: "MARKET_OPEN",
    holidayName: null,
    localDate: india.isoDate,
    localTime: india.timeLabel,
  };
}