import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { ar } from "./resources/ar";

export const resources = {
  ar: { ...ar },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "ar",
  fallbackLng: "ar",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: (typeof resources)["ar"];
  }
}

export default i18n;
