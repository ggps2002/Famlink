import {
  CookieConsent,
  CookieConsentAcceptAll,
  CookieConsentActions,
  CookieConsentCategories,
  CookieConsentCategory,
  CookieConsentDescription,
  CookieConsentLink,
  CookieConsentManage,
  CookieConsentRejectAll,
  CookieConsentSave,
  CookieConsentTitle,
} from "@shared/consent/CookieConsent";
import { COOKIE_CATEGORIES } from "@shared/consent/categories";

/**
 * The composition Famlink actually shows.
 *
 * The parts in CookieConsent.jsx are deliberately unopinionated about copy and
 * category list; this is the one arrangement of them the site renders, kept
 * separate so that changing the wording never means editing the mechanics.
 *
 * Collapsed, the panel is a title, a sentence and three buttons. "Manage"
 * reveals the switches and swaps itself for "Save choices", so the row never
 * offers both "expand" and "save the thing you have not expanded".
 */
export default function CookieConsentPanel({
  categories = COOKIE_CATEGORIES,
  cookiePolicyUrl = "/terms-and-conditions",
  ...rest
}) {
  return (
    <CookieConsent categories={categories} {...rest}>
      <div className="flex flex-col gap-1.5">
        <CookieConsentTitle>We use cookies</CookieConsentTitle>
        <CookieConsentDescription>
          Essential cookies keep you signed in and the site secure. With your permission we also
          use a few to understand how Famlink is used and to show families relevant content.{" "}
          <CookieConsentLink to={cookiePolicyUrl}>Cookie Policy</CookieConsentLink>
        </CookieConsentDescription>
      </div>

      <CookieConsentCategories>
        {categories.map((category) => (
          <CookieConsentCategory
            key={category.id}
            id={category.id}
            name={category.name}
            description={category.description}
            required={Boolean(category.isEssential)}
          />
        ))}
      </CookieConsentCategories>

      <CookieConsentActions>
        <CookieConsentAcceptAll />
        <CookieConsentRejectAll />
        <CookieConsentSave />
        <CookieConsentManage className="ms-auto" />
      </CookieConsentActions>
    </CookieConsent>
  );
}
