"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { getToken } from "@healthcore/auth";
import { Spinner } from "@/components/ui/Spinner";
import {
  applyDeskFrame,
  deskSocketUrl,
  RECONNECT_DELAYS_MS,
  type DeskChatFrame,
  type DeskChatMessage,
} from "@/lib/knowledge/desk-chat";

const DESK_FAILURE = "The desk could not answer that question. Try again.";
const DESK_OFFLINE = "The desk is not connected, so the question was not sent. Refresh the page once the API is running.";
const CONNECT_TIMEOUT_MS = 8000;

const EXAMPLES = [
  "Is there a charge for cancelling 12 hours in advance?",
  "What do I need to bring to my first appointment?",
];
const SESSION_KEY = "healthcore.desk.session_id";

export function DeskKnowledgePage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<DeskChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const generatingRef = useRef(false);
  const sessionIdRef = useRef("");
  const transcriptRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sessionId = readSessionId();
    sessionIdRef.current = sessionId;

    function connect() {
      if (cancelled) return;
      const token = getToken();
      if (!token) {
        setError("Sign in again to ask the desk.");
        return;
      }
      socket = new WebSocket(deskSocketUrl(sessionId, token));
      socketRef.current = socket;
      const connecting = socket;
      const openTimer = window.setTimeout(() => {
        if (connecting.readyState === WebSocket.CONNECTING) {
          connecting.close();
        }
      }, CONNECT_TIMEOUT_MS);
      socket.onopen = () => {
        window.clearTimeout(openTimer);
        attempt = 0;
        setConnected(true);
        setReconnecting(false);
        setError(null);
      };
      socket.onmessage = (event) => {
        let frame: DeskChatFrame;
        try {
          frame = JSON.parse(String(event.data)) as DeskChatFrame;
        } catch {
          return;
        }
        if (frame.event === "generation_completed" || frame.event === "generation_failed") {
          generatingRef.current = false;
          setGenerating(false);
          if (frame.event === "generation_failed") {
            setError(frame.data?.text?.trim() || DESK_FAILURE);
          }
        } else if (frame.event === "generation_interrupted") {
          setGenerating(generatingRef.current);
        } else if (frame.event === "session_snapshot") {
          const history = frame.data?.messages ?? [];
          const open = history.some(
            (message) =>
              message.role === "assistant" &&
              message.status !== "completed" &&
              message.status !== "interrupted" &&
              message.status !== "failed"
          );
          generatingRef.current = open;
          setGenerating(open);
          const latestAssistant = [...history].reverse().find((message) => message.role === "assistant");
          if (latestAssistant?.status === "failed" && latestAssistant.text) {
            setError(latestAssistant.text);
          }
        }
        setMessages((current) => applyDeskFrame(current, frame));
      };
      socket.onclose = () => {
        window.clearTimeout(openTimer);
        if (socketRef.current === connecting) {
          socketRef.current = null;
        }
        if (cancelled) return;
        setConnected(false);
        setReconnecting(true);
        setError(DESK_OFFLINE);
        const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      socketRef.current = null;
      socket?.close();
    };
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [messages, generating]);

  function onQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    const socket = socketRef.current;
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      setError(DESK_OFFLINE);
      return;
    }
    const sessionId = sessionIdRef.current;
    const payload = generatingRef.current
      ? { event: "interrupt_requested", data: { session_id: sessionId, new_input: text } }
      : { event: "user_message", data: { session_id: sessionId, text } };
    generatingRef.current = true;
    socket.send(JSON.stringify(payload));
    setMessages((current) => [
      ...current,
      {
        message_id: `local-${crypto.randomUUID()}`,
        role: "user",
        text,
        status: "completed",
      },
    ]);
    setGenerating(true);
    setError(null);
    setQuestion("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <header className="shrink-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">Desk knowledge</h2>
          {reconnecting ? (
            <p className="text-sm font-medium text-amber-800">Reconnecting…</p>
          ) : connected ? null : (
            <p className="text-sm font-medium text-slate-600">Connecting to the desk…</p>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          For Priya Nair’s patient coordinators. Answers come from HealthCore appointment,
          insurance, referral, and new-patient policies — never from a raw search dump.
        </p>
      </header>

      <section
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Ask a policy question. The answer appears as it is written.</p>
        ) : (
          <ol className="space-y-3">
            {messages.map((message) => (
              <li
                key={message.message_id}
                className={`rounded-md border px-3 py-2 ${
                  message.status === "failed"
                    ? "border-red-200 bg-red-50"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {message.role === "user" ? "You" : "Compliance assistant"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{message.text}</p>
                {message.status === "interrupted" ? (
                  <p className="mt-1 text-xs font-medium text-amber-800">Interrupted</p>
                ) : null}
                {message.status === "failed" ? (
                  <p className="mt-1 text-xs font-medium text-red-800">Could not answer</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {generating ? <Spinner label="Working on your question…" /> : null}
      </section>

      <form onSubmit={onSubmit} className="shrink-0 space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="desk-question" className="block text-sm font-medium text-slate-800">
          Question
        </label>
        <textarea
          id="desk-question"
          name="question"
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={onQuestionKeyDown}
          placeholder={EXAMPLES[0]}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <p className="text-xs text-slate-500">
          Example: {EXAMPLES[1]}. Press Enter to ask. Shift+Enter inserts a line break. Sending
          while a reply is still arriving stops that reply.
        </p>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {generating ? "Send" : connected ? "Ask" : "Connecting…"}
        </button>
      </form>
    </div>
  );
}

function readSessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}
