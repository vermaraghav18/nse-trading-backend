import { Request, Response } from "express";
import {
  executeAutomationPaperTrades,
  getAutomationActions,
} from "../services/automation.service";

/**
 * Returns automation-ready actions for the current strategy layer.
 */
export const getAutomations = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const actions = await getAutomationActions();

    res.status(200).json({
      ok: true,
      count: actions.length,
      data: actions,
    });
  } catch (error) {
    console.error("Failed to fetch automations:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to build automation actions from strategy decisions.",
    });
  }
};

/**
 * Executes automation actions into paper trades.
 */
export const runAutomationPaperTrades = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await executeAutomationPaperTrades();

    res.status(200).json({
      ok: true,
      message: "Automation execution completed.",
      data: result,
    });
  } catch (error) {
    console.error("Failed to execute automation paper trades:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to execute automation paper trades.",
    });
  }
};