import type { SavedRequest } from "../types";

export const SEED: SavedRequest[] = [
  {
    id: "seed-1",
    name: "Get post #1",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    headers: [{ key: "", value: "" }],
    body: "",
  },
  {
    id: "seed-2",
    name: "Create post",
    method: "POST",
    url: "https://jsonplaceholder.typicode.com/posts",
    headers: [{ key: "Content-Type", value: "application/json" }],
    body: '{\n  "title": "hello",\n  "body": "world",\n  "userId": 1\n}',
  },
  {
    id: "seed-3",
    name: "Delete post #1",
    method: "DELETE",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    headers: [{ key: "", value: "" }],
    body: "",
  },
];
