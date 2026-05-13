"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);

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

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: assistantMessage,
          };
          return newMessages;
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
            <p className="text-lg mb-2">Ask about medical records</p>
            <p className="text-sm text-center max-w-md">
              Query patient information, lab results, medications, diagnoses,
              and more from uploaded FHIR records.
            </p>
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
              placeholder="Ask about patient records, medications, diagnoses..."
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
