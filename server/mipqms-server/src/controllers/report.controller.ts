import { Request, Response } from "express";
import { reportService } from "../services/report.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import type { ReportSummaryQuery } from "../validators/report.validators";

export const reportController = {
  /** GET /api/reports/summary?dateFrom=&dateTo=&departmentId= */
  getSummary: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ReportSummaryQuery;
    const summary = await reportService.getSummary(query);
    ApiResponse.success(res, summary, "Report summary retrieved.");
  }),
};
