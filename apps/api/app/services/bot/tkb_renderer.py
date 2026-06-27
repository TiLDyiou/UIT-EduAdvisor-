import io
import os
import textwrap
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import selectinload
from app.db.models.academic import Schedule

_DAY_LABELS = {2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "CN"}
_PERIOD_TIMES = {
    1: "07:30 - 08:15",
    2: "08:15 - 09:00",
    3: "09:00 - 09:45",
    4: "09:45 - 10:30",
    5: "10:30 - 11:15",
    6: "13:00 - 13:45",
    7: "13:45 - 14:30",
    8: "14:30 - 15:15",
    9: "15:15 - 16:00",
    10: "16:00 - 16:45",
}

COLOR_PALETTES = [
    # Indigo
    {"bg": (99, 102, 241, 38), "border": (99, 102, 241, 102), "bar": (99, 102, 241, 255), "text": (129, 140, 248, 255), "textLight": (165, 180, 252, 255), "pillBg": (99, 102, 241, 64), "borderLight": (99, 102, 241, 25)},
    # Emerald
    {"bg": (16, 185, 129, 38), "border": (16, 185, 129, 102), "bar": (16, 185, 129, 255), "text": (52, 211, 153, 255), "textLight": (110, 231, 183, 255), "pillBg": (16, 185, 129, 64), "borderLight": (16, 185, 129, 25)},
    # Rose
    {"bg": (244, 63, 94, 38), "border": (244, 63, 94, 102), "bar": (244, 63, 94, 255), "text": (251, 113, 133, 255), "textLight": (253, 164, 175, 255), "pillBg": (244, 63, 94, 64), "borderLight": (244, 63, 94, 25)},
    # Amber
    {"bg": (245, 158, 11, 38), "border": (245, 158, 11, 102), "bar": (245, 158, 11, 255), "text": (251, 191, 36, 255), "textLight": (252, 211, 77, 255), "pillBg": (245, 158, 11, 64), "borderLight": (245, 158, 11, 25)},
    # Sky
    {"bg": (14, 165, 233, 38), "border": (14, 165, 233, 102), "bar": (14, 165, 233, 255), "text": (56, 189, 248, 255), "textLight": (125, 211, 252, 255), "pillBg": (14, 165, 233, 64), "borderLight": (14, 165, 233, 25)},
    # Violet
    {"bg": (139, 92, 246, 38), "border": (139, 92, 246, 102), "bar": (139, 92, 246, 255), "text": (167, 139, 250, 255), "textLight": (196, 181, 253, 255), "pillBg": (139, 92, 246, 64), "borderLight": (139, 92, 246, 25)},
    # Teal
    {"bg": (20, 184, 166, 38), "border": (20, 184, 166, 102), "bar": (20, 184, 166, 255), "text": (45, 212, 191, 255), "textLight": (94, 234, 212, 255), "pillBg": (20, 184, 166, 64), "borderLight": (20, 184, 166, 25)},
    # Orange
    {"bg": (249, 115, 22, 38), "border": (249, 115, 22, 102), "bar": (249, 115, 22, 255), "text": (251, 146, 60, 255), "textLight": (253, 186, 116, 255), "pillBg": (249, 115, 22, 64), "borderLight": (249, 115, 22, 25)},
]

