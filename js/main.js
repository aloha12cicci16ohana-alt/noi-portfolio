function hideLoading() {
  const loadingScreen = document.getElementById("loading-screen");
  if (!loadingScreen) return;
  loadingScreen.classList.add("loaded");
}

document.addEventListener("DOMContentLoaded", () => {
  // ===== Loading: セッション内の初回アクセス時のみ表示 =====
  const loadingScreen = document.getElementById("loading-screen");
  const video = document.getElementById("loadingVideo");
  const SESSION_KEY = "noi_loading_shown";

  if (loadingScreen) {
    if (sessionStorage.getItem(SESSION_KEY)) {
      // 2回目以降：ローディングを即座にスキップ
      loadingScreen.style.display = "none";
    } else {
      // 初回：動画を再生してローディング表示
      sessionStorage.setItem(SESSION_KEY, "1");
      if (video) {
        video.addEventListener("ended", hideLoading);
        video.addEventListener("loadedmetadata", () => {
          const ms = Math.ceil(video.duration * 1000);
          if (Number.isFinite(ms) && ms > 0) {
            setTimeout(hideLoading, ms + 300);
          } else {
            setTimeout(hideLoading, 15000);
          }
        });
        setTimeout(hideLoading, 15000);
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } else {
        setTimeout(hideLoading, 3000);
      }
    }
  }

  // ===== Anchor smooth scroll =====
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (targetId === "#") return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // ===================================================
  //  WORKS: スクロール連動・段階拡大アニメーション
  //  position:fixed の works-window を rAF で制御する
  // ===================================================

  const worksWindow  = document.getElementById("works-window");
  const worksOverlay = document.getElementById("works-overlay");
  const worksIntro   = document.querySelector(".works-intro");
  const placeholder  = document.querySelector(".works-placeholder");

  if (worksWindow && worksOverlay && worksIntro && placeholder) {
    // ---- クリップパス計算 ----
    function buildClip(wPx, hPx, r, vpW, vpH) {
      const hInset = Math.max(0, (vpW - wPx) / 2);
      const vInset = Math.max(0, (vpH - hPx) / 2);
      return `inset(${vInset}px ${hInset}px ${vInset}px ${hInset}px round ${r}px)`;
    }

    // 4ステップのサイズ定義
    // step 0 = 初期（小さい四角）、step 3 = 全画面
    const STEPS = [
      { w: 420, h: 280, r: 12 },  // step 0: 初期
      { w: 660, h: 420, r: 8  },  // step 1: 1回目拡大
      { w: 940, h: 600, r: 4  },  // step 2: 2回目拡大
      { w: 9999, h: 9999, r: 0 }, // step 3: 全画面（vw/vh で計算）
    ];

    // 各フェーズが占めるスクロール比率（合計1.0）
    // [表示開始, step1拡大, step2拡大, step3全画面, オーバーレイ, 停留]
    const PHASE = [0.05, 0.22, 0.22, 0.22, 0.14, 0.15];
    // フェーズ境界の累積値
    const CUM = PHASE.reduce((acc, v, i) => {
      acc.push((acc[i - 1] || 0) + v);
      return acc;
    }, []);

    // GSAP は使わず easing を自前で定義
    function easeExpoOut(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }
    function lerp(a, b, t) { return a + (b - a) * t; }

    // clip-path の値を lerp する（数値として扱う）
    function lerpClip(fromStep, toStep, t, vpW, vpH) {
      const fw = Math.min(fromStep.w, vpW);
      const fh = Math.min(fromStep.h, vpH);
      const tw = Math.min(toStep.w, vpW);
      const th = Math.min(toStep.h, vpH);
      const w = lerp(fw, tw, t);
      const h = lerp(fh, th, t);
      const r = lerp(fromStep.r, toStep.r, t);
      return buildClip(w, h, r, vpW, vpH);
    }

    // 現在のアニメーション状態
    let isActive = false;  // works-window が表示中か
    let rafId = null;

    function tick() {
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const rect = placeholder.getBoundingClientRect();

      // placeholder の top が画面上端に達したらアニメーション開始
      // placeholder の bottom が画面上端を超えたら終了
      const totalH = placeholder.offsetHeight;   // 400vh
      const scrolled = -rect.top;               // placeholder の先頭からのスクロール量

      if (scrolled < 0 || scrolled > totalH) {
        // 範囲外：works-window を非表示
        if (isActive) {
          worksWindow.style.display = "none";
          worksWindow.style.pointerEvents = "none";
          worksOverlay.style.opacity = "0";
          isActive = false;
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      // 範囲内：works-window を表示
      if (!isActive) {
        worksWindow.style.display = "block";
        isActive = true;
      }

      const progress = Math.min(1, scrolled / totalH);  // 0 ~ 1

      // --- フェーズ別処理 ---

      // フェーズ0: 表示開始 (0 ~ CUM[0])
      //   → intro フェードアウト、初期クリップを表示
      if (progress < CUM[0]) {
        const t = progress / PHASE[0];
        worksIntro.style.opacity = String(1 - easeExpoOut(t));
        worksWindow.style.clipPath = buildClip(
          Math.min(STEPS[0].w, vpW), Math.min(STEPS[0].h, vpH),
          STEPS[0].r, vpW, vpH
        );
        worksOverlay.style.opacity = "0";
        worksWindow.style.pointerEvents = "none";

      // フェーズ1: step0 → step1 拡大 (CUM[0] ~ CUM[1])
      } else if (progress < CUM[1]) {
        const t = easeExpoOut((progress - CUM[0]) / PHASE[1]);
        worksIntro.style.opacity = "0";
        worksWindow.style.clipPath = lerpClip(STEPS[0], STEPS[1], t, vpW, vpH);
        worksOverlay.style.opacity = "0";

      // フェーズ2: step1 → step2 拡大 (CUM[1] ~ CUM[2])
      } else if (progress < CUM[2]) {
        const t = easeExpoOut((progress - CUM[1]) / PHASE[2]);
        worksWindow.style.clipPath = lerpClip(STEPS[1], STEPS[2], t, vpW, vpH);
        worksOverlay.style.opacity = "0";

      // フェーズ3: step2 → 全画面 (CUM[2] ~ CUM[3])
      } else if (progress < CUM[3]) {
        const t = easeExpoOut((progress - CUM[2]) / PHASE[3]);
        worksWindow.style.clipPath = lerpClip(STEPS[2], STEPS[3], t, vpW, vpH);
        worksOverlay.style.opacity = "0";
        // 全画面になったらポインターイベントを有効化
        if (t > 0.95) {
          worksWindow.style.pointerEvents = "auto";
        }

      // フェーズ4: オーバーレイ フェードイン (CUM[3] ~ CUM[4])
      } else if (progress < CUM[4]) {
        const t = (progress - CUM[3]) / PHASE[4];
        worksWindow.style.clipPath = buildClip(vpW, vpH, 0, vpW, vpH);
        worksOverlay.style.opacity = String(easeExpoOut(t));
        worksWindow.style.pointerEvents = "auto";

      // フェーズ5: 停留 (CUM[4] ~ 1.0)
      } else {
        worksWindow.style.clipPath = buildClip(vpW, vpH, 0, vpW, vpH);
        worksOverlay.style.opacity = "1";
        worksWindow.style.pointerEvents = "auto";
      }

      rafId = requestAnimationFrame(tick);
    }

    // rAF 開始
    rafId = requestAnimationFrame(tick);
  }

  // ===================================================
  //  Footer Animation (ScrollTrigger) - Flowing Logo
  // ===================================================
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);

    const footerAnimWrapper = document.querySelector('.footer-animation-wrapper');
    const fixedLogo = document.querySelector('.logo');
    const footerNoi = document.querySelector('.footer-anim-noi');

    if (footerAnimWrapper && fixedLogo && footerNoi) {
      // 初期状態のセットアップ
      gsap.set('.footer-anim-line', { scaleX: 0, transformOrigin: 'left center' });
      gsap.set('.footer-anim-noise', { opacity: 0, scale: 0.8 });
      gsap.set('.footer-glitch-text', { opacity: 0 }); // テキストの初期状態を非表示に
      gsap.set(footerNoi, { opacity: 0 });

      let footerTl;
      // footerのラッパー自体をトリガーにし、画面下部に見えてきたら発火するように汎用化
      const triggerEl = document.querySelector('.footer-animation-wrapper');

      if (triggerEl) {
        ScrollTrigger.create({
          trigger: triggerEl, 
          // 画面下から5%の位置（ほぼ見えた時）にトリガー要素のTOPが来た瞬間に発火する
          start: 'top 95%', 
          onEnter: () => {
            // fixedロゴを非表示にし、footer側のNOIからアニメーション開始
            gsap.set(fixedLogo, { opacity: 0, visibility: 'hidden', transition: 'none' });
            gsap.set(footerNoi, { x: 0, y: 0, opacity: 1 }); // 測定のために一旦リセット

            const logoRect = fixedLogo.getBoundingClientRect();
            const footerRect = footerNoi.getBoundingClientRect();
            const dx = logoRect.left - footerRect.left;
            const dy = logoRect.top - footerRect.top;

            if (footerTl) footerTl.kill(); // 既存のタイムラインがあればキルする

            footerTl = gsap.timeline();
            footerTl.fromTo(footerNoi, 
              { x: dx, y: dy }, 
              { x: 0, y: 0, duration: 0.8, ease: 'bounce.out' }
            )
            .fromTo('.footer-anim-line', 
              { scaleX: 0 }, 
              { scaleX: 1, duration: 1, ease: 'power3.inOut' }, 
              "-=0.4"
            )
            .fromTo('.footer-glitch-text', 
              { opacity: 0, y: 10 }, 
              { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 
              "-=0.5" // 線が伸びる途中でフワッと出現
            )
            .fromTo('.footer-anim-noise', 
              { opacity: 0, scale: 0.8 }, 
              { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, 
              "-=0.4"
            );
          },
          onLeaveBack: () => {
            // 巻き戻し時はタイムラインをreverseして自然に消すか、
            // 画面外にいった瞬間にリセットする
            if (footerTl) footerTl.kill();
            gsap.set(fixedLogo, { opacity: 1, visibility: 'visible', clearProps: 'all' });
            gsap.set(footerNoi, { opacity: 0 });
            gsap.set('.footer-anim-line', { scaleX: 0 });
            gsap.set('.footer-glitch-text', { opacity: 0 }); // 巻き戻し時も消す
            gsap.set('.footer-anim-noise', { opacity: 0, scale: 0.8 });
          }
        });
      }
    }
  }
});

// --- Works Archive Filter ---
document.addEventListener("DOMContentLoaded", () => {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const workItems = document.querySelectorAll('.work-item');

  if (filterBtns.length > 0 && workItems.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Activeクラスの付け替え
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filterValue = btn.getAttribute('data-filter');

        // アイテムの表示・非表示を切り替え
        workItems.forEach(item => {
          const itemCategories = item.getAttribute('data-category');
          if (filterValue === 'all' || (itemCategories && itemCategories.includes(filterValue))) {
            item.style.display = 'block';
            // 少し遅れてopacityを戻す（簡易アニメーション）
            setTimeout(() => { item.style.opacity = '1'; }, 10);
          } else {
            item.style.opacity = '0';
            setTimeout(() => { item.style.display = 'none'; }, 300);
          }
        });
      });
    });
  }
});

