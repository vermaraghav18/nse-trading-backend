import { gunzipSync } from "zlib";
import { UPSTOX_NSE_INSTRUMENTS_URL } from "./upstox.constants";
import { UpstoxInstrument } from "./upstox.types";

/**
 * Downloads and parses the Upstox NSE instruments file.
 * The file is gzip-compressed JSON.
 */
export async function fetchUpstoxNseInstruments(): Promise<UpstoxInstrument[]> {
  const response = await fetch(UPSTOX_NSE_INSTRUMENTS_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Upstox instruments: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const compressedBuffer = Buffer.from(arrayBuffer);
  const jsonBuffer = gunzipSync(compressedBuffer);
  const parsed = JSON.parse(jsonBuffer.toString("utf-8")) as UpstoxInstrument[];

  return parsed;
}