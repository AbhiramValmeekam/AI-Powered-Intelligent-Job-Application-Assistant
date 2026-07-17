"use client";

import { useState, useRef } from "react";
import * as api from "@/lib/api";

export function ResumeUpload({
  value,
  onChange,
  label = "Resume",
  placeholder = "Upload your resume (PDF/DOCX) — we'll read it for you.",
}: {
  value: string;
  onChange: (text: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErr(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const r = await api.resume.parse(file);
      onChange(r.text || "");
    } catch (e: any) {
      setErr(e.message || "Could not read the file.");
      setFileName(null);
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="resume-upload">
      <label className="field-label">{label}</label>
      <div className="resume-upload__row">
        <button
          type="button"
          className="resume-upload__btn"
          onClick={() => inputRef.current?.click()}
          disabled={parsing}
        >
          {parsing ? "Reading…" : fileName ? "Replace file" : "Upload resume"}
        </button>
        {fileName && <span className="resume-upload__name">📄 {fileName}</span>}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <textarea
        style={{ width: "100%", background: "transparent", color: "inherit", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "0.7rem", font: "inherit" }}
        rows={5}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {err && <p className="resume-upload__err">{err}</p>}
      <p className="resume-upload__hint">PDF or DOCX. Or paste text above if you prefer.</p>
    </div>
  );
}
