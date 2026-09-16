import { HttpService } from "@shared/api/HttpService";

/** Reporting a match, and whether the caller has already reported one. */
export class ReportService extends HttpService {
  submit(body) {
    return this.post("/reports", body);
  }

  status(config) {
    return this.get("/reports/status", config);
  }
}

export const reportService = new ReportService();
export default reportService;
