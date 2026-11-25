import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { describeApiError, type DescribedError } from "@/lib/errorMessages";

/** Describe an API failure in Arabic from inside a React component. */
export function useApiError(): (error: unknown) => DescribedError {
  const { t } = useTranslation();

  return useCallback((error: unknown) => describeApiError(error, t), [t]);
}
