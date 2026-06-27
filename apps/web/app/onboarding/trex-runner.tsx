"use client";

import { useEffect, useRef } from "react";

const SPRITE = {
  trexWait: { x: -839, y: -1, w: 44, h: 47 },
  trexRun1: { x: -927, y: -1, w: 44, h: 47 },
  trexRun2: { x: -971, y: -1, w: 44, h: 47 },
  trexJump: { x: -839, y: -1, w: 44, h: 47 }, // wait frame looks like jump
  trexDuck1: { x: -1103, y: -18, w: 59, h: 30 },
  trexDuck2: { x: -1162, y: -18, w: 59, h: 30 },
  trexCrash: { x: -1015, y: -1, w: 44, h: 47 },
  horizon: { x: -1, y: -52, w: 600, h: 12 },
  cactusSmall: { x: -223, y: -1, w: 17, h: 35 },
  cactusLarge: { x: -326, y: -1, w: 25, h: 50 },
  cactusDouble: { x: -240, y: -1, w: 34, h: 35 },
  pterodactyl1: { x: -130, y: -1, w: 46, h: 40 },
  pterodactyl2: { x: -176, y: -1, w: 46, h: 40 },
};

const bgStyle = (conf: { x: number; y: number; w: number; h: number }) => ({
  backgroundImage: `url('/asset.png')`,
  backgroundSize: '1223px 97px',
  backgroundPosition: `${conf.x}px ${conf.y}px`,
  width: `${conf.w}px`,
  height: `${conf.h}px`,
  backgroundRepeat: 'no-repeat',
});

const maskStyle = (conf: { x: number; y: number; w: number; h: number }) => ({
  maskImage: `url('/asset.png')`,
  WebkitMaskImage: `url('/asset.png')`,
  maskSize: '1223px 97px',
  WebkitMaskSize: '1223px 97px',
  maskPosition: `${conf.x}px ${conf.y}px`,
  WebkitMaskPosition: `${conf.x}px ${conf.y}px`,
  width: `${conf.w}px`,
  height: `${conf.h}px`,
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
});

type Obstacle = { id: number; type: string; x: number; yOffset: number };

function CircularProgress() {
  return (
    <div className="relative inline-flex items-center justify-center w-5 h-5 text-tokyo-cyan select-none">
      <svg className="w-full h-full animate-spin" viewBox="22 22 44 44">
        <circle
          cx="44"
          cy="44"
          r="20.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeDasharray="80px, 200px"
          strokeDashoffset="0"
          className="opacity-90"
        />
      </svg>
    </div>
  );
}

