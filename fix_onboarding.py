import re
import os

with open("apps/web/app/onboarding/page.tsx", "r") as f:
    content = f.read()

# Replace hardcoded dark-mode specific stuff with responsive tokyo theme

replacements = [
    # SyncGraphic
    (r'text-slate-800 dark:text-white', r'text-tokyo-fg'),
    (r'text-slate-600 dark:text-slate-400', r'text-tokyo-comment'),
    (r'bg-white/50 dark:bg-slate-900/50', r'bg-tokyo-panel/50'),
    (r'border-slate-200 dark:border-slate-800', r'border-tokyo-border'),
    (r'bg-slate-800/80', r'bg-tokyo-storm/80'),
    (r'border-slate-700/60', r'border-tokyo-border/60'),
    (r'bg-slate-600/30', r'bg-tokyo-border/50'),
    (r'bg-slate-900 text-cyan-400 border border-slate-700', r'bg-tokyo-storm text-tokyo-cyan border border-tokyo-border'),
    (r'stroke-slate-800', r'stroke-tokyo-border'),
    (r'border-slate-800 bg-slate-950/40', r'border-tokyo-border bg-tokyo-night/40'),
    (r'text-slate-500', r'text-tokyo-comment'),
    (r'bg-slate-800', r'bg-tokyo-panel'),
    (r'border-slate-700', r'border-tokyo-border'),
    (r'text-slate-200', r'text-tokyo-fg'),
    (r'text-white', r'text-tokyo-fg'),
    (r'text-slate-400', r'text-tokyo-comment'),
    (r'text-slate-300', r'text-tokyo-comment'),
    (r'border-slate-800', r'border-tokyo-border'),
    (r'bg-slate-900/50', r'bg-tokyo-storm/50'),
    (r'scrollbar-thumb-slate-800', r'scrollbar-thumb-tokyo-border'),
    # DefaultGraphic
    (r'bg-white/90 dark:bg-slate-900/90', r'bg-tokyo-panel/90'),
    (r'border-slate-200 dark:border-slate-700/60', r'border-tokyo-border/60'),
    (r'text-slate-700 dark:text-slate-200', r'text-tokyo-fg'),
    (r'bg-slate-800', r'bg-tokyo-panel'),
    (r'bg-white/90 dark:bg-slate-800/90', r'bg-tokyo-panel/90'),
    (r'border-slate-200 dark:border-slate-700/50', r'border-tokyo-border/50'),
    (r'text-slate-600 dark:text-slate-300', r'text-tokyo-comment'),
    (r'bg-slate-100 dark:bg-slate-900/60', r'bg-tokyo-night/60'),
    (r'border-slate-200 dark:border-slate-700/30', r'border-tokyo-border/30'),
    (r'text-slate-700 dark:text-slate-300', r'text-tokyo-fg'),
    (r'bg-white/95 dark:bg-slate-900/95', r'bg-tokyo-panel/95'),
    
    # Layout
    (r'bg-slate-950 text-slate-100', r'bg-tokyo-night text-tokyo-fg'),
    (r'border-slate-800/60', r'border-tokyo-border/60'),
    (r'bg-slate-950/80', r'bg-tokyo-night/80'),
    (r'text-slate-500 group-focus-within:text-cyan-400', r'text-tokyo-comment group-focus-within:text-tokyo-cyan'),
    (r'border-slate-700/80 bg-slate-900/50', r'border-tokyo-border/80 bg-tokyo-storm/50'),
    (r'ring-offset-slate-950', r'ring-offset-tokyo-night'),
    (r'focus:bg-slate-900', r'focus:bg-tokyo-storm'),
    (r'bg-slate-900/30', r'bg-tokyo-storm/30'),
    (r'bg-slate-900/20', r'bg-tokyo-storm/20'),
    (r'text-slate-600', r'text-tokyo-comment'),
    (r'bg-slate-900', r'bg-tokyo-storm'),
    (r'focus:ring-offset-slate-950', r'focus:ring-offset-tokyo-night'),
    
    # Button
    (r'bg-white px-4 py-3.5 text-sm font-medium text-slate-900 transition-all hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:hover:bg-white', r'bg-tokyo-blue px-4 py-3.5 text-sm font-medium text-white transition-all hover:bg-tokyo-blue/90 focus:outline-none focus:ring-2 focus:ring-tokyo-cyan focus:ring-offset-2 focus:ring-offset-tokyo-night disabled:opacity-50 disabled:hover:bg-tokyo-blue'),
    (r'bg-slate-950', r'bg-tokyo-night'),
    
    # Right panel background
    (r'bg-slate-900/50 backdrop-blur-\[100px\]', r'bg-tokyo-night/50 backdrop-blur-[100px]'),
    
    (r'text-slate-900 text-cyan-400 border border-slate-700', r'text-tokyo-storm text-tokyo-cyan border border-tokyo-border')
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open("apps/web/app/onboarding/page.tsx", "w") as f:
    f.write(content)

