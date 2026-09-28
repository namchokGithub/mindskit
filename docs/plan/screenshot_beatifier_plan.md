MindsKit — Screenshot Beautifier v1

You are implementing a new tool for MindsKit called **Screenshot Beautifier**.

The goal is to let users turn a plain screenshot into a polished shareable image directly in the browser.

This tool should remain:

- Client-side
- Privacy-focused
- Lightweight
- Fast
- Consistent with the existing MindsKit architecture and design system

Do not add a backend.

Do not upload user images anywhere.

User images must remain in the browser.

---

## Before Editing

Before implementing:

1. Inspect the current repository structure.
2. Read the existing feature patterns under `src/features/*`.
3. Reuse existing UI, theme, utility, and routing conventions.
4. Do not redesign unrelated architecture.
5. Prefer small, isolated changes.
6. Preserve current naming conventions.
7. Follow existing AGENTS.md instructions.

If the repository already has image utilities, canvas utilities, download helpers, theme components, or shared form controls, reuse them rather than creating duplicate abstractions.

---

# Tool Name

Screenshot Beautifier

Suggested description:

Create polished screenshots with gradients, frames, spacing, shadows, and perspective — directly in your browser.

---

# Scope

Implement Screenshot Beautifier v1 only.

Features:

- Upload screenshot
- Paste screenshot from clipboard
- Drag and drop screenshot
- Solid background
- Gradient background
- Gradient presets
- Padding control
- Border radius control
- Shadow control
- Canvas size presets
- Basic browser frame
- Basic device frames
- Screenshot scale
- Screenshot position
- Basic perspective / tilt
- Export PNG
- Export JPG
- Copy image to clipboard
- Reset to default

Do not implement v2 features yet.

Do not implement:

- Custom background images
- Pattern backgrounds
- Text layers
- Watermarks
- Logos
- Multiple screenshot layouts
- Saved custom presets
- Advanced device mockups
- Freeform graphic editing
- Layer panels
- Drawing tools

---

# Privacy

All processing must happen locally in the browser.

Do not:

- Upload images
- Send images to external APIs
- Persist screenshot content in localStorage
- Persist screenshot content in IndexedDB
- Log image content
- Send image content to analytics

Temporary image state may live in memory or Blob/Object URLs.

When Object URLs are no longer needed, revoke them.

Only non-sensitive tool preferences may be stored locally if the existing application already supports that pattern.

Examples:

- Last selected canvas preset
- Last selected gradient preset
- Last selected frame type

Do not persist the actual screenshot.

---

# Suggested User Flow

1. User opens Screenshot Beautifier.
2. User uploads, drops, or pastes a screenshot.
3. Screenshot appears on the canvas.
4. User adjusts background, padding, radius, shadow, frame, scale, position, and tilt.
5. User previews the result live.
6. User exports PNG/JPG or copies the result.
7. User can reset the design to defaults.

The tool should feel immediate and visual.

Avoid requiring an explicit "Apply" action for every setting.

Most settings should update the preview live.

---

# Page Layout

Use a creator-tool layout rather than an admin-style layout.

Desktop recommendation:

Left side:

- Controls / inspector

Right side:

- Large preview canvas

Suggested structure:

Screenshot Beautifier

[ Upload / Paste / Drop screenshot ]

---

Settings Preview

Canvas [ large preview area ]
Background
Gradient
Spacing
Screenshot
Frame
Perspective

---

[ Reset ] [ Copy ] [ Export ]

The preview should receive most of the horizontal space.

Recommended approximate desktop split:

- Controls: 280–340px
- Preview: remaining width

Do not use a wide navigation-style sidebar for tool controls.

The control panel should feel like a design inspector.

---

# Mobile Layout

On mobile:

- Preview should remain visible and usable.
- Controls may appear below the preview or inside collapsible groups.
- Avoid horizontal overflow.
- Buttons must remain touch friendly.
- Do not require precise drag interactions for basic usage.

A simple stacked layout is acceptable:

Preview
Controls
Export actions

---

# Image Input

Support:

- PNG
- JPEG / JPG
- WEBP if the existing app already supports it cleanly

Input methods:

- File picker
- Drag and drop
- Clipboard paste

Use browser-native APIs where possible.

Suggested APIs:

- File
- Blob
- URL.createObjectURL
- createImageBitmap
- Clipboard API

Show useful image information after loading:

- Filename
- Width × height
- File type
- File size

---

# Image Validation

Validate input before processing.

Suggested initial limits:

- Maximum file size: around 20 MB
- Maximum image dimensions: around 10,000 × 10,000

These values may be adjusted if existing MindsKit conventions already define limits.

Handle invalid files gracefully.

Examples:

- Unsupported image type
- Image too large
- Failed image decoding
- Clipboard does not contain an image

Show a clear inline error or toast using the existing notification system.

Do not crash the page.

