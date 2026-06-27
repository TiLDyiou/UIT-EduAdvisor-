import re

with open('apps/web/components/UITMateWidget.tsx', 'r') as f:
    content = f.read()

old_onMove = """    const onMove = (clientX: number, clientY: number) => {
      if (!isDragging.current) return;

      const dx = clientX - dragStart.current.mouseX;
      const dy = clientY - dragStart.current.mouseY;
      dragDistance.current = Math.sqrt(dx * dx + dy * dy);

      let bx = positionRef.current.x;
      let by = positionRef.current.y;

      if (dragTarget.current === 'window') {
        const W = 380, H = 520;
        let wLeft = dragStart.current.wLeft + dx;
        let wTop = dragStart.current.wTop + dy;

        wLeft = Math.max(16, Math.min(window.innerWidth - W - 16, wLeft));
        wTop = Math.max(16, Math.min(window.innerHeight - H - 16, wTop));

        const actualDx = wLeft - dragStart.current.wLeft;
        const actualDy = wTop - dragStart.current.wTop;

        bx = dragStart.current.bubbleX + actualDx;
        by = dragStart.current.bubbleY + actualDy;

        bx = Math.max(16, Math.min(window.innerWidth - 72, bx));
        by = Math.max(16, Math.min(window.innerHeight - 72, by));

        const finalDx = bx - dragStart.current.bubbleX;
        const finalDy = by - dragStart.current.bubbleY;

        wLeft = dragStart.current.wLeft + finalDx;
        wTop = dragStart.current.wTop + finalDy;

        positionRef.current = { x: bx, y: by };

        if (windowRef.current) {
          windowRef.current.style.left = `${wLeft}px`;
          windowRef.current.style.top = `${wTop}px`;
        }
        if (bubbleRef.current) {
          bubbleRef.current.style.left = `${bx}px`;
          bubbleRef.current.style.top = `${by}px`;
        }
      } else {
        bx = Math.max(16, Math.min(window.innerWidth - 72, dragStart.current.bubbleX + dx));
        by = Math.max(16, Math.min(window.innerHeight - 72, dragStart.current.bubbleY + dy));

        positionRef.current = { x: bx, y: by };

        if (bubbleRef.current) {
          bubbleRef.current.style.left = `${bx}px`;
          bubbleRef.current.style.top = `${by}px`;
        }
        if (windowRef.current) {
          applyWindowStyle(windowRef.current, bx, by);
        }
      }
    };"""

new_onMove = """    const onMove = (clientX: number, clientY: number) => {
      if (!isDragging.current) return;

      const dx = clientX - dragStart.current.mouseX;
      const dy = clientY - dragStart.current.mouseY;
      dragDistance.current = Math.sqrt(dx * dx + dy * dy);

      const bx = Math.max(16, Math.min(window.innerWidth - 72, dragStart.current.bubbleX + dx));
      const by = Math.max(16, Math.min(window.innerHeight - 72, dragStart.current.bubbleY + dy));

      positionRef.current = { x: bx, y: by };

      if (bubbleRef.current) {
        bubbleRef.current.style.left = `${bx}px`;
        bubbleRef.current.style.top = `${by}px`;
      }
      if (windowRef.current) {
        applyWindowStyle(windowRef.current, bx, by);
      }
    };"""

if old_onMove in content:
    content = content.replace(old_onMove, new_onMove)
    with open('apps/web/components/UITMateWidget.tsx', 'w') as f:
        f.write(content)
    print("Successfully replaced onMove.")
else:
    print("Could not find old_onMove.")
