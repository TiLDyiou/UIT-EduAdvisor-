import FileUpload from "@/components/FileUpload";

export const metadata = {
  title: "Upload Bảng Điểm | UIT EduAdvisor",
  description: "Upload file HTML bảng điểm để xem lộ trình học tập",
};

export default function UploadPage() {
  return (
    <main className="page-container">
      <div className="page-header">
        <h1 className="page-title">📄 Upload Bảng Điểm</h1>
        <p className="page-description">
          Upload file HTML bảng điểm từ hệ thống DAA để xem lộ trình môn học và tiến độ học tập.
        </p>
      </div>

      <FileUpload />

      <div className="upload-instructions">
        <h3>📋 Hướng dẫn</h3>
        <ol>
          <li>Truy cập hệ thống <strong>DAA UIT</strong> và xuất bảng điểm dưới dạng HTML</li>
          <li>Kéo thả file HTML vào vùng upload bên trên hoặc click để chọn file</li>
          <li>Hệ thống sẽ tự động parse dữ liệu và hiển thị kết quả</li>
          <li>Sau khi upload thành công, bạn có thể xem <strong>Roadmap</strong> lộ trình môn học</li>
        </ol>
      </div>
    </main>
  );
}
