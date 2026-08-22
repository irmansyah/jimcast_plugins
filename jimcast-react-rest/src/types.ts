// [plugins] jimcast-react-rest/src/types.ts 

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HeaderKV {
  key: string;
  value: string;
}

export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HeaderKV[];
  body: string;
}

export interface ResponseData {
  status?: number;
  statusText?: string;
  ok?: boolean;
  timeMs: number;
  body?: string;
  isJson?: boolean;
  headers?: [string, string][];
  sizeBytes?: number;
  error?: boolean;
  message?: string;
}

export type Zone = "sidebar" | "editor" | "response";