def load_fonts():
    base_dir = os.path.dirname(__file__)
    font_dir = os.path.abspath(os.path.join(base_dir, "..", "..", "assets", "fonts"))
    
    try:
        f_regular = os.path.join(font_dir, "Inter-Regular.ttf")
        f_medium = os.path.join(font_dir, "Inter-Medium.ttf")
        f_semibold = os.path.join(font_dir, "Inter-SemiBold.ttf")
        
        fonts = {
            "xs": ImageFont.truetype(f_regular, 10),
            "sm": ImageFont.truetype(f_regular, 11),
            "base": ImageFont.truetype(f_regular, 12),
            "medium_sm": ImageFont.truetype(f_medium, 12),
            "medium_base": ImageFont.truetype(f_medium, 14),
            "semibold_sm": ImageFont.truetype(f_semibold, 11),
            "semibold_base": ImageFont.truetype(f_semibold, 12),
        }
    except Exception as e:
        default = ImageFont.load_default()
        fonts = {k: default for k in ["xs", "sm", "base", "medium_sm", "medium_base", "semibold_sm", "semibold_base"]}
    return fonts

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current_line = []
    for word in words:
        current_line.append(word)
        w, _ = draw.textsize(" ".join(current_line), font=font) if hasattr(draw, "textsize") else (draw.textlength(" ".join(current_line), font=font), 0)
        if w > max_width:
            if len(current_line) == 1:
                lines.append(" ".join(current_line))
                current_line = []
            else:
                current_line.pop()
                lines.append(" ".join(current_line))
                current_line = [word]
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def render_tkb(schedules: list[Schedule], title: str = "Thời khóa biểu") -> bytes:
    fonts = load_fonts()
    
    # Layout dimensions
    PAD = 16
    TIME_COL_W = 80
    DAY_COL_W = 120
    HEADER_H = 48
    CELL_H = 72
    
    TABLE_W = TIME_COL_W + DAY_COL_W * 7
    TABLE_H = HEADER_H + CELL_H * 10
    
    IMG_W = TABLE_W + PAD * 2
    IMG_H = TABLE_H + PAD * 2
    
    img = Image.new("RGBA", (IMG_W, IMG_H), (38, 38, 38, 255)) # bg-neutral-800
    draw = ImageDraw.Draw(img)
    
    # Draw table background and border
    table_box = [PAD, PAD, PAD + TABLE_W, PAD + TABLE_H]
    draw.rounded_rectangle(table_box, radius=12, fill=(10, 10, 10, 255), outline=(64, 64, 64, 255), width=1) # body is bg-neutral-950 (#0a0a0a)
    
    # Draw header background
    draw.rounded_rectangle([PAD, PAD, PAD + TABLE_W, PAD + HEADER_H], radius=12, fill=(23, 23, 23, 255)) # header is bg-neutral-900
    draw.rectangle([PAD, PAD + HEADER_H - 12, PAD + TABLE_W, PAD + HEADER_H], fill=(23, 23, 23, 255)) # cover bottom rounded corners
    draw.line([PAD, PAD + HEADER_H, PAD + TABLE_W, PAD + HEADER_H], fill=(64, 64, 64, 255), width=1)
    
    # Draw headers
    for i in range(7):
        x = PAD + TIME_COL_W + i * DAY_COL_W
        y = PAD
        # cell border
        draw.rectangle([x, y, x + DAY_COL_W, y + HEADER_H], outline=(64, 64, 64, 255), width=1)
        # text
        text = _DAY_LABELS[i + 2]
        # using anchor mm for center alignment
        draw.text((x + DAY_COL_W/2, y + HEADER_H/2), text, fill=(156, 163, 175, 255), font=fonts["medium_base"], anchor="mm")
        
    # Draw periods
    for p in range(1, 11):
        x = PAD
        y = PAD + HEADER_H + (p - 1) * CELL_H
        draw.rectangle([x, y, x + TIME_COL_W, y + CELL_H], fill=(23, 23, 23, 255), outline=(64, 64, 64, 255), width=1)
        draw.text((x + TIME_COL_W/2, y + CELL_H/2 - 8), f"Tiết {p}", fill=(107, 114, 128, 255), font=fonts["medium_sm"], anchor="mm")
        draw.text((x + TIME_COL_W/2, y + CELL_H/2 + 8), _PERIOD_TIMES[p], fill=(107, 114, 128, 153), font=fonts["xs"], anchor="mm")
        
        # Draw horizontal lines for the whole table row
        draw.line([PAD + TIME_COL_W, y, PAD + TABLE_W, y], fill=(64, 64, 64, 255), width=1)
        
    # Draw vertical lines for the day columns inside the body
    for i in range(7):
        x = PAD + TIME_COL_W + i * DAY_COL_W
        draw.line([x, PAD + HEADER_H, x, PAD + TABLE_H], fill=(64, 64, 64, 255), width=1)
        
    # Map colors
    color_map = {}
    base_codes = list(dict.fromkeys([s.course.code.split('.')[0] if s.course and s.course.code else "?" for s in schedules]))
    for idx, code in enumerate(base_codes):
        color_map[code] = COLOR_PALETTES[idx % len(COLOR_PALETTES)]
        
    # Create an overlay image for semi-transparent drawing
    overlay = Image.new("RGBA", (IMG_W, IMG_H), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    # Draw courses
    for s in schedules:
        day_idx = s.day_of_week - 2
        start_p = s.start_period - 1
        row_span = s.end_period - s.start_period + 1

        x = PAD + TIME_COL_W + day_idx * DAY_COL_W
        y = PAD + HEADER_H + start_p * CELL_H

        w = DAY_COL_W
        h = row_span * CELL_H

        cell_pad = 3
        box = [x + cell_pad, y + cell_pad, x + w - cell_pad, y + h - cell_pad]
        
        course_code = s.course.code if s.course and s.course.code else "?"
        base = course_code.split('.')[0]
        palette = color_map.get(base, COLOR_PALETTES[0])
        
        # Box background and border
        overlay_draw.rounded_rectangle(box, radius=8, fill=palette["bg"], outline=palette["border"], width=1)
        
        # Left bar
        # Pillow rounded_rectangle doesn't support individual corners, so we draw a normal rect on the left edge inside the border
        overlay_draw.rectangle([box[0]+1, box[1]+1, box[0]+4, box[3]-1], fill=palette["bar"])
        
        # Text positioning
        text_x = box[0] + 8
        current_y = box[1] + 8
        
        # Course name
        cname = s.course.name if s.course else "?"
        # We need to wrap course name
        lines = wrap_text(overlay_draw, cname, fonts["semibold_base"], DAY_COL_W - 16)
        # Limit to 2 lines
        if len(lines) > 2:
            lines = lines[:2]
            lines[1] = lines[1][:-3] + "..."
            
        for line in lines:
            overlay_draw.text((text_x, current_y), line, fill=(255, 255, 255, 255), font=fonts["semibold_base"])
            current_y += 14
            
        current_y += 2
        
        # Course code pill
        pill_pad_x = 4
        pill_pad_y = 2
        cw = overlay_draw.textlength(course_code, font=fonts["xs"]) if hasattr(overlay_draw, "textlength") else overlay_draw.textsize(course_code, font=fonts["xs"])[0]
        ch = 10
        pill_box = [text_x, current_y, text_x + cw + pill_pad_x*2, current_y + ch + pill_pad_y*2]
        overlay_draw.rounded_rectangle(pill_box, radius=4, fill=palette["pillBg"])
        overlay_draw.text((text_x + pill_pad_x, current_y + pill_pad_y - 1), course_code, fill=palette["textLight"], font=fonts["xs"])
        
        current_y += ch + pill_pad_y*2 + 8
        
        # Separator line
        overlay_draw.line([text_x, current_y, box[2] - 8, current_y], fill=palette["borderLight"], width=1)
        current_y += 6
        
        # Room
        if s.room:
            overlay_draw.text((text_x, current_y), "📍 " + s.room, fill=(209, 213, 219, 255), font=fonts["sm"])
            current_y += 14
            
        # Teacher (we don't have instructor in schedule directly, wait, step3 uses instructor_name, but Schedule only has room?)
        # Let's check Schedule. If we have week_pattern, maybe we just show week_pattern or skip it.
        if s.week_pattern:
            overlay_draw.text((text_x, current_y), "📅 " + s.week_pattern[:8] + "...", fill=(209, 213, 219, 255), font=fonts["xs"])

    # Composite overlay onto main image
    final_img = Image.alpha_composite(img, overlay)
    
    # Save to PNG
    buf = io.BytesIO()
    final_img.save(buf, format='PNG')
    return buf.getvalue()