---

# Preview Canvas

The preview should represent the final exported image as closely as practical.

Recommended approach:

Build the composition using regular HTML/CSS first.

Composition:

Canvas

- Background
- Frame
- Screenshot
- Shadow
- Radius
- Transform

Then export the composed result using a suitable DOM-to-image solution if the repository already has one.

If no export solution exists, choose a lightweight, actively maintained library suitable for client-side PNG/JPG export.

Avoid introducing a heavy canvas/editor framework unless necessary.

Do not use Fabric.js, Konva, or similar large scene-graph libraries for v1 unless the current architecture already depends on one.

Keep v1 simple.

---

# Canvas Size Presets

Provide common presets.

Suggested presets:

- Auto
- 16:9
- 4:3
- 1:1
- 3:2
- 9:16

Optional named presets if easy:

- X / Twitter post
- Instagram square
- Instagram portrait

Do not add too many social presets in v1.

For Auto:

Canvas size should adapt naturally around the screenshot and selected padding.

---

# Background

Support:

1. Solid color
2. Gradient

Solid:

- Color picker
- Hex input if existing controls support it

Gradient:

Support at least:

- Linear gradient
- Two colors
- Angle

Suggested controls:

Gradient color A
Gradient color B
Angle

---

# Gradient Presets

Include a small curated preset list.

Suggested examples:

- Midnight Violet
- Aurora Blue
- Cyber Rose
- Sunset Ember
- Emerald
- Soft Peach

Presets should be visually distinct but still fit the MindsKit design language.

Do not create dozens of presets.

Around 6–10 presets is enough for v1.

The user should still be able to customize the gradient after selecting a preset.

---

# Padding

Provide a simple control.

Suggested range:

0–200px

Default:

Around 64px

Use a slider plus numeric value if that matches existing MindsKit controls.

Padding should update the preview live.

---

# Border Radius

Apply radius to the screenshot/frame.

Suggested range:

0–48px

Default:

Around 12–16px

If a browser/device frame is active, apply radius appropriately so the screenshot does not visually break the frame.

---

# Shadow

Provide a simple shadow intensity control.

Suggested options:

- None
- Soft
- Medium
- Strong

or use a slider.

Do not expose dozens of raw CSS shadow values in v1.

Internally it may map to predefined shadows.

Example conceptual values:

None
Soft
Medium
Strong

Keep shadows subtle and modern.

---

# Screenshot Scale

Allow the user to resize the screenshot inside the canvas.

Suggested range:

50%–120%

Default:

100%

Scaling should preserve aspect ratio.

Do not allow accidental image distortion.

---

# Screenshot Position

Support simple positioning.

At minimum:

- Center
- Top
- Bottom
- Left
- Right

If easy and stable, allow drag-to-position inside the preview.

However, drag positioning is optional for v1.

Do not let drag behavior delay the whole feature.

A simple position control is acceptable.

---

# Browser Frame

Provide a basic generic browser frame.

Suggested variants:

- None
- Minimal browser
- macOS-style browser

Do not copy Chrome/Safari branding exactly.

Use neutral generic browser chrome.

Possible elements:

- Top bar
- Three window dots
- Optional address bar decoration

The frame must remain decorative.

Do not make it interactive.

---

# Device Frames

Keep device frames basic.

Suggested v1 options:

- None
- Phone portrait
- Phone landscape
- Laptop / desktop

Use generic frames.

Do not model specific Apple, Samsung, Google, or other commercial device designs.

Avoid complex photorealistic mockups.

Use clean CSS/SVG-style frames consistent with MindsKit.

---

# Perspective / Tilt

Provide simple visual perspective presets.

Suggested options:

- None
- Tilt Left
- Tilt Right
- Tilt Up
- Tilt Down

Optionally expose lightweight sliders:

- Rotate X
- Rotate Y

Suggested limits:

Around -15deg to +15deg

Do not create a full 3D editor.

The goal is a small visual enhancement.

Perspective must remain stable during export.

---

# Reset

Provide a Reset button.

Reset should restore design settings to defaults while preserving the currently loaded screenshot unless the existing UX convention suggests otherwise.

Suggested reset behavior:

Reset:

- Background
- Gradient
- Padding
- Radius
- Shadow
- Scale
- Position
- Frame
- Perspective

Keep screenshot loaded.

A separate Remove Image action may clear the screenshot.

---

# Export

Support:

- PNG
- JPG

PNG:

- Preserve high visual quality
- Prefer transparency only if the selected design actually uses transparency

JPG:

- Use an opaque background
- Warn or handle transparency automatically
- Provide a reasonable quality default such as 90%

Suggested export naming:

mindskit-screenshot.png
mindskit-screenshot.jpg

If the original filename is available, a descriptive output is also acceptable.

Example:

my-dashboard-beautified.png

---

# Export Resolution

