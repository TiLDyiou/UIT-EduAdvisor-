"use client";

/**
 * FileUpload.tsx — Component Drag & Drop upload transcript.
 *
 * Features:
 * - Drag & Drop zone với visual feedback
 * - File validation (chỉ nhận .html)
 * - Simulated progress bar
 * - Success/Error state display
 */

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { uploadTranscript, type TranscriptUploadResponse } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

type UploadState = "idle" | "selected" | "dragging" | "uploading" | "success" | "error";

interface FileUploadProps {
  onUploadSuccess?: (data: TranscriptUploadResponse) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const { login } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [result, setResult] = useState<TranscriptUploadResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Drag & Drop handlers ---

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState("dragging");
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState("idle");
  };

  // --- File processing ---

  const handleFileChosen = (file: File) => {
    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      setErrorMsg("Chỉ chấp nhận file HTML (.html). Vui lòng chọn file khác.");
      setState("error");
      return;
    }
    setSelectedFile(file);
    setFileName(file.name);
    setState("selected");
  };

  const processFile = async () => {
    if (!selectedFile) return;

    setState("uploading");
    setProgress(0);
    setErrorMsg("");

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const response = await uploadTranscript(selectedFile);
      clearInterval(progressInterval);
      setProgress(100);
      setResult(response);
      setState("success");

      if (response.student) {
        login({ mssv: response.student.mssv, ho_ten: response.student.ho_ten });
      }

      if (onUploadSuccess) {
        onUploadSuccess(response);
      }

      setTimeout(() => {
        router.push(`/dashboard?mssv=${response.student?.mssv}`);
      }, 1500);
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      setErrorMsg(err instanceof Error ? err.message : "Lỗi không xác định khi upload file.");
      setState("error");
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (state === "uploading" || state === "success") return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileChosen(files[0]);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileChosen(files[0]);
    }
    // Đặt lại value để chọn được cùng file nếu bị huỷ
    if (e.target) {
      e.target.value = "";
    }
  };



  const handleReset = () => {
    setState("idle");
    setProgress(0);
    setFileName("");
    setSelectedFile(null);
    setErrorMsg("");
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --- Render ---

  return (
    <div className="upload-container">
      {/* Drop Zone */}
      <div
        className={`drop-zone ${state === "dragging" ? "drop-zone--active" : ""} ${state === "uploading" ? "drop-zone--uploading" : ""} ${state === "success" ? "drop-zone--success" : ""} ${state === "error" ? "drop-zone--error" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          if (state === "uploading" || state === "success") return;
          // Click vào vùng dropzone sẽ kích hoạt input file
          if (!e.defaultPrevented) fileInputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-label="Kéo thả file HTML hoặc click để chọn"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm"
          onChange={handleFileSelect}
          onClick={(e) => e.stopPropagation()} // Ngăn chặn nổi bọt sự kiện lên dropzone
          className="hidden-input"
          id="file-upload-input"
        />

        {/* Idle State */}
        {state === "idle" && (
          <div className="drop-zone__content">
            <div className="drop-zone__icon">
              <Upload size={48} strokeWidth={1.5} />
            </div>
            <h3 className="drop-zone__title">Kéo thả file HTML vào đây</h3>
            <p className="drop-zone__subtitle">
              hoặc <span className="drop-zone__link">click để chọn file</span>
            </p>
            <p className="drop-zone__hint">Chấp nhận file .html (transcript điểm)</p>
          </div>
        )}

        {/* Selected State */}
        {state === "selected" && (
          <div className="drop-zone__content">
            <div className="drop-zone__icon">
              <FileText size={48} strokeWidth={1.5} color="#38bdf8" />
            </div>
            <h3 className="drop-zone__title">Đã chọn file</h3>
            <p className="drop-zone__subtitle" style={{ color: "#38bdf8", fontWeight: "bold" }}>{fileName}</p>
            <div className="upload-actions" style={{ marginTop: "16px", display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={(e) => { e.stopPropagation(); processFile(); }}
                className="btn btn--primary"
              >
                Nhấn để Upload
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="btn btn--secondary"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Dragging State */}
        {state === "dragging" && (
          <div className="drop-zone__content">
            <div className="drop-zone__icon drop-zone__icon--bounce">
              <FileText size={48} strokeWidth={1.5} />
            </div>
            <h3 className="drop-zone__title">Thả file tại đây!</h3>
          </div>
        )}

        {/* Uploading State */}
        {state === "uploading" && (
          <div className="drop-zone__content">
            <div className="drop-zone__icon drop-zone__icon--spin">
              <Loader2 size={48} strokeWidth={1.5} />
            </div>
            <h3 className="drop-zone__title">Đang xử lý...</h3>
            <p className="drop-zone__subtitle">{fileName}</p>
            <div className="progress-bar">
              <div
                className="progress-bar__fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="progress-bar__text">{Math.round(progress)}%</p>
          </div>
        )}

        {/* Success State */}
        {state === "success" && result && (
          <div className="drop-zone__content">
            <div className="drop-zone__icon drop-zone__icon--success">
              <CheckCircle2 size={48} strokeWidth={1.5} />
            </div>
            <h3 className="drop-zone__title">Upload thành công!</h3>
            <div className="upload-result">
              <p><strong>Sinh viên:</strong> {result.student?.ho_ten}</p>
              <p><strong>MSSV:</strong> {result.student?.mssv}</p>
              <p><strong>Số môn học:</strong> {result.total_grades}</p>
              {result.student?.current_gpa && (
                <p><strong>GPA:</strong> {result.student.current_gpa.toFixed(2)}</p>
              )}
            </div>
            <div className="upload-actions">
              <a href={`/dashboard?mssv=${result.student?.mssv}`} className="btn btn--primary">
                Xem Roadmap →
              </a>
              <button onClick={handleReset} className="btn btn--secondary">
                Upload file khác
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="drop-zone__content">
            <div className="drop-zone__icon drop-zone__icon--error">
              <XCircle size={48} strokeWidth={1.5} />
            </div>
            <h3 className="drop-zone__title">Lỗi xử lý file</h3>
            <p className="drop-zone__error-msg">{errorMsg}</p>
            <button onClick={handleReset} className="btn btn--secondary">
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
