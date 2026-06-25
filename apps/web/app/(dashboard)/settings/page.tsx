"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Check,
  Info,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Terminal,
  Settings,
  Trash2,
  Mail,
  Bell,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api";

type Me = {
  student_id: string;
  student_code_masked: string;
  has_credential: boolean;
  csrf_token: string;
};

type BotAccount = {
  platform: string;
  platform_user_id: string;
  linked_at: string;
  unlinked_at?: string | null;
};

type ReminderPrefs = {
  exam_reminder: boolean;
  deadline_reminder: boolean;
};

type LinkTokenResult = {
  token: string;
  expires_at: string;
  deep_link: string;
};

const PLATFORM_LABELS: Record<string, string> = {
  discord: "Discord Bot",
  mail: "Email nhận thông báo",
};

// Custom Discord SVG Icon component
const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
  </svg>
);
interface ToggleSwitchProps {
  checked: boolean; // Trạng thái bật/tắt của switch (nút gạt)
  onChange: () => void; // Hàm callback (hàm phản hồi) được gọi khi người dùng nhấn nút gạt
  disabled?: boolean; // Thuộc tính vô hiệu hóa tương tác khi đang xử lý tác vụ
  activeColorClass?: string; // Class CSS định nghĩa màu sắc khi nút ở trạng thái hoạt động (active)
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  activeColorClass = "bg-[#7aa2f7]",
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch" // Thuộc tính chỉ định vai trò của phần tử trong hỗ trợ tiếp cận (accessibility)
      aria-checked={checked} // Thuộc tính khai báo trạng thái được chọn đối với trình đọc màn hình
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7aa2f7]/55 focus:ring-offset-2 focus:ring-offset-[#1a1b26] ${
        checked ? activeColorClass : "bg-[#414868]/40"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#c0caf5] shadow-md ring-0 transition duration-300 ease-in-out ${
          checked ? "translate-x-5 bg-white" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Bot state
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPrefs | null>(
    null,
  );
  const [linkResult, setLinkResult] = useState<LinkTokenResult | null>(null);
  const [linkPlatform, setLinkPlatform] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailStep, setEmailStep] = useState<"email" | "otp">("email");
  const [otpInput, setOtpInput] = useState("");

  // Modals state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    title: string;
    desc: string;
    action: () => Promise<void>;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/me");
    if (!r.ok) {
      setMe(null);
      setBotAccounts([]);
      setReminderPrefs(null);
      setError(
        "Chưa đăng nhập hoặc phiên đã hết hạn. Hãy vào Onboarding để đăng nhập lại.",
      );
      return;
    }
    const m = await r.json();
    setMe(m);

    // Load bot accounts
    const br = await apiFetch("/api/v1/bot/accounts");
    if (br.ok) {
      setBotAccounts(await br.json());
    }
    // Load reminder prefs
    const rr = await apiFetch("/api/v1/bot/reminders");
    if (rr.ok) {
      setReminderPrefs(await rr.json());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  async function onDeleteAll() {
    if (!me) return;
    const r = await apiFetch("/api/v1/me/data", {
      method: "DELETE",
      headers: { "X-CSRF-Token": me.csrf_token },
    });
    if (!r.ok) {
      setError("Xóa tài khoản thất bại.");
      return;
    }
    window.location.href = "/onboarding";
  }

  // --- Bot/Email handlers ---

  async function onLinkBot(platform: string) {
    if (!me) return;
    if (platform === "mail") {
      setEmailInput("");
      setEmailStep("email");
      setOtpInput("");
      setError(null);
      setShowEmailModal(true);
      return;
    }
    setLinkResult(null);
    setLinkPlatform(platform);
    setLoading(true);
    try {
      const r = await apiFetch("/api/v1/bot/link-token", {
        method: "POST",
        headers: { "X-CSRF-Token": me.csrf_token },
        body: JSON.stringify({ platform }),
      });
      setLoading(false);
      if (!r.ok) {
        setError("Tạo mã liên kết bot thất bại.");
        setLinkPlatform(null);
        return;
      }
      const data = await r.json();
      setLinkResult(data);
      setShowLinkModal(true);
    } catch {
      setLoading(false);
      setError("Có lỗi hệ thống xảy ra khi liên kết bot.");
    }
  }

  async function onUnlinkBot(platform: string) {
    if (!me) return;
    setShowConfirmModal({
      title: `Hủy liên kết hoàn toàn ${PLATFORM_LABELS[platform] || platform}`,
      desc: `Bạn có chắc chắn muốn hủy liên kết hoàn toàn nhận thông báo qua ${PLATFORM_LABELS[platform] || platform}? Thao tác này sẽ xóa dữ liệu kết nối và yêu cầu xác thực lại nếu muốn kết nối lại.`,
      action: async () => {
        const r = await apiFetch(`/api/v1/bot/accounts/${platform}`, {
          method: "DELETE",
          headers: { "X-CSRF-Token": me.csrf_token },
        });
        if (!r.ok) {
          setError("Hủy liên kết thất bại.");
          return;
        }
        triggerSuccess(
          `Đã hủy liên kết hoàn toàn ${PLATFORM_LABELS[platform] || platform} thành công.`,
        );
        setShowConfirmModal(null);
        await load();
      },
    });
  }

  async function onReactivateBot(platform: string) {
    if (!me) return;
    setLoading(true);
    try {
      const r = await apiFetch(`/api/v1/bot/accounts/${platform}/reactivate`, {
        method: "POST",
        headers: { "X-CSRF-Token": me.csrf_token },
      });
      setLoading(false);
      if (!r.ok) {
        setError("Kích hoạt lại liên kết thất bại.");
        return;
      }
      triggerSuccess(
        `Đã kích hoạt lại liên kết ${PLATFORM_LABELS[platform] || platform} thành công.`,
      );
      await load();
    } catch {
      setLoading(false);
      setError("Có lỗi hệ thống xảy ra khi kích hoạt lại.");
    }
  }

  async function onDeactivateBot(platform: string) {
    if (!me) return;
    setLoading(true);
    try {
      const r = await apiFetch(`/api/v1/bot/accounts/${platform}/deactivate`, {
        method: "POST",
        headers: { "X-CSRF-Token": me.csrf_token },
      });
      setLoading(false);
      if (!r.ok) {
        setError("Tạm ngưng liên kết thất bại.");
        return;
      }
      triggerSuccess(
        `Đã tạm ngưng liên kết ${PLATFORM_LABELS[platform] || platform}.`,
      );
      await load();
    } catch {
      setLoading(false);
      setError("Có lỗi hệ thống xảy ra khi tạm ngưng liên kết.");
    }
  }

  async function onToggleReminder(
    field: "exam_reminder" | "deadline_reminder",
  ) {
    if (!me || !reminderPrefs) return;
    const updated = { ...reminderPrefs, [field]: !reminderPrefs[field] };
    const r = await apiFetch("/api/v1/bot/reminders", {
      method: "PUT",
      headers: { "X-CSRF-Token": me.csrf_token },
      body: JSON.stringify(updated),
    });
    if (!r.ok) {
      setError("Cập nhật nhắc nhở thất bại.");
      return;
    }
    setReminderPrefs(await r.json());
  }

  async function onRequestOtpSubmit() {
    if (!me || !emailInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch("/api/v1/bot/email/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrf_token,
        },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      setLoading(false);
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        setError(
          errData.detail === "invalid_email"
            ? "Định dạng email không hợp lệ."
            : "Yêu cầu gửi OTP thất bại. Vui lòng thử lại sau.",
        );
        return;
      }
      setEmailStep("otp");
      triggerSuccess("Mã OTP đã được gửi đến email của bạn.");
    } catch {
      setLoading(false);
      setError("Có lỗi hệ thống xảy ra khi gửi OTP.");
    }
  }

  async function onLinkEmailSubmit() {
    if (!me || !emailInput.trim() || !otpInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch("/api/v1/bot/email/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrf_token,
        },
        body: JSON.stringify({
          email: emailInput.trim(),
          otp: otpInput.trim(),
        }),
      });
      setLoading(false);
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        setError(
          errData.detail === "invalid_or_expired_otp"
            ? "Mã OTP không chính xác hoặc đã hết hạn."
            : "Xác nhận liên kết thất bại.",
        );
        return;
      }
      setShowEmailModal(false);
      setEmailStep("email");
      setOtpInput("");
      triggerSuccess("Đã cấu hình email nhận thông báo thành công!");
      await load();
    } catch {
      setLoading(false);
      setError("Có lỗi hệ thống xảy ra khi liên kết email.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-1 animate-in fade-in duration-500">
      {/* Header section with Tokyo Night colors (navigation links deleted) */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#414868]/40 pb-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-[#73daca]">
            UIT EduAdvisor // System Settings
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#7dcfff]">
            Cấu hình Hệ thống
          </h1>
        </div>
      </header>

      {/* Dynamic Alerts */}
      {error && (
        <div className="flex items-start gap-3 text-sm text-[#f7768e] bg-[#f7768e]/10 border border-[#f7768e]/35 rounded-xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
          <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold font-mono">Error: </span>
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 text-sm text-[#73daca] bg-[#73daca]/10 border border-[#73daca]/35 rounded-xl p-4 shadow-lg animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold font-mono">Success: </span>
            {success}
          </div>
        </div>
      )}

      {me ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Diagnostics Console & Standalone Danger Button (Profile Card Deleted) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Retro Terminal Diagnostics Widget */}
            <div className="relative overflow-hidden rounded-2xl border border-[#414868]/60 bg-[#1a1b26] p-5 shadow-2xl font-mono text-xs text-[#9aa5ce] animate-float-subtle">
              <div className="absolute top-3 right-4 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#f7768e] opacity-75"></span>
                <span className="h-2 w-2 rounded-full bg-[#e0af68] opacity-75"></span>
                <span className="h-2 w-2 rounded-full bg-[#9ece6a] opacity-75 animate-pulse"></span>
              </div>
              <div className="flex items-center gap-2 border-b border-[#414868]/45 pb-3 mb-4 text-[#565f89]">
                <Terminal className="h-4 w-4 text-[#7aa2f7]" />
                <span>diagnostics.sh</span>
              </div>

              <div className="space-y-2">
                <p className="text-[#565f89]">
                  # Initializing diagnostic check...
                </p>
                <div className="flex gap-2">
                  <span className="text-[#bb9af7]">edu-advisor@uit:~$</span>
                  <span className="text-[#c0caf5]">
                    systemctl status profile
                  </span>
                </div>
                <div className="pl-4 space-y-1 border-l border-[#414868]/30 ml-2 py-1">
                  <p>
                    ● User MSSV:{" "}
                    <span className="text-[#7dcfff] font-bold">
                      {me.student_code_masked}
                    </span>
                  </p>
                  <p>
                    ● Moodle Credentials:{" "}
                    <span
                      className={
                        me.has_credential
                          ? "text-[#73daca] font-semibold"
                          : "text-[#ff9e64] font-semibold"
                      }
                    >
                      {me.has_credential ? "STORED" : "MISSING"}
                    </span>
                  </p>
                  <p>
                    ● Discord Integration:{" "}
                    <span
                      className={
                        botAccounts.some((a) => a.platform === "discord")
                          ? "text-[#73daca] font-semibold"
                          : "text-[#565f89]"
                      }
                    >
                      {botAccounts.some((a) => a.platform === "discord")
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                  </p>
                  <p>
                    ● Email Alerts Status:{" "}
                    <span
                      className={
                        botAccounts.some((a) => a.platform === "mail")
                          ? "text-[#73daca] font-semibold"
                          : "text-[#565f89]"
                      }
                    >
                      {botAccounts.some((a) => a.platform === "mail")
                        ? "CONNECTED"
                        : "INACTIVE"}
                    </span>
                  </p>
                </div>
                <p className="text-[#565f89]">
                  $ system_status: ok{" "}
                  <span className="inline-block w-1.5 h-3.5 bg-[#73daca] align-middle animate-cursor-blink"></span>
                </p>
              </div>
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal({
                    title: "Xóa vĩnh viễn tất cả dữ liệu",
                    desc: "Xóa toàn bộ hồ sơ cá nhân, điểm số, lịch thi, cấu hình nhận thông báo của bạn khỏi máy chủ UIT EduAdvisor? Hành động này không thể hoàn tác.",
                    action: onDeleteAll,
                  });
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#f7768e] hover:bg-[#f7768e]/85 px-5 py-3.5 text-sm font-medium text-[#1a1b26] shadow-theme-xs transition"
              >
                <Trash2 className="h-5 w-5" />
                Xóa toàn bộ dữ liệu tài khoản
              </button>
            </div>
          </div>

          {/* Right Column: Notification Connections & Reminder preferences (AI summaries section deleted) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Integrations Area */}
            <div className="space-y-5">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#7dcfff]">
                  <Bell className="h-5 w-5 text-[#bb9af7]" />
                  Kênh nhận thông báo
                </h2>
                <p className="text-xs text-[#565f89] mt-1">
                  Đồng bộ để nhận thông báo thời khóa biểu, lịch thi và hạn nộp
                  bài tập tự động từ chatbot.
                </p>
              </div>

              {/* Grid of integration cards (perfectly balanced design, equal heights, aligned text) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* Discord card */}
                {(() => {
                  const discordAccount = botAccounts.find(
                    (a) => a.platform === "discord",
                  );
                  const isDiscordActive = !!(
                    discordAccount && !discordAccount.unlinked_at
                  );
                  return (
                    <article
                      className={`relative rounded-2xl border ${
                        discordAccount
                          ? isDiscordActive
                            ? "border-[#7aa2f7]/55 bg-[#24283b] animate-glow-blue"
                            : "border-[#414868]/40 bg-[#1a1b26]/80"
                          : "border-[#414868]/30 bg-[#1a1b26]/40"
                      } p-5 flex flex-col justify-between min-h-[220px] h-full transition-all hover:scale-[1.02] duration-300 hover:shadow-lg`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div
                            className={`p-2.5 rounded-xl ${isDiscordActive ? "bg-[#7aa2f7]/15 text-[#7aa2f7]" : "bg-[#414868]/30 text-[#9aa5ce]"}`}
                          >
                            <DiscordIcon className="h-6 w-6" />
                          </div>

                          {/* Toggle switch only shown when linked (discordAccount exists) */}
                          {discordAccount && (
                            <ToggleSwitch
                              checked={isDiscordActive}
                              onChange={() => {
                                if (isDiscordActive) {
                                  void onDeactivateBot("discord");
                                } else {
                                  void onReactivateBot("discord");
                                }
                              }}
                              disabled={loading}
                              activeColorClass="bg-[#7aa2f7]"
                            />
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-[#c0caf5]">
                            Discord Bot
                          </h3>
                          <p className="text-xs text-[#9aa5ce] mt-1.5 leading-relaxed">
                            Nhận nhắc nhở lịch học và deadline học tập trực tiếp
                            qua bot Discord.
                          </p>
                        </div>

                        {discordAccount ? (
                          <div
                            className={`flex items-center gap-1.5 text-[11px] font-mono ${
                              isDiscordActive
                                ? "text-[#7aa2f7] bg-[#7aa2f7]/10 border border-[#7aa2f7]/25"
                                : "text-[#565f89] bg-[#414868]/15 border border-[#414868]/30"
                            } px-2.5 py-1 rounded-md w-fit`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${isDiscordActive ? "bg-[#7aa2f7] animate-pulse" : "bg-[#565f89]"}`}
                            ></span>
                            <span
                              className="truncate max-w-[150px]"
                              title={discordAccount.platform_user_id}
                            >
                              {discordAccount.platform_user_id}{" "}
                              {isDiscordActive ? "" : "(Tắt)"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#565f89] bg-[#414868]/15 border border-[#414868]/30 px-2.5 py-1 rounded-md w-fit">
                            <span>Chưa liên kết</span>
                          </div>
                        )}
                      </div>

                      {/* Footer actions */}
                      <div className="mt-4 flex justify-between items-center border-t border-[#414868]/30 pt-3">
                        {discordAccount ? (
                          <>
                            <span className="text-[10px] text-[#565f89] font-mono">
                              Kích hoạt:{" "}
                              {discordAccount.linked_at.split("T")[0]}
                            </span>
                            <button
                              type="button"
                              onClick={() => void onUnlinkBot("discord")}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#f7768e]/10 hover:bg-[#f7768e]/20 border border-[#f7768e]/35 px-3 py-1.5 text-xs font-semibold text-[#f7768e] transition-all"
                            >
                              Hủy liên kết
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void onLinkBot("discord")}
                              className="inline-flex items-center justify-center rounded-lg bg-[#7aa2f7] hover:bg-[#7aa2f7]/85 px-3.5 py-1.5 text-xs font-bold text-[#1a1b26] transition-all shadow-theme-xs"
                            >
                              Liên kết
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })()}

                {/* Email card */}
                {(() => {
                  const emailAccount = botAccounts.find(
                    (a) => a.platform === "mail",
                  );
                  const isEmailActive = !!(
                    emailAccount && !emailAccount.unlinked_at
                  );
                  return (
                    <article
                      className={`relative rounded-2xl border ${
                        emailAccount
                          ? isEmailActive
                            ? "border-[#73daca]/55 bg-[#24283b] animate-glow-mint"
                            : "border-[#414868]/40 bg-[#1a1b26]/80"
                          : "border-[#414868]/30 bg-[#1a1b26]/40"
                      } p-5 flex flex-col justify-between min-h-[220px] h-full transition-all hover:scale-[1.02] duration-300 hover:shadow-lg`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div
                            className={`p-2.5 rounded-xl ${isEmailActive ? "bg-[#73daca]/15 text-[#73daca]" : "bg-[#414868]/30 text-[#9aa5ce]"}`}
                          >
                            <Mail className="h-6 w-6" />
                          </div>

                          {/* Toggle switch only shown when linked (emailAccount exists) */}
                          {emailAccount && (
                            <ToggleSwitch
                              checked={isEmailActive}
                              onChange={() => {
                                if (isEmailActive) {
                                  void onDeactivateBot("mail");
                                } else {
                                  void onReactivateBot("mail");
                                }
                              }}
                              disabled={loading}
                              activeColorClass="bg-[#73daca]"
                            />
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-[#c0caf5]">
                            Hòm thư thông báo
                          </h3>
                          <p className="text-xs text-[#9aa5ce] mt-1.5 leading-relaxed">
                            Nhận thông báo nhắc nhở lịch thi và thời hạn nộp bài
                            tập gửi đến hòm thư cá nhân.
                          </p>
                        </div>

                        {emailAccount ? (
                          <div
                            className={`flex items-center gap-1.5 text-[11px] font-mono ${
                              isEmailActive
                                ? "text-[#73daca] bg-[#73daca]/10 border border-[#73daca]/25"
                                : "text-[#565f89] bg-[#414868]/15 border border-[#414868]/30"
                            } px-2.5 py-1 rounded-md w-fit`}
                          >
                            <span
                              className="truncate max-w-[150px]"
                              title={emailAccount.platform_user_id}
                            >
                              {emailAccount.platform_user_id}{" "}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#565f89] bg-[#414868]/15 border border-[#414868]/30 px-2.5 py-1 rounded-md w-fit">
                            <span>Chưa liên kết</span>
                          </div>
                        )}
                      </div>

                      {/* Footer actions */}
                      <div className="mt-4 flex justify-between items-center border-t border-[#414868]/30 pt-3">
                        {emailAccount ? (
                          <>
                            <span className="text-[10px] text-[#565f89] font-mono">
                              Kích hoạt: {emailAccount.linked_at.split("T")[0]}
                            </span>
                            <button
                              type="button"
                              onClick={() => void onUnlinkBot("mail")}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#f7768e]/10 hover:bg-[#f7768e]/20 border border-[#f7768e]/35 px-3 py-1.5 text-xs font-semibold text-[#f7768e] transition-all"
                            >
                              Hủy liên kết
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void onLinkBot("mail")}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#73daca] hover:bg-[#73daca]/85 px-3.5 py-1.5 text-xs font-bold text-[#1a1b26] transition-all shadow-theme-xs"
                            >
                              Liên kết
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })()}
              </div>

              {/* Preference Toggles */}
              {reminderPrefs ? (
                <div className="rounded-2xl border border-[#414868]/40 bg-[#1a1b26] p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-semibold text-[#7dcfff] flex items-center gap-2">
                    <Settings className="h-4 w-4 text-[#e0af68]" />
                    Cấu hình tần suất báo thức
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Exam toggler */}
                    <div
                      onClick={() => void onToggleReminder("exam_reminder")}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                        reminderPrefs.exam_reminder
                          ? "bg-[#24283b] border-[#73daca]/35 hover:border-[#73daca]/60"
                          : "bg-[#1a1b26] border-[#414868]/40 hover:bg-[#24283b]/30"
                      }`}
                    >
                      <div className="pt-0.5">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            reminderPrefs.exam_reminder
                              ? "bg-[#73daca] border-[#73daca] text-[#1a1b26]"
                              : "border-[#414868] text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#c0caf5]">
                          Nhắc lịch thi
                        </p>
                        <p className="text-[11px] text-[#565f89] mt-1">
                          Gửi cảnh báo trước thời gian thi 36h
                        </p>
                      </div>
                    </div>

                    {/* Deadline toggler */}
                    <div
                      onClick={() => void onToggleReminder("deadline_reminder")}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                        reminderPrefs.deadline_reminder
                          ? "bg-[#24283b] border-[#73daca]/35 hover:border-[#73daca]/60"
                          : "bg-[#1a1b26] border-[#414868]/40 hover:bg-[#24283b]/30"
                      }`}
                    >
                      <div className="pt-0.5">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            reminderPrefs.deadline_reminder
                              ? "bg-[#73daca] border-[#73daca] text-[#1a1b26]"
                              : "border-[#414868] text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#c0caf5]">
                          Nhắc deadline bài tập
                        </p>
                        <p className="text-[11px] text-[#565f89] mt-1">
                          Gửi cảnh báo trước khi hết hạn nộp 18h
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#73daca] mx-auto mb-4" />
          <p className="text-[#9aa5ce] font-mono text-xs">
            Loading profile settings...
          </p>
        </div>
      )}

      {/* ===== EMAIL LINK MODAL ===== */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div
            onClick={() => {
              if (!loading) {
                setShowEmailModal(false);
                setEmailStep("email");
                setOtpInput("");
                setError(null);
              }
            }}
            className="fixed inset-0 h-full w-full bg-[#131318]/70 backdrop-blur-md transition-opacity duration-300"
          />

          <div className="relative w-full max-w-[500px] rounded-2xl bg-[#1a1b26] border border-[#414868]/80 p-6 sm:p-8 shadow-2xl text-[#c0caf5] transform transition-all duration-300 scale-100 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowEmailModal(false);
                setEmailStep("email");
                setOtpInput("");
                setError(null);
              }}
              disabled={loading}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[#24283b] text-[#9aa5ce] border border-[#414868]/40 transition-colors hover:text-[#7dcfff] hover:bg-[#414868]/30 disabled:opacity-50"
            >
              <span className="text-lg font-mono">×</span>
            </button>

            <div>
              <h4 className="text-lg font-bold text-[#7dcfff] flex items-center gap-2 border-b border-[#414868]/40 pb-3 mb-4">
                <Mail className="h-5 w-5 text-[#73daca]" />
                {emailStep === "email"
                  ? "Liên kết Email nhận thông báo"
                  : "Xác thực mã OTP"}
              </h4>

              <p className="text-xs leading-relaxed text-[#9aa5ce] mb-6">
                {emailStep === "email"
                  ? "Nhập địa chỉ email cá nhân để nhận nhắc nhở tự động trước lịch học và thời hạn nộp bài tập."
                  : "Mã OTP gồm 6 chữ số đã được gửi tới hòm thư của bạn. Vui lòng nhập mã để kích hoạt kênh."}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-mono text-[#bb9af7]">
                    Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    disabled={emailStep === "otp" || loading}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#414868] bg-[#1a1b26] px-4 py-2.5 text-sm text-[#c0caf5] placeholder:text-[#565f89] focus:border-[#73daca] focus:ring-1 focus:ring-[#73daca]/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {emailStep === "otp" && (
                  <div className="space-y-3 animate-in slide-in-from-bottom duration-300">
                    <label className="block text-xs font-mono text-center text-[#e0af68]">
                      Mã OTP (gồm 6 số)
                    </label>
                    <div className="flex justify-center gap-x-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const value = otpInput[index] || "";
                        return (
                          <input
                            key={index}
                            id={`otp-input-${index}`}
                            type="text"
                            maxLength={1}
                            disabled={loading}
                            className="block w-11 h-12 text-center bg-[#24283b] border border-[#414868] rounded-lg text-lg font-bold text-[#c0caf5] focus:border-[#73daca] focus:ring-1 focus:ring-[#73daca]/30 focus:outline-none disabled:opacity-50 transition-colors"
                            placeholder="-"
                            value={value}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pasted = e.clipboardData
                                .getData("text")
                                .replace(/\D/g, "")
                                .slice(0, 6);
                              if (pasted) {
                                setOtpInput(pasted);
                                const focusIndex = Math.min(pasted.length, 5);
                                document
                                  .getElementById(`otp-input-${focusIndex}`)
                                  ?.focus();
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              const newOtp = otpInput.split("");
                              while (newOtp.length < 6) newOtp.push("");
                              newOtp[index] = val.slice(-1);
                              setOtpInput(newOtp.join("").slice(0, 6));
                              if (val && index < 5) {
                                document
                                  .getElementById(`otp-input-${index + 1}`)
                                  ?.focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Backspace" &&
                                !value &&
                                index > 0
                              ) {
                                document
                                  .getElementById(`otp-input-${index - 1}`)
                                  ?.focus();
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <p className="mt-4 text-xs text-[#f7768e] font-mono">
                  Error: {error}
                </p>
              )}

              <div className="mt-8 flex w-full gap-3 sm:justify-end">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailStep("email");
                    setOtpInput("");
                    setError(null);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#24283b] hover:bg-[#414868]/40 border border-[#414868]/60 px-5 py-3.5 text-sm font-medium text-[#c0caf5] shadow-theme-xs transition disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                {emailStep === "email" ? (
                  <button
                    type="button"
                    onClick={onRequestOtpSubmit}
                    disabled={!emailInput.trim() || loading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#73daca] hover:bg-[#73daca]/85 px-5 py-3.5 text-sm font-medium text-[#1a1b26] shadow-theme-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading && (
                      <Loader2 className="h-4 w-4 animate-spin text-[#1a1b26]" />
                    )}
                    {loading ? "Đang gửi..." : "Gửi OTP"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onLinkEmailSubmit}
                    disabled={otpInput.length < 6 || loading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#73daca] hover:bg-[#73daca]/85 px-5 py-3.5 text-sm font-medium text-[#1a1b26] shadow-theme-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading && (
                      <Loader2 className="h-4 w-4 animate-spin text-[#1a1b26]" />
                    )}
                    {loading ? "Đang liên kết..." : "Xác nhận liên kết"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== LINKING ACTION DETAILS MODAL ===== */}
      {showLinkModal && linkPlatform && linkResult && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div
            onClick={() => {
              setShowLinkModal(false);
              setLinkResult(null);
              setLinkPlatform(null);
            }}
            className="fixed inset-0 h-full w-full bg-[#131318]/70 backdrop-blur-md transition-opacity duration-300"
          />

          <div className="relative w-full max-w-[520px] rounded-2xl bg-[#1a1b26] border border-[#414868]/80 p-6 sm:p-8 shadow-2xl text-[#c0caf5] transform transition-all duration-300 scale-100 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowLinkModal(false);
                setLinkResult(null);
                setLinkPlatform(null);
              }}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[#24283b] text-[#9aa5ce] border border-[#414868]/40 transition-colors hover:text-[#7dcfff] hover:bg-[#414868]/30"
            >
              <span className="text-lg font-mono">×</span>
            </button>

            <div>
              <h4 className="text-lg font-bold text-[#7dcfff] flex items-center gap-2 border-b border-[#414868]/40 pb-3 mb-4">
                <DiscordIcon className="h-5 w-5 text-[#7aa2f7]" />
                Liên kết {PLATFORM_LABELS[linkPlatform] || linkPlatform}
              </h4>
              <p className="text-xs leading-relaxed text-[#9aa5ce] mb-6">
                Nhập token dưới đây vào khung chat của Bot hoặc click chọn liên
                kết nhanh để kích hoạt kết nối.
              </p>

              <div className="space-y-4">
                <div className="rounded-xl bg-[#24283b]/60 p-4 border border-[#414868]/50 space-y-2.5">
                  <p className="text-xs font-mono font-semibold text-[#73daca]">
                    Cách 1: Gửi mã kích hoạt qua tin nhắn bot
                  </p>
                  <p className="text-[11px] text-[#9aa5ce] leading-relaxed">
                    Nhập câu lệnh sau vào khung chat riêng của Bot:
                  </p>
                  <div className="flex items-center justify-between rounded-lg bg-[#1a1b26] border border-[#414868]/85 p-3 font-mono text-xs text-[#73daca]">
                    <span className="break-all font-semibold select-all text-sm">
                      {linkResult.token}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(linkResult.token, "token")}
                      className="p-1.5 rounded bg-[#24283b] border border-[#414868]/60 text-[#9aa5ce] hover:text-[#7dcfff] hover:bg-[#414868]/40 transition-colors ml-2 shrink-0"
                    >
                      {copiedText === "token" ? (
                        <Check className="h-4 w-4 text-[#9ece6a] animate-in zoom-in-50" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-[#24283b]/60 p-4 border border-[#414868]/50 space-y-2.5">
                  <p className="text-xs font-mono font-semibold text-[#7aa2f7]">
                    Cách 2: Sử dụng liên kết kích hoạt nhanh
                  </p>
                  <p className="text-[11px] text-[#9aa5ce] leading-relaxed">
                    Nhấp vào nút dưới để tự động chuyển tiếp và điền mã kích
                    hoạt trên ứng dụng Bot:
                  </p>
                  <div className="flex items-center justify-between rounded-lg bg-[#1a1b26] border border-[#414868]/85 p-3">
                    <a
                      href={linkResult.deep_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs text-[#7aa2f7] hover:underline inline-flex items-center gap-1.5 font-mono font-semibold"
                    >
                      Mở liên kết nhanh
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(linkResult.deep_link, "link")}
                      className="p-1.5 rounded bg-[#24283b] border border-[#414868]/60 text-[#9aa5ce] hover:text-[#7dcfff] hover:bg-[#414868]/40 transition-colors ml-2 shrink-0"
                    >
                      {copiedText === "link" ? (
                        <Check className="h-4 w-4 text-[#9ece6a] animate-in zoom-in-50" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg bg-[#ff9e64]/10 border border-[#ff9e64]/25 p-3.5 text-[11px] text-[#ff9e64]/95 leading-relaxed font-mono">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Mã liên kết này chỉ có hiệu lực trong vòng 10 phút. Hết hạn
                    lúc:{" "}
                    <b className="text-[#ff9e64]">
                      {new Date(linkResult.expires_at).toLocaleTimeString()}
                    </b>
                  </p>
                </div>
              </div>

              <div className="mt-8 flex w-full justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkModal(false);
                    setLinkResult(null);
                    setLinkPlatform(null);
                    void load();
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#73daca] hover:bg-[#73daca]/85 px-5 py-3.5 text-sm font-medium text-[#1a1b26] shadow-theme-xs transition"
                >
                  Hoàn thành
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ACTIONS CONFIRMATION MODAL ===== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div
            onClick={() => setShowConfirmModal(null)}
            className="fixed inset-0 h-full w-full bg-[#131318]/70 backdrop-blur-md transition-opacity duration-300"
          />

          <div className="relative w-full max-w-[480px] rounded-2xl bg-[#1a1b26] border border-[#414868]/80 p-6 sm:p-8 shadow-2xl text-[#c0caf5] text-center transform transition-all duration-300 scale-100 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowConfirmModal(null)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[#24283b] text-[#9aa5ce] border border-[#414868]/40 transition-colors hover:text-[#7dcfff] hover:bg-[#414868]/30"
            >
              <span className="text-lg font-mono">×</span>
            </button>

            <div className="flex flex-col items-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#f7768e]/10 border border-[#f7768e]/35 text-[#f7768e]">
                <AlertTriangle className="h-8 w-8 animate-bounce" />
              </div>

              <h4 className="text-base font-bold text-[#7dcfff] mb-2">
                {showConfirmModal.title}
              </h4>
              <p className="text-xs leading-relaxed text-[#9aa5ce] mb-8 max-w-sm">
                {showConfirmModal.desc}
              </p>

              <div className="flex w-full gap-3 justify-center">
                <button
                  onClick={() => setShowConfirmModal(null)}
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#24283b] hover:bg-[#414868]/40 border border-[#414868]/60 px-5 py-3.5 text-sm font-medium text-[#c0caf5] shadow-theme-xs transition"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => void showConfirmModal.action()}
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#f7768e] hover:bg-[#f7768e]/85 px-5 py-3.5 text-sm font-medium text-[#1a1b26] shadow-theme-xs transition"
                >
                  Xác nhận thực hiện
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