// ===== モバイルヘッダー: スクロールで半透明切り替え =====
(function () {
  const mobileBar = document.querySelector('.mobile-header-bar');
  if (!mobileBar) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 30) {
          mobileBar.classList.add('scrolled');
        } else {
          mobileBar.classList.remove('scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // スマホ用 メニュー開閉ロジック
  const menuBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('mobileCloseBtn');
  const menuLinks = document.querySelectorAll('.mobile-nav-links a');

  function openMenu() {
    document.body.classList.add('is-menu-open');
  }

  function closeMenu() {
    document.body.classList.remove('is-menu-open');
  }

  if (menuBtn) menuBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);

  // リンクを押したらメニューを閉じる
  menuLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

})();

// loadが来たら消す（念のため）
window.addEventListener("load", () => {
  // セッション済みの場合はdisplay:noneなので何もしなくてよいが念のため
  if (document.getElementById("loading-screen") && !sessionStorage.getItem("noi_loading_shown")) {
    setTimeout(hideLoading, 300);
  }
});

// ===================================================
//  カスタムカーソル：ライムグリーンの丸
// ===================================================
(function () {
  const cursor = document.createElement('div');
  cursor.classList.add('custom-cursor');
  document.body.appendChild(cursor);

  let mouseX = -100, mouseY = -100;
  let curX = -100, curY = -100;

  // マウス位置を記録
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // 少しなめらかに追いかけるアニメーション
  function animateCursor() {
    curX += (mouseX - curX) * 0.18;
    curY += (mouseY - curY) * 0.18;
    cursor.style.left = curX + 'px';
    cursor.style.top  = curY + 'px';
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // リンク・ボタンのホバーで拡大
  const hoverTargets = 'a, button, .filter-btn, .view-all-btn, .cta-btn, .work-item';
  document.querySelectorAll(hoverTargets).forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.width  = '40px';
      cursor.style.height = '40px';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.width  = '20px';
      cursor.style.height = '20px';
    });
  });

  // ウィンドウ外に出たら非表示
  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { cursor.style.opacity = '1'; });
})();
