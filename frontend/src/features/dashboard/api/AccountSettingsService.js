import { HttpService } from "@shared/api/HttpService";

/**
 * The five things a member can change about their account from Settings.
 *
 * Each is its own endpoint rather than one PATCH, because changing an email or
 * a phone number re-triggers verification on the server while the notification
 * toggles do not.
 */
export class AccountSettingsService extends HttpService {
  updateEmail(body) {
    return this.put("/update/email", body);
  }

  updatePassword(body) {
    return this.put("/update/password", body);
  }

  updatePhone(body) {
    return this.put("/update/phone", body);
  }

  updateTextNotifications(body) {
    return this.put("/update/text-notifications", body);
  }

  updateEmailNotifications(body) {
    return this.put("/update/email-notifications", body);
  }
}

export const accountSettingsService = new AccountSettingsService();
export default accountSettingsService;
