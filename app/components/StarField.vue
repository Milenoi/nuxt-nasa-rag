<script setup lang="ts">
/**
 * Animated deep-space background: three twinkling star layers and two drifting
 * comets. Purely decorative, sits behind the page content (fixed, negative
 * z-index, pointer-events: none) and is hidden from assistive tech.
 *
 * The Taurus constellation lives in its own interactive component
 * (TaurusConstellation.vue) so its stars can be dragged; this stays a pure,
 * non-interactive backdrop, reused as-is on the 404 page.
 *
 * All keyframes (twinkle*, comet1/2) live globally in tailwind.css and already
 * respect prefers-reduced-motion.
 */
</script>

<template>
  <div
    class="starfield"
    aria-hidden="true"
  >
    <!-- three star layers, each twinkling on its own rhythm -->
    <div class="stars stars-1" />
    <div class="stars stars-2" />
    <div class="stars stars-3" />

    <!-- two comets streaking across, offset in time and angle -->
    <div class="comet comet-a">
      <div class="comet-head">
        <div class="comet-tail" />
      </div>
    </div>
    <div class="comet comet-b">
      <div class="comet-head comet-head--small">
        <div class="comet-tail comet-tail--small" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.starfield {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  /* deep-space base: three faint nebula glows over near-black */
  background:
    radial-gradient(1000px 560px at 80% 4%, rgba(60, 64, 150, 0.15), transparent 60%),
    radial-gradient(820px 640px at 8% 94%, rgba(96, 52, 128, 0.12), transparent 62%),
    radial-gradient(560px 420px at 46% 44%, rgba(34, 64, 120, 0.08), transparent 60%),
    #020308;
}

.stars {
  position: absolute;
  inset: 0;
}

/* Layer 1, the brightest, densest field */
.stars-1 {
  background-image:
    radial-gradient(1.6px 1.6px at 40px 60px, #fff, transparent),
    radial-gradient(1px 1px at 120px 120px, rgba(255, 255, 255, 0.85), transparent),
    radial-gradient(1.3px 1.3px at 210px 40px, #fff, transparent),
    radial-gradient(1px 1px at 300px 190px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1.4px 1.4px at 400px 90px, #fff, transparent),
    radial-gradient(1px 1px at 470px 250px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1.2px 1.2px at 560px 140px, #fff, transparent),
    radial-gradient(1px 1px at 650px 300px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1.3px 1.3px at 740px 70px, #fff, transparent),
    radial-gradient(1px 1px at 830px 210px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1.5px 1.5px at 930px 130px, #fff, transparent),
    radial-gradient(1px 1px at 1010px 280px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1.2px 1.2px at 1100px 60px, #fff, transparent),
    radial-gradient(1px 1px at 60px 300px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1.3px 1.3px at 380px 340px, #fff, transparent),
    radial-gradient(1px 1px at 700px 360px, rgba(255, 255, 255, 0.55), transparent);
  background-size: 560px 380px;
  animation: twinkle 6s ease-in-out infinite;
}

/* Layer 2, mid field, twinkling in counter-phase */
.stars-2 {
  background-image:
    radial-gradient(1px 1px at 90px 200px, rgba(200, 215, 255, 0.7), transparent),
    radial-gradient(1px 1px at 260px 150px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1.7px 1.7px at 520px 220px, #fff, transparent),
    radial-gradient(1px 1px at 760px 300px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 980px 90px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 180px 60px, rgba(220, 210, 255, 0.6), transparent),
    radial-gradient(1px 1px at 620px 40px, rgba(255, 255, 255, 0.55), transparent),
    radial-gradient(1.4px 1.4px at 1120px 240px, #fff, transparent);
  background-size: 480px 420px;
  animation: twinkle2 8s ease-in-out infinite;
}

/* Layer 3, faintest distant field, slowest pulse */
.stars-3 {
  background-image:
    radial-gradient(1px 1px at 140px 90px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 340px 260px, rgba(255, 255, 255, 0.45), transparent),
    radial-gradient(1px 1px at 560px 120px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 880px 200px, rgba(255, 255, 255, 0.45), transparent),
    radial-gradient(1px 1px at 1040px 320px, rgba(255, 255, 255, 0.5), transparent);
  background-size: 420px 360px;
  animation: twinkle3 10s ease-in-out infinite;
}

.comet {
  position: absolute;
  left: 0;
}

.comet-a {
  top: 7%;
  animation: comet1 15s ease-in infinite;
}

.comet-b {
  top: 20%;
  animation: comet2 24s ease-in infinite 7s;
}

.comet-head {
  position: relative;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 9px 2px rgba(180, 210, 255, 0.9);
}

.comet-head--small {
  width: 3px;
  height: 3px;
  box-shadow: 0 0 8px 2px rgba(200, 180, 255, 0.85);
}

.comet-tail {
  position: absolute;
  right: 3px;
  top: 1px;
  width: 160px;
  height: 2px;
  background: linear-gradient(to left, rgba(200, 220, 255, 0.9), transparent);
}

.comet-tail--small {
  right: 2px;
  width: 120px;
  height: 1.5px;
  background: linear-gradient(to left, rgba(220, 200, 255, 0.85), transparent);
}
</style>
