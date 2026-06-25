import re

with open("apps/web/app/onboarding/page.tsx", "r") as f:
    content = f.read()

# Layout and background mappings
content = re.sub(r'\bbg-slate-950\b', 'bg-tokyo-night', content)
content = re.sub(r'\bbg-slate-900\b', 'bg-tokyo-storm', content)
content = re.sub(r'\bbg-slate-800\b', 'bg-tokyo-panel', content)
content = re.sub(r'\bbg-slate-700\b', 'bg-tokyo-sidebar', content)

# Border mappings
content = re.sub(r'\bborder-slate-800\b', 'border-tokyo-border', content)
content = re.sub(r'\bborder-slate-700\b', 'border-tokyo-border/80', content)
content = re.sub(r'\bborder-slate-200\b', 'border-tokyo-border', content) 

# Text color mappings
content = re.sub(r'\btext-slate-100\b', 'text-tokyo-fg', content)
content = re.sub(r'\btext-slate-200\b', 'text-tokyo-fg', content)
content = re.sub(r'\btext-slate-300\b', 'text-tokyo-variable', content)
content = re.sub(r'\btext-slate-400\b', 'text-tokyo-comment', content)
content = re.sub(r'\btext-slate-500\b', 'text-tokyo-comment', content)
content = re.sub(r'\btext-slate-600\b', 'text-tokyo-comment', content)
content = re.sub(r'\btext-slate-700\b', 'text-tokyo-fg', content)
content = re.sub(r'\btext-slate-800\b', 'text-tokyo-fg', content)

# bg-white hardcoded in light mode graphics that look bad in light mode with no dark mode wrapper
content = re.sub(r'\bbg-white/50\b', 'bg-tokyo-panel/50', content)
content = re.sub(r'\bbg-white/90\b', 'bg-tokyo-panel/90', content)
content = re.sub(r'\bbg-white/95\b', 'bg-tokyo-panel/95', content)
content = re.sub(r'\bbg-slate-100\b', 'bg-tokyo-night', content)
content = re.sub(r'\bbg-slate-950/40\b', 'bg-tokyo-night/40', content)

# Remove redundant dark: classes since tokyo handles dark/light automatically
content = re.sub(r'\bdark:text-white\b', '', content)
content = re.sub(r'\bdark:text-slate-[0-9]+(/[0-9]+)?\b', '', content)
content = re.sub(r'\bdark:bg-slate-[0-9]+(/[0-9]+)?\b', '', content)
content = re.sub(r'\bdark:border-slate-[0-9]+(/[0-9]+)?\b', '', content)
content = re.sub(r'\bdark:opacity-[0-9]+\b', '', content)
content = re.sub(r'\bdark:shadow-\S+\b', '', content)

# Clean up any double spaces left behind in classNames
content = re.sub(r' +', ' ', content)
content = re.sub(r'" ', '"', content)

with open("apps/web/app/onboarding/page.tsx", "w") as f:
    f.write(content)
