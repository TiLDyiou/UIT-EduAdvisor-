import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero__badge">🚀 MVP v0.1.0</div>
        <h1 className="hero__title">
          <span className="hero__highlight">UIT EduAdvisor</span>
          <br />
          Lộ trình học tập thông minh
        </h1>
        <p className="hero__description">
          Upload bảng điểm HTML, hệ thống tự động phân tích và hiển thị
          <strong> Roadmap lộ trình môn học</strong> giúp bạn theo dõi tiến độ học tập.
        </p>

        <div className="hero__actions">
          <Link href="/upload" className="btn btn--primary btn--lg">
            📄 Upload Bảng Điểm
          </Link>
          <Link href="/dashboard" className="btn btn--secondary btn--lg">
            🗺️ Xem Roadmap
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="feature-card">
          <h3 className="feature-card__title">Không cần tạo tài khoản</h3>
          <p className="feature-card__desc">
            Upload file HTML từ DAA, hệ thống tự động trích xuất dữ liệu điểm.
          </p>
        </div>
        <div className="feature-card">
          <h3 className="feature-card__title">Roadmap Visual</h3>
          <p className="feature-card__desc">
            Xem lộ trình môn học dạng cây, hiển thị theo trạng thái từng môn.
          </p>
        </div>
        <div className="feature-card">
          <h3 className="feature-card__title">Theo dõi GPA</h3>
          <p className="feature-card__desc">
            Tự động tính GPA và hiển thị thống kê chi tiết tiến độ học tập.
          </p>
        </div>
      </section>
    </main>
  );
}
