"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SchedulingAction {
  patientName: string;
  suggestedDate: string;
  suggestedTime: string;
  reason?: string | null;
}

interface SchedulingState {
  action: SchedulingAction;
  date: string;
  time: string;
  isSubmitting: boolean;
  result?: { success: boolean; message: string };
}

// Example queries that show the range: structured counts, a specific
// patient, semantic note search, and a human-in-the-loop action.
const EXAMPLE_QUERIES = [
  "How many patients have hypertension?",
  "Which patients have had a stroke?",
  "What do the clinical notes say about smoking?",
  "Summarize the health history of one of the patients",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [scheduling, setScheduling] = useState<SchedulingState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, scheduling]);

  // Parse scheduling action from message content
  const parseSchedulingAction = (content: string): { text: string; action?: SchedulingAction } => {
    const match = content.match(/<!-- SCHEDULING_ACTION (.+?) -->/);
    if (match) {
      try {
        const action = JSON.parse(match[1]) as SchedulingAction;
        const text = content.replace(/<!-- SCHEDULING_ACTION .+? -->/, "").trim();
        return { text, action };
      } catch {
        return { text: content };
      }
    }
    return { text: content };
  };

  const sendQuery = async (userMessage: string) => {
    if (!userMessage.trim() || isStreaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    setScheduling(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          messages: messages,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage += chunk;

        // Parse out scheduling action for display
        const { text } = parseSchedulingAction(assistantMessage);

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: text,
          };
          return newMessages;
        });
      }

      // Check for scheduling action after stream completes
      const { action } = parseSchedulingAction(assistantMessage);
      if (action) {
        setScheduling({
          action,
          date: action.suggestedDate,
          time: action.suggestedTime,
          isSubmitting: false,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(input.trim());
  };

  const handleScheduleSubmit = async () => {
    if (!scheduling) return;

    setScheduling((prev) => prev ? { ...prev, isSubmitting: true } : null);

    try {
      const dateTime = `${scheduling.date}T${scheduling.time}:00`;

      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: scheduling.action.patientName,
          dateTime,
          notes: scheduling.action.reason,
        }),
      });

      const result = await response.json();

      setScheduling((prev) =>
        prev
          ? {
              ...prev,
              isSubmitting: false,
              result: {
                success: response.ok,
                message: result.message || result.error,
              },
            }
          : null
      );

      if (response.ok) {
        // Add confirmation message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Appointment scheduled for **${scheduling.action.patientName}** on ${scheduling.date} at ${scheduling.time}.`,
          },
        ]);
      }
    } catch (error) {
      setScheduling((prev) =>
        prev
          ? {
              ...prev,
              isSubmitting: false,
              result: { success: false, message: "Failed to schedule appointment" },
            }
          : null
      );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-copilot-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-copilot-border bg-copilot-sidebar">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-copilot-accent flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">
            Medical Records Assistant
          </h1>
        </div>
        <Link
          href="/upload"
          className="px-4 py-2 text-sm bg-copilot-input hover:bg-copilot-border rounded-lg transition-colors text-copilot-text"
        >
          Upload Records
        </Link>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-copilot-muted">
            <div className="w-16 h-16 rounded-full bg-copilot-sidebar flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <p className="text-lg mb-2 text-copilot-text">
              Ask anything about your patient records
            </p>
            <p className="text-sm text-center max-w-lg">
              Patient data is split between structured fields (diagnoses,
              medications, labs) and free-text clinical notes. This assistant
              searches <strong className="text-copilot-text">both</strong> —
              exact counts and filters from the database, meaning-based search
              over the notes — and answers in plain English, grounded in the
              actual records. You can also schedule appointments.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuery(q)}
                  className="px-3 py-2 text-sm rounded-lg border border-copilot-border bg-copilot-sidebar text-copilot-text hover:border-copilot-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === "user"
                      ? "bg-copilot-accent text-white"
                      : "bg-copilot-sidebar text-copilot-text"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose-chat">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Scheduling Card */}
            {scheduling && !scheduling.result?.success && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-4 bg-copilot-sidebar border border-copilot-accent">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="w-5 h-5 text-copilot-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="font-semibold text-copilot-text">
                      Schedule Appointment
                    </span>
                  </div>

                  <p className="text-sm text-copilot-muted mb-3">
                    Patient: <strong className="text-copilot-text">{scheduling.action.patientName}</strong>
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-copilot-muted mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={scheduling.date}
                        onChange={(e) =>
                          setScheduling((prev) =>
                            prev ? { ...prev, date: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 bg-copilot-input border border-copilot-border rounded text-copilot-text text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-copilot-muted mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={scheduling.time}
                        onChange={(e) =>
                          setScheduling((prev) =>
                            prev ? { ...prev, time: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 bg-copilot-input border border-copilot-border rounded text-copilot-text text-sm"
                      />
                    </div>
                  </div>

                  {scheduling.result && !scheduling.result.success && (
                    <p className="text-sm text-red-400 mb-3">
                      {scheduling.result.message}
                    </p>
                  )}

                  <button
                    onClick={handleScheduleSubmit}
                    disabled={scheduling.isSubmitting}
                    className="w-full px-4 py-2 bg-copilot-accent text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {scheduling.isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Scheduling...
                      </span>
                    ) : (
                      "Confirm Appointment"
                    )}
                  </button>
                </div>
              </div>
            )}

            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="bg-copilot-sidebar rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-copilot-muted rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-copilot-muted rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="w-2 h-2 bg-copilot-muted rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-copilot-border p-4 bg-copilot-sidebar">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about patient records, or say 'schedule John Smith for next Tuesday'..."
              className="flex-1 px-4 py-3 bg-copilot-input border border-copilot-border rounded-lg text-copilot-text placeholder-copilot-muted focus:outline-none focus:border-copilot-accent"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="px-6 py-3 bg-copilot-accent text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
