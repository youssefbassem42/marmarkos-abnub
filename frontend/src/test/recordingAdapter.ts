import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

import { apiClient } from "@/lib/api";

/**
 * A recording adapter for the axios client.
 *
 * The API clients are thin wrappers: what matters is the **method**,
 * the **URL**, the **parameters** and the **body** they send. The
 * adapter records the calls and answers with a canned body, so a test
 * can assert the contract of the client without a server.
 */

export interface RecordedCall {
  method: string;
  url: string;
  params?: unknown;
  data?: unknown;
}

export interface RecordingAdapter {
  calls: RecordedCall[];
  /** Install the adapter and return the recorder. */
  install: () => RecordedCall[];
  /** Remove the adapter and restore the original one. */
  restore: () => void;
}

/**
 * Install the recording adapter.
 *
 * @param body the body every answer carries (the default is an empty
 * object; the shape does not matter for the tests of the clients).
 * @param status the status every answer carries.
 */
export function recordApiCalls(
  body: unknown = {},
  status = 200,
): RecordingAdapter {
  const originalAdapter = apiClient.defaults.adapter;
  const calls: RecordedCall[] = [];

  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls.push({
      method: (config.method ?? "get").toLowerCase(),
      url: config.url ?? "",
      params: config.params,
      data: config.data,
    });
    if (status >= 400) {
      const error = new Error(`Request failed with status code ${status}`);
      Object.assign(error, {
        isAxiosError: true,
        response: { status, data: body },
        config,
      });
      throw error;
    }
    return {
      data: body,
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: {},
      config,
    } as AxiosResponse;
  };

  return {
    calls,
    install: () => calls,
    restore: () => {
      apiClient.defaults.adapter = originalAdapter;
    },
  };
}

/** The single call a test made (fails when there was not exactly one). */
export function onlyCall(calls: RecordedCall[]): RecordedCall {
  if (calls.length !== 1) {
    throw new Error(`expected exactly one call, got ${calls.length}`);
  }
  return calls[0]!;
}
