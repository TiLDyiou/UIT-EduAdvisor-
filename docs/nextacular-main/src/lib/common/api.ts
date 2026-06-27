export type ApiOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: Record<string, string>;
};

export type ApiResult<T = Record<string, unknown>> = T & {
  status: number;
  url: string;
};

const api = async <T = Record<string, unknown>>(
  url: string,
  options: ApiOptions
): Promise<ApiResult<T>> => {
  const { body, headers, ...opts } = options;
  const requestBody = body !== undefined ? JSON.stringify(body) : undefined;
  const response = await fetch(url, {
    body: requestBody,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...opts,
  });
  const result = (await response.json()) as T;
  return { status: response.status, ...result, url };
};

export default api;
