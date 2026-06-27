import re

with open("apps/web/app/onboarding/page.tsx", "r") as f:
    content = f.read()

# Chunk 1: Add state and modify loadCaptcha
chunk1_old = """  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);

  const [rightPanelView, setRightPanelView] = useState<
    "default" | "privacy" | "sync"
  >("default");

  const loadCaptcha = useCallback(async () => {
    setError(null);
    const r = await apiFetch("/api/v1/onboarding/daa-captcha");
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(
        typeof body?.detail === "string"
          ? body.detail
          : "Không tải được captcha",
      );
      return;
    }
    setCaptcha(await r.json());
  }, []);"""

chunk1_new = """  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);

  const [rightPanelView, setRightPanelView] = useState<
    "default" | "privacy" | "sync"
  >("default");

  const loadCaptcha = useCallback(async () => {
    setError(null);
    setIsLoadingCaptcha(true);
    try {
      const r = await apiFetch("/api/v1/onboarding/daa-captcha");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : "Không tải được captcha",
        );
        return;
      }
      setCaptcha(await r.json());
    } finally {
      setIsLoadingCaptcha(false);
    }
  }, []);"""

content = content.replace(chunk1_old, chunk1_new)

# Chunk 2: Remove useEffect
chunk2_old = """  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);"""

chunk2_new = """  // User must explicitly request captcha to avoid rate limits"""

content = content.replace(chunk2_old, chunk2_new)

# Chunk 3: Update UI
chunk3_old = """                <button
                  type="button"
                  onClick={() => void loadCaptcha()}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
                  disabled={busy || !!jobId}
                >
                  <RefreshCw className="w-3 h-3" />
                  Làm mới
                </button>
              </div>

              {captcha ? (
                <div className="space-y-4">
                  {imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc}
                      alt="Captcha"
                      className="h-[4.5rem] w-full object-cover rounded-xl border border-tokyo-border/80 bg-white"
                    />
                  ) : null}
                  <input
                    className="w-full rounded-xl border border-tokyo-border/80 bg-tokyo-storm px-4 py-3 text-sm outline-none ring-offset-slate-950 transition-all focus:border-cyan-500 focus:bg-tokyo-storm focus:ring-2 focus:ring-cyan-500/20 placeholder:text-tokyo-comment"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder={captcha.question}
                    required
                    disabled={busy || !!jobId}
                  />
                </div>
              ) : (
                <div className="h-[4.5rem] rounded-xl border border-tokyo-border border-dashed flex items-center justify-center bg-tokyo-storm/20">
                  <Activity className="w-5 h-5 animate-pulse text-tokyo-comment" />
                </div>
              )}"""

chunk3_new = """                <button
                  type="button"
                  onClick={() => void loadCaptcha()}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
                  disabled={busy || !!jobId || isLoadingCaptcha}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>

              {captcha ? (
                <div className="space-y-4">
                  {imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc}
                      alt="Captcha"
                      className="h-[4.5rem] w-full object-cover rounded-xl border border-tokyo-border/80 bg-white"
                    />
                  ) : null}
                  <input
                    className="w-full rounded-xl border border-tokyo-border/80 bg-tokyo-storm px-4 py-3 text-sm outline-none ring-offset-slate-950 transition-all focus:border-cyan-500 focus:bg-tokyo-storm focus:ring-2 focus:ring-cyan-500/20 placeholder:text-tokyo-comment"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder={captcha.question}
                    required
                    disabled={busy || !!jobId}
                  />
                </div>
              ) : isLoadingCaptcha ? (
                <div className="h-[4.5rem] rounded-xl border border-tokyo-border border-dashed flex items-center justify-center bg-tokyo-storm/20">
                  <Activity className="w-5 h-5 animate-pulse text-tokyo-cyan" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadCaptcha()}
                  className="h-[4.5rem] w-full rounded-xl border border-tokyo-border border-dashed flex items-center justify-center bg-tokyo-storm/20 hover:bg-tokyo-storm/40 transition-colors text-tokyo-comment hover:text-tokyo-fg group"
                  disabled={busy || !!jobId}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="w-4 h-4 group-hover:scale-110 transition-transform text-cyan-400" />
                    Bấm để tải mã xác nhận
                  </span>
                </button>
              )}"""

content = content.replace(chunk3_old, chunk3_new)

with open("apps/web/app/onboarding/page.tsx", "w") as f:
    f.write(content)
