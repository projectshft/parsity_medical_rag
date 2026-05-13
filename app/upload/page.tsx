"use client";

import { useState, useRef } from "react";
import Link from "next/link";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const jsonFiles = selectedFiles.filter(
      (f) => f.type === "application/json" || f.name.endsWith(".json")
    );
    setFiles((prev) => [...prev, ...jsonFiles]);
    setUploadStatus({ type: null, message: "" });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const jsonFiles = droppedFiles.filter(
      (f) => f.type === "application/json" || f.name.endsWith(".json")
    );
    setFiles((prev) => [...prev, ...jsonFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setProgress(0);
    setUploadStatus({ type: null, message: "" });

    try {
      const fileContents = await Promise.all(
        files.map(async (file) => {
          const text = await file.text();
          return { name: file.name, content: JSON.parse(text) };
        })
      );

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: fileContents }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Upload failed");

      setUploadStatus({
        type: "success",
        message: `Successfully processed ${result.chunksCreated} chunks from ${result.recordsProcessed} records`,
      });
      setFiles([]);
      setProgress(100);
    } catch (error) {
      setUploadStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-copilot-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-copilot-border bg-copilot-sidebar">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-copilot-input rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-copilot-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-white">
            Upload Medical Records
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        {/* Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-copilot-border rounded-xl p-12 text-center cursor-pointer hover:border-copilot-accent transition-colors bg-copilot-sidebar"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-copilot-input flex items-center justify-center">
            <svg
              className="w-8 h-8 text-copilot-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-copilot-text mb-2">
            Drop FHIR JSON files here or click to browse
          </p>
          <p className="text-sm text-copilot-muted">
            Supports FHIR R4 Bundle and individual resources
          </p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-copilot-text mb-3">
              Selected Files ({files.length})
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-copilot-sidebar rounded-lg border border-copilot-border"
                >
                  <div className="flex items-center gap-3">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="text-copilot-text text-sm truncate max-w-xs">
                      {file.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 hover:bg-copilot-input rounded transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-copilot-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isUploading && (
          <div className="mt-6">
            <div className="h-2 bg-copilot-input rounded-full overflow-hidden">
              <div
                className="h-full bg-copilot-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-copilot-muted mt-2 text-center">
              Processing records...
            </p>
          </div>
        )}

        {/* Status Message */}
        {uploadStatus.type && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              uploadStatus.type === "success"
                ? "bg-green-900/30 border border-green-700 text-green-400"
                : "bg-red-900/30 border border-red-700 text-red-400"
            }`}
          >
            {uploadStatus.message}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
          className="mt-6 w-full py-3 bg-copilot-accent text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? "Processing..." : `Upload ${files.length} File(s)`}
        </button>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-copilot-sidebar rounded-lg border border-copilot-border">
          <h3 className="text-sm font-medium text-copilot-text mb-2">
            Supported FHIR Resources
          </h3>
          <ul className="text-sm text-copilot-muted space-y-1">
            <li>- Patient demographics and identifiers</li>
            <li>- Conditions and diagnoses</li>
            <li>- Observations and lab results</li>
            <li>- Medications and prescriptions</li>
            <li>- Procedures and encounters</li>
            <li>- Immunizations and allergies</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
