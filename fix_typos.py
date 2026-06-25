import re

with open("apps/web/app/onboarding/page.tsx", "r") as f:
    content = f.read()

# Fix border typos
content = content.replace("border-tokyo-border/80/", "border-tokyo-border/")

# Fix text-white in headings
content = content.replace('text-white"', 'text-tokyo-fg"')
content = content.replace('text-white text-lg', 'text-tokyo-fg text-lg')
content = content.replace('text-white mb-6', 'text-tokyo-fg mb-6')
content = content.replace('text-white tracking-tight', 'text-tokyo-fg tracking-tight')

# Fix Badge (Tiến trình đồng bộ)
old_badge = 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-1 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
new_badge = 'bg-tokyo-cyan/10 border border-tokyo-cyan/20 text-tokyo-cyan text-xs font-semibold mb-1'
content = content.replace(old_badge, new_badge)

# Fix Lịch học card size
old_card = 'w-40 h-40 rounded-[1.5rem] bg-tokyo-panel/90'
new_card = 'w-44 h-48 rounded-[1.5rem] bg-tokyo-panel/90'
content = content.replace(old_card, new_card)

# Fix MA006 margin issue specifically
content = content.replace('flex flex-col gap-0.5 opacity-60 text-left mb-3', 'flex flex-col gap-0.5 opacity-60 text-left mb-1')

with open("apps/web/app/onboarding/page.tsx", "w") as f:
    f.write(content)