export function TRexRunner({
  isCompleted,
  isFailed,
}: {
  isCompleted: boolean;
  isFailed: boolean;
}) {
  const runnerRef = useRef({
    trexY: 0,
    trexVy: 0,
    isJumping: false,
    isDucking: false,
    horizonX: 0,
    obstacles: [] as Obstacle[],
    nextObstacleDistance: 400,
    runTimer: 0,
    runFrameIndex: 0,
    reqId: 0,
    speed: 5
  });

  const trexRef = useRef<HTMLDivElement>(null);
  const horizonRef1 = useRef<HTMLDivElement>(null);
  const horizonRef2 = useRef<HTMLDivElement>(null);
  const obstaclesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lastTime = performance.now();
    let obstacleId = 0;
    const state = runnerRef.current;

    const loop = (time: number) => {
      const dt = time - lastTime;
      const normalizedDt = Math.min(dt, 32); 
      lastTime = time;
      
      const speedMult = normalizedDt / 16.66; 
      const currentSpeed = state.speed * speedMult;

      if (isCompleted || isFailed) {
         if (state.trexY === 0) {
            if (trexRef.current) {
                const conf = isFailed ? SPRITE.trexCrash : SPRITE.trexWait;
                Object.assign(trexRef.current.style, bgStyle(conf));
                trexRef.current.style.transform = `translateY(0px)`;
            }
            return; 
         }
      }

      // 1. Update Horizon
      state.horizonX -= currentSpeed;
      if (state.horizonX <= -600) state.horizonX += 600;
      if (horizonRef1.current) horizonRef1.current.style.transform = `translateX(${state.horizonX}px)`;
      if (horizonRef2.current) horizonRef2.current.style.transform = `translateX(${state.horizonX + 600}px)`;

      // 2. Update Obstacles
      state.obstacles.forEach(obs => {
        obs.x -= currentSpeed;
      });
      state.obstacles = state.obstacles.filter(obs => obs.x > -50);
      
      state.nextObstacleDistance -= currentSpeed;
      if (state.nextObstacleDistance <= 0 && !isCompleted && !isFailed) {
        const rand = Math.random();
        let type = 'small';
        let yOffset = 10; // default bottom 10px (ground)
        
        // Cố định chướng ngại vật thứ 2 là chim để người dùng chắc chắn nhìn thấy
        if (obstacleId === 1) {
          type = 'pterodactyl';
          yOffset = 15; // Bay thấp để nhảy qua
        } else if (rand > 0.6) { // 40% cơ hội xuất hiện chim cho các chướng ngại vật tiếp theo
          type = 'pterodactyl';
          yOffset = Math.random() > 0.5 ? 45 : 15; // Cao (45px) hoặc thấp (15px)
        } else if (rand > 0.4) {
          type = 'large';
        } else if (rand > 0.2) {
          type = 'double';
        }
        
        state.obstacles.push({ id: obstacleId++, type, x: 600, yOffset });
        state.nextObstacleDistance = 250 + Math.random() * 350;
        
        if (state.speed < 8) state.speed += 0.05;
      }

      // 3. Render Obstacles
      if (obstaclesContainerRef.current) {
        while (obstaclesContainerRef.current.children.length < state.obstacles.length) {
          const el = document.createElement('div');
          el.className = 'absolute bg-tokyo-fg transition-colors';
          obstaclesContainerRef.current.appendChild(el);
        }
        while (obstaclesContainerRef.current.children.length > state.obstacles.length) {
          obstaclesContainerRef.current.removeChild(obstaclesContainerRef.current.lastChild!);
        }
        
        state.obstacles.forEach((obs, i) => {
          const el = obstaclesContainerRef.current!.children[i] as HTMLElement;
          let conf = SPRITE.cactusSmall;
          if (obs.type === 'large') conf = SPRITE.cactusLarge;
          if (obs.type === 'double') conf = SPRITE.cactusDouble;
          if (obs.type === 'pterodactyl') {
             // Đập cánh chim mỗi 200ms
             const flap = Math.floor(time / 200) % 2 === 0;
             conf = flap ? SPRITE.pterodactyl1 : SPRITE.pterodactyl2;
          }
          
          Object.assign(el.style, maskStyle(conf));
          el.style.bottom = `${obs.yOffset}px`;
          el.style.transform = `translateX(${obs.x}px)`;
        });
      }

      // 4. Jump & Duck Logic
      const firstObstacle = state.obstacles[0];
      state.isDucking = false;

      if (firstObstacle && !isCompleted && !isFailed) {
        const distance = firstObstacle.x - 50; 
        const triggerDistance = currentSpeed * 20 + 80;
        
        if (distance > 0 && distance < triggerDistance) {
          const isHighBird = firstObstacle.type === 'pterodactyl' && firstObstacle.yOffset >= 40;
          if (isHighBird) {
            state.isDucking = true;
          } else if (!state.isJumping) {
            state.isJumping = true;
            state.trexVy = -11.5; 
          }
        }
      }

      if (state.isJumping) {
        state.trexY += state.trexVy * speedMult;
        state.trexVy += 0.65 * speedMult; 
        
        if (state.trexY >= 0) {
          state.trexY = 0;
          state.isJumping = false;
        }
      }

      // 5. Render TRex
      if (trexRef.current) {
        trexRef.current.style.transform = `translateY(${state.trexY}px)`;
        
        if (state.isJumping) {
          Object.assign(trexRef.current.style, bgStyle(SPRITE.trexJump));
        } else if (state.isDucking) {
          state.runTimer += normalizedDt;
          if (state.runTimer > 100) { 
             state.runFrameIndex = (state.runFrameIndex + 1) % 2;
             state.runTimer = 0;
          }
          const conf = state.runFrameIndex === 0 ? SPRITE.trexDuck1 : SPRITE.trexDuck2;
          Object.assign(trexRef.current.style, bgStyle(conf));
        } else {
          state.runTimer += normalizedDt;
          if (state.runTimer > 100) { 
             state.runFrameIndex = (state.runFrameIndex + 1) % 2;
             state.runTimer = 0;
          }
          const conf = state.runFrameIndex === 0 ? SPRITE.trexRun1 : SPRITE.trexRun2;
          Object.assign(trexRef.current.style, bgStyle(conf));
        }
      }

      state.reqId = requestAnimationFrame(loop);
    };

    state.reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(state.reqId);
  }, [isCompleted, isFailed]);

  return (
    <div className="relative w-full h-32 overflow-hidden flex items-end">
      {!isCompleted && !isFailed && (
        <div className="absolute top-4 left-4 z-20">
          <CircularProgress />
        </div>
      )}



      <div 
        ref={horizonRef1} 
        className="absolute bottom-[10px] bg-tokyo-fg opacity-60 transition-colors"
        style={maskStyle(SPRITE.horizon)} 
      />
      <div 
        ref={horizonRef2} 
        className="absolute bottom-[10px] bg-tokyo-fg opacity-60 transition-colors"
        style={maskStyle(SPRITE.horizon)} 
      />
      
      <div ref={obstaclesContainerRef} className="absolute inset-0" />
      
      <div 
        ref={trexRef} 
        className="absolute bottom-[10px] left-[50px] z-10 mix-blend-multiply dark:invert dark:mix-blend-screen opacity-90"
        style={bgStyle(SPRITE.trexWait)}
      />
    </div>
  );
}
