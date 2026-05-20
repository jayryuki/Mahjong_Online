# AGENTS

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>threejs-animation</name>
<description>Three.js animation - keyframe animation, skeletal animation, morph targets, animation mixing. Use when animating objects, playing GLTF animations, creating procedural motion, or blending animations.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-fundamentals</name>
<description>Three.js scene setup, cameras, renderer, Object3D hierarchy, coordinate systems. Use when setting up 3D scenes, creating cameras, configuring renderers, managing object hierarchies, or working with transforms.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-geometry</name>
<description>Three.js geometry creation - built-in shapes, BufferGeometry, custom geometry, instancing. Use when creating 3D shapes, working with vertices, building custom meshes, or optimizing with instanced rendering.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-interaction</name>
<description>Three.js interaction - raycasting, controls, mouse/touch input, object selection. Use when handling user input, implementing click detection, adding camera controls, or creating interactive 3D experiences.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-lighting</name>
<description>Three.js lighting - light types, shadows, environment lighting. Use when adding lights, configuring shadows, setting up IBL, or optimizing lighting performance.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-loaders</name>
<description>Three.js asset loading - GLTF, textures, images, models, async patterns. Use when loading 3D models, textures, HDR environments, or managing loading progress.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-materials</name>
<description>Three.js materials - PBR, basic, phong, shader materials, material properties. Use when styling meshes, working with textures, creating custom shaders, or optimizing material performance.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-postprocessing</name>
<description>Three.js post-processing - EffectComposer, bloom, DOF, screen effects. Use when adding visual effects, color grading, blur, glow, or creating custom screen-space shaders.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-shaders</name>
<description>Three.js shaders - GLSL, ShaderMaterial, uniforms, custom effects. Use when creating custom visual effects, modifying vertices, writing fragment shaders, or extending built-in materials.</description>
<location>project</location>
</skill>

<skill>
<name>threejs-textures</name>
<description>Three.js textures - texture types, UV mapping, environment maps, texture settings. Use when working with images, UV coordinates, cubemaps, HDR environments, or texture optimization.</description>
<location>project</location>
</skill>

<skill>
<name>animejs</name>
<description>Anime.js adapter patterns for HyperFrames. Use when writing Anime.js animations or timelines inside HyperFrames compositions, registering animations on window.__hfAnime, making Anime.js seek-driven and deterministic, or translating Anime.js examples into render-safe HyperFrames HTML.</description>
<location>global</location>
</skill>

<skill>
<name>comfyui-api</name>
<description>Connect to a running ComfyUI instance, queue workflows, monitor execution, and retrieve results. Supports both online (REST API) and offline (JSON export) modes. Use when executing ComfyUI workflows or checking server status.</description>
<location>global</location>
</skill>

<skill>
<name>comfyui-prompt-engineer</name>
<description>Craft model-specific prompts optimized for the target checkpoint and identity method. Handles FLUX, SDXL, SD1.5, and Wan video models with proper syntax, quality tags, and negative prompts. Use when generating or refining prompts for ComfyUI workflows.</description>
<location>global</location>
</skill>

<skill>
<name>contribute-catalog</name>
<description>Author a new HyperFrames registry block (caption style, VFX block, transition, lower third) or component (text effect, overlay, snippet) and ship it as an upstream PR to the hyperframes repo. Use ONLY when the user wants to CONTRIBUTE to the public catalog — for in-project caption/transition authoring use the `hyperframes` skill, for installing existing registry items use the `hyperframes-registry` skill.</description>
<location>global</location>
</skill>

<skill>
<name>css-animations</name>
<description>CSS animation adapter patterns for HyperFrames. Use when authoring CSS keyframes, animation-delay based timing, animation-fill-mode, animation-play-state, or CSS-only motion that HyperFrames must seek deterministically during preview and rendering.</description>
<location>global</location>
</skill>

<skill>
<name>gsap</name>
<description>GSAP animation reference for HyperFrames. Covers gsap.to(), from(), fromTo(), easing, stagger, defaults, timelines (gsap.timeline(), position parameter, labels, nesting, playback), and performance (transforms, will-change, quickTo). Use when writing GSAP animations in HyperFrames compositions.</description>
<location>global</location>
</skill>

<skill>
<name>huashu-design</name>
<description>花叔Design（Huashu-Design）——用HTML做高保真原型、交互Demo、幻灯片、动画、设计变体探索+设计方向顾问+专家评审的一体化设计能力。HTML是工具不是媒介，根据任务embody不同专家（UX设计师/动画师/幻灯片设计师/原型师），避免web design tropes。触发词：做原型、设计Demo、交互原型、HTML演示、动画Demo、设计变体、hi-fi设计、UI mockup、prototype、设计探索、做个HTML页面、做个可视化、app原型、iOS原型、移动应用mockup、导出MP4、导出GIF、60fps视频、设计风格、设计方向、设计哲学、配色方案、视觉风格、推荐风格、选个风格、做个好看的、评审、好不好看、review this design。**主干能力**：Junior Designer工作流（先给假设+reasoning+placeholder再迭代）、反AI slop清单、React+Babel最佳实践、Tweaks变体切换、Speaker Notes演示、Starter Components（幻灯片外壳/变体画布/动画引擎/设备边框）、App原型专属守则（默认从Wikimedia/Met/Unsplash取真图、每台iPhone包AppPhone状态管理器可交互、交付前跑Playwright点击测试）、Playwright验证、HTML动画→MP4/GIF视频导出（25fps基础 + 60fps插帧 + palette优化GIF + 6首场景化BGM + 自动fade）。**需求模糊时的Fallback**：设计方向顾问模式——从5流派×20种设计哲学（Pentagram信息建筑/Field.io运动诗学/Kenya Hara东方极简/Sagmeister实验先锋等）推荐3个差异化方向，展示24个预制showcase（8场景×3风格），并行生成3个视觉Demo让用户选。**交付后可选**：专家级5维度评审（哲学一致性/视觉层级/细节执行/功能性/创新性各打10分+修复清单）。</description>
<location>global</location>
</skill>

