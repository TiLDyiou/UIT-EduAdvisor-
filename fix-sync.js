const fs = require('fs');
const path = 'apps/web/app/onboarding/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// We need to modify the simulation state machine to wait for the actual events.
// Instead of blindly incrementing, it should only increment if the actual event stage has advanced.
// Or simply, we change the auto-redirect to only happen if `isCompleted` is true.

content = content.replace(
  /const currentStage = STAGE_ORDER\[simulatedIndex\];\s*if \(\!currentStage\) \{\s*\/\/ Tự động chuyển hướng sau 1\.5 giây khi đã hoàn thành các bước\s*const delayTimer = setTimeout\(\(\) => \{\s*onComplete\(\);\s*\}, 1500\);\s*return \(\) => clearTimeout\(delayTimer\);\s*\}/,
  `const currentStage = STAGE_ORDER[simulatedIndex];
    if (!currentStage) {
      if (!isCompleted) return;
      // Tự động chuyển hướng sau 1.5 giây khi đã hoàn thành các bước
      const delayTimer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(delayTimer);
    }`
);

fs.writeFileSync(path, content);
console.log("Fixed!");