Do not export at visibly blurry browser preview resolution.

Aim for high-resolution export.

A practical approach is to render at 2x pixel density when feasible.

Example:

Preview:
1200 × 675

Export:
2400 × 1350

Do not create extreme output sizes that may crash mobile browsers.

Use sensible limits.

---

# Copy Image

Use the Clipboard API where supported.

Copy the generated image as PNG.

If image clipboard writing is unsupported:

- Show a clear message
- Keep Download available as fallback

Do not silently fail.

---

# Loading / Processing States

Export may take noticeable time for large screenshots.

Provide clear state:

- Preparing image...
- Exporting...
- Copied

Disable duplicate export actions while processing if necessary.

---

# Performance

Avoid repeatedly decoding the original image on every setting change.

Decode once and reuse the loaded image representation.

Avoid storing large Base64 strings in React state.

Prefer:

- File
- Blob
- Object URL
- ImageBitmap where appropriate

Clean up resources when replacing or removing an image.

Do not process multiple unnecessary full-resolution copies.

---

# Accessibility

Controls must:

- Have labels
- Be keyboard accessible
- Have visible focus states
- Not rely only on color

The preview should have useful accessible text.

Buttons such as Export, Copy, Reset, Upload, and Remove must have clear labels.

---

# Themes

The tool must work with existing MindsKit themes.

The creator UI itself should use existing theme tokens.

The export canvas background is independent from the MindsKit UI theme.

Example:

User may use Midnight Violet UI theme while exporting a white/blue screenshot composition.

Do not automatically force export background based on the app theme.

---

# Suggested Internal Model

Use a single serializable design state.

Example shape:

type ScreenshotDesign = {
canvasPreset: string
background: {
type: "solid" | "gradient"
color?: string
gradientStart?: string
gradientEnd?: string
gradientAngle?: number
preset?: string
}
padding: number
radius: number
shadow: string
scale: number
position: string
frame: string
perspective: {
rotateX: number
rotateY: number
}
}

Adapt the names to existing project conventions.

Do not blindly use this exact type if the repository already has a better established model pattern.

---

# Suggested Feature Structure

Prefer a structure similar to:

src/features/screenshot-beautifier/

- components/
- screenshot-beautifier.tsx
- model.ts
- export.ts
- image.ts
- presets.ts

Exact file names should follow existing MindsKit conventions.

Before creating files, inspect nearby features and match the repository's established naming style.

---

# Routing

Add Screenshot Beautifier to the existing tool registry and navigation.

Suggested category:

Image Tools

Suggested route:

/image/screenshot-beautifier

If the existing route convention differs, follow the existing convention.

Do not introduce a parallel routing pattern.

---

# Tool Registry

Add metadata using the existing centralized tool registry.

Suggested metadata:

Name:
Screenshot Beautifier

Description:
Create polished screenshots with gradients, frames, spacing, shadows, and perspective.

Category:
Image Tools

Use an existing Lucide icon if the registry supports icons.

Do not add a custom icon dependency for this tool.

---

# Tests

Test pure logic where practical.

Good unit-test candidates:

- Canvas preset dimension calculation
- Aspect-ratio-safe scale logic
- Gradient preset lookup
- Reset-to-default behavior
- Export filename generation
- File validation
- Design-state normalization

Do not try to fully test browser rendering through Node-only unit tests.

Use the existing project testing conventions.

---

# Manual Verification

Before finishing, manually verify:

1. Upload PNG
2. Upload JPG
3. Paste image from clipboard
4. Drag/drop image
5. Solid background
6. Gradient background
7. Gradient preset
8. Padding
9. Border radius
10. Shadow
11. Canvas presets
12. Browser frame
13. Device frame
14. Scale
15. Position
16. Perspective
17. Reset
18. PNG export
19. JPG export
20. Copy image
21. Light theme
22. Dark theme
23. Mobile layout
24. Large image handling
25. Invalid input handling

---

# Important Constraints

Keep v1 focused.

Do not turn Screenshot Beautifier into a general graphic editor.

Do not add:

- Text layers
- Multiple images
- Watermarks
- Stickers
- Shapes
- Free drawing
- Layer management
- Background image uploads
- Pattern editor
- Saved custom presets

Those belong to future work.

---

# Quality Requirements

Before finishing:

- Run formatting
- Run lint if configured
- Run TypeScript checks
- Run existing relevant tests
- Run production build
- Fix all introduced errors
- Verify there are no obvious memory leaks from Object URLs
- Verify export works in both light and dark MindsKit themes

Do not modify unrelated features.

---

# Final Response

When complete, summarize:

- Files created/changed
- Dependencies added
- Features implemented
- Export approach used
- Browser APIs used
- Test/build results
- Any known browser limitations
- Anything intentionally deferred to Screenshot Beautifier v2

Do not implement v2 items unless explicitly requested.
