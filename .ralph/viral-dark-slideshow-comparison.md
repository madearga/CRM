# Viral Dark Slideshow — HyperFrames vs Remotion Comparison

## Goal
Create a viral-style dark slideshow video (9:16 portrait, TikTok/Reels format) using BOTH HyperFrames and Remotion, then compare the developer experience, render performance, and output quality.

## Plan Location
`~/Desktop/viral-slideshow-comparison/plan.md`

## Tasks

### Phase 1: Plan & Design
- [ ] Create the design spec (scenes, timing, colors, animations)
- [ ] Write plan doc at `docs/superpowers/plans/2026-04-18-viral-dark-slideshow.md`

### Phase 2: HyperFrames Implementation
- [ ] Create HyperFrames project at `~/Desktop/viral-slideshow-comparison/hyperframes/`
- [ ] Implement all scenes as HTML composition with GSAP
- [ ] Lint + validate
- [ ] Render to MP4 (measure time)

### Phase 3: Remotion Implementation
- [ ] Create Remotion project at `~/Desktop/viral-slideshow-comparison/remotion/`
- [ ] Implement all scenes as React components
- [ ] Render to MP4 (measure time)

### Phase 4: Comparison
- [ ] Compare: DX, code complexity, render time, file size, flexibility
- [ ] Write comparison summary

## Video Spec
- **Format**: 9:16 portrait (1080×1920) — TikTok/Reels
- **Duration**: ~12 seconds
- **Style**: Dark background (#0a0a0f), neon accents, bold typography
- **Scenes**: 
  1. Hook opener (0-2s) — "STOP SCROLLING" flash text
  2. Problem statement (2-5s) — "Still doing X manually?" with stats
  3. Solution reveal (5-8s) — product/name reveal with glow
  4. CTA (8-12s) — "Try it now" with fade
- **Transitions**: Smooth crossfades between scenes
- **Animation**: GSAP-style entrances, text reveals, pulse effects
