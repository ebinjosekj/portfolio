# Ebin Jose — Portfolio

Personal portfolio of Ebin Jose, Full Stack Developer (.NET, C#, Angular, React, Azure).
Live at **https://ebinjosekj.github.io/portfolio/**

## Stack

A static site with no build step, deployed by GitHub Pages straight from `main`.

- `index.html`: semantic markup holding all content, SEO metadata and JSON-LD
- `assets/css/main.css`: design tokens, layout, motion and responsive rules
- `assets/js/main.js`: dependency-free interaction modules (preloader, navigation, scroll reveals, counters, technology universe, timeline, project overlay, cursor, magnetic buttons)
- `assets/js/hero-gl.js`: the hero sculpture, a raymarched WebGL fragment shader loaded lazily, with a CSS fallback
- `assets/fonts`: self-hosted Sora and Inter (variable, latin subset, OFL)
- `assets/icons`: technology logos from [Devicon](https://devicon.dev) (MIT)

## Accessibility and performance

- Respects `prefers-reduced-motion`: no preloader, no continuous motion and a static 3D frame
- Every piece of content is readable without JavaScript
- The WebGL scene renders at adaptive resolution, pauses when off-screen and falls back to CSS on low-power devices
- Keyboard-accessible navigation, filters, timeline and project dialog

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Project previews are concept illustrations, not screenshots of production systems.
