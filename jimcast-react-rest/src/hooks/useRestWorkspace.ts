// [plugins] jimcast-react-rest/src/hooks/useRestWorkspace.ts

import { useMemo, useRef, useState } from "react";
import type { HeaderKV, ResponseData, SavedRequest, Zone } from "../types";
import { SEED } from "../data/seedRequests";
import { newId, resolveTarget as resolveTargetUtil } from "../domain/requestUtils";


// // inside useRestWorkspace()
// import { useEffect, useRef } from 'react'
// import { useHostStorage } from '@jimcast/react-sdk/client'
//
// const storage = useHostStorage()
// const hydrated = useRef(false)
//
// // Load once on mount
// useEffect(() => {
//   storage.get('requests').then(raw => {
//     if (raw) setRequests(JSON.parse(raw))
//     hydrated.current = true
//   })
// }, [])
//
// // Persist on change, skipping the initial mount before hydration lands
// useEffect(() => {
//   if (!hydrated.current) return
//   storage.set('requests', JSON.stringify(requests)).catch(err =>
//     console.error('[rest] failed to persist requests', err)
//   )
// }, [requests])


export function useRestWorkspace() {
  const [requests, setRequests] = useState<SavedRequest[]>(SEED);
  const [selectedId, setSelectedId] = useState<string | null>(SEED[0].id);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<Zone>("sidebar");
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const idCounterRef = useRef<number>(0);
  const listRefs = useRef<(HTMLDivElement | null)[]>([]);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const selectedRequest = useMemo<SavedRequest | null>(
    () => requests.find((r) => r.id === selectedId) || null,
    [requests, selectedId],
  );

  function updateSelected(patch: Partial<SavedRequest>) {
    setRequests((prev) => prev.map((r) => (r.id === selectedId ? { ...r, ...patch } : r)));
  }

  function updateHeaders(headers: HeaderKV[]) {
    updateSelected({ headers });
  }

  function selectRequest(id: string, idx: number, focusEditor: boolean) {
    setSelectedId(id);
    setFocusedIndex(idx);
    setActiveZone("editor");
    setResponse(null);
    if (focusEditor) {
      requestAnimationFrame(() => urlInputRef.current && urlInputRef.current.focus());
    }
  }

  function handleNew() {
    const req: SavedRequest = {
      id: newId(idCounterRef),
      name: "",
      method: "GET",
      url: "",
      headers: [{ key: "", value: "" }],
      body: "",
    };
    setRequests((prev) => [req, ...prev]);
    setSelectedId(req.id);
    setFocusedIndex(0);
    setActiveZone("editor");
    setResponse(null);
    requestAnimationFrame(() => nameInputRef.current && nameInputRef.current.focus());
    return req;
  }

  function handleDelete(id: string) {
    setRequests((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      const next = prev.filter((r) => r.id !== id);
      if (selectedId === id) {
        const fallback = next[Math.min(idx, next.length - 1)];
        setSelectedId(fallback ? fallback.id : null);
        setResponse(null);
      }
      const newIdx = Math.max(0, Math.min(idx, next.length - 1));
      setFocusedIndex(newIdx);
      requestAnimationFrame(() => listRefs.current[newIdx] && listRefs.current[newIdx]!.focus());
      return next;
    });
    setDeleteConfirmId(null);
  }

  function moveFocus(delta: number) {
    setFocusedIndex((cur) => {
      const next = Math.max(0, Math.min(requests.length - 1, cur + delta));
      requestAnimationFrame(() => listRefs.current[next] && listRefs.current[next]!.focus());
      return next;
    });
  }

  function focusSidebarFromEditor() {
    setActiveZone("sidebar");
    requestAnimationFrame(() => listRefs.current[focusedIndex] && listRefs.current[focusedIndex]!.focus());
  }

  async function handleSend(target?: SavedRequest) {
    const reqToSend = target || selectedRequest;
    if (!reqToSend || !reqToSend.url) return;
    if (reqToSend.id !== selectedId) setSelectedId(reqToSend.id);
    setLoading(true);
    setResponse(null);
    setActiveZone("response");
    const start = performance.now();
    try {
      const headersObj: Record<string, string> = {};
      reqToSend.headers.forEach((h) => {
        if (h.key.trim()) headersObj[h.key] = h.value;
      });
      const opts: RequestInit = { method: reqToSend.method, headers: headersObj };
      if (["POST", "PUT", "PATCH"].includes(reqToSend.method) && reqToSend.body.trim()) {
        opts.body = reqToSend.body;
        if (!headersObj["Content-Type"] && !headersObj["content-type"]) {
          opts.headers = { ...headersObj, "Content-Type": "application/json" };
        }
      }
      const res = await fetch(reqToSend.url, opts);
      const timeMs = Math.round(performance.now() - start);
      const text = await res.text();
      let bodyOut = text;
      let isJson = false;
      try {
        bodyOut = JSON.stringify(JSON.parse(text), null, 2);
        isJson = true;
      } catch {
        // not JSON, keep raw text
      }
      const headersOut: [string, string][] = [];
      res.headers.forEach((v, k) => headersOut.push([k, v]));
      setResponse({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        timeMs,
        body: bodyOut,
        isJson,
        headers: headersOut,
        sizeBytes: new Blob([text]).size,
      });
    } catch (err) {
      const timeMs = Math.round(performance.now() - start);
      const message =
        err instanceof Error ? err.message : "Request failed — check the URL, or this may be blocked by CORS.";
      setResponse({ error: true, message, timeMs });
    } finally {
      setLoading(false);
    }
  }

  function resolveTarget(arg: string) {
    return resolveTargetUtil(requests, selectedRequest, arg);
  }

  return {
    requests,
    selectedId,
    selectedRequest,
    focusedIndex,
    setFocusedIndex,
    deleteConfirmId,
    setDeleteConfirmId,
    activeZone,
    setActiveZone,
    response,
    loading,
    listRefs,
    urlInputRef,
    nameInputRef,
    updateSelected,
    updateHeaders,
    selectRequest,
    handleNew,
    handleDelete,
    moveFocus,
    handleSend,
    focusSidebarFromEditor,
    resolveTarget,
    clearResponse: () => setResponse(null),
  };
}

export type RestWorkspace = ReturnType<typeof useRestWorkspace>;