<skill>
<name>hyperframes</name>
<description>Create video compositions, animations, title cards, overlays, captions, voiceovers, audio-reactive visuals, and scene transitions in HyperFrames HTML. Use when asked to build any HTML-based video content, add captions or subtitles synced to audio, generate text-to-speech narration, create audio-reactive animation (beat sync, glow, pulse driven by music), add animated text highlighting (marker sweeps, hand-drawn circles, burst lines, scribble, sketchout), or add transitions between scenes (crossfades, wipes, reveals, shader transitions). Covers composition authoring, timing, media, and the full video production workflow. For dev-loop CLI commands (init, lint, inspect, preview, render) see the hyperframes-cli skill; for asset preprocessing commands (tts, transcribe, remove-background) see the hyperframes-media skill.</description>
<location>global</location>
</skill>

<skill>
<name>hyperframes-cli</name>
<description>HyperFrames CLI dev loop — `npx hyperframes` for scaffolding (init), validation (lint, inspect), preview, render, and environment troubleshooting (doctor, browser, info, upgrade). Use when running any of these commands or troubleshooting the HyperFrames build/render environment. For asset preprocessing commands (`tts`, `transcribe`, `remove-background`), invoke the `hyperframes-media` skill instead.</description>
<location>global</location>
</skill>

<skill>
<name>hyperframes-media</name>
<description>Asset preprocessing for HyperFrames compositions — text-to-speech narration (Kokoro), audio/video transcription (Whisper), and background removal for transparent overlays (u2net). Use when generating voiceover from text, transcribing speech for captions, removing the background from a video or image to use as a transparent overlay, choosing a TTS voice or whisper model, or chaining these (TTS → transcribe → captions). Each command downloads its own model on first run.</description>
<location>global</location>
</skill>

<skill>
<name>hyperframes-registry</name>
<description>Install and wire registry blocks and components into HyperFrames compositions. Use when running hyperframes add, installing a block or component, wiring an installed item into index.html, or working with hyperframes.json. Covers the add command, install locations, block sub-composition wiring, component snippet merging, and registry discovery.</description>
<location>global</location>
</skill>

<skill>
<name>lottie</name>
<description>Lottie and dotLottie adapter patterns for HyperFrames. Use when embedding lottie-web JSON animations, .lottie files, @lottiefiles/dotlottie-web players, registering instances on window.__hfLottie, or making After Effects exports deterministic in HyperFrames.</description>
<location>global</location>
</skill>

<skill>
<name>progressive-web-app</name>
<description>Progressive Web Apps with service workers, web manifest, offline support, installation prompts. Use for installable web apps, offline functionality, push notifications, or encountering service worker registration, cache strategy, manifest configuration errors.</description>
<location>global</location>
</skill>

<skill>
<name>remotion-to-hyperframes</name>
<description>Translate an existing Remotion (React-based) video composition into a HyperFrames HTML composition. Use ONLY when the user explicitly asks to port, convert, migrate, translate, or rewrite a Remotion composition as HyperFrames (e.g. "port my Remotion project to HyperFrames"). Do NOT use when (a) authoring a NEW HyperFrames composition (even if A/B-testing a Remotion video); (b) Remotion is mentioned in passing; (c) Remotion code is shared as reference, not for translation; (d) the user wants "the same video as my Remotion one" without explicitly asking to migrate the source — treat as a fresh HyperFrames build. When in doubt, default to the `hyperframes` skill. Detects unsupported patterns (useState, useEffect side effects, async calculateMetadata, third-party React component libraries, `@remotion/lambda`) and recommends the runtime interop escape hatch instead of a lossy translation.</description>
<location>global</location>
</skill>

<skill>
<name>tailwind</name>
<description>Tailwind CSS v4.2 browser-runtime patterns for HyperFrames compositions. Use when scaffolding or editing projects created with `hyperframes init --tailwind`, writing Tailwind utility classes in composition HTML, adding CSS-first Tailwind v4 theme tokens, debugging v3 vs v4 syntax, or deciding when to compile Tailwind to CSS instead of using the browser runtime.</description>
<location>global</location>
</skill>

<skill>
<name>three</name>
<description>Three.js and WebGL adapter patterns for HyperFrames. Use when creating deterministic Three.js scenes, WebGL canvas layers, AnimationMixer timelines, camera motion, shader-driven visuals, or canvas renders that respond to HyperFrames hf-seek events.</description>
<location>global</location>
</skill>

<skill>
<name>waapi</name>
<description>Web Animations API adapter patterns for HyperFrames. Use when authoring element.animate() motion, Animation currentTime seeking, document.getAnimations(), KeyframeEffect timing, fill modes, or native browser animations that must render deterministically in HyperFrames.</description>
<location>global</location>
</skill>

<skill>
<name>website-to-hyperframes</name>
<description>|</description>
<location>global</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
