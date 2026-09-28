# MindsKit — Screenshot Beautifier v2

You are extending the existing MindsKit Screenshot Beautifier.

Implement v2 only. Assume Screenshot Beautifier v1 already exists and works.

## Before Editing

- Read AGENTS.md and relevant project docs.
- Inspect the current screenshot beautifier implementation first.
- Reuse existing architecture, state model, theme tokens, routing, export pipeline, utilities, and test conventions.
- Do not redesign or rewrite v1 unless required for v2 compatibility.
- Keep changes isolated and follow current naming/file conventions.

## Goal

Expand Screenshot Beautifier from a single-screenshot beautifier into a lightweight mockup/composition tool without turning it into a Canva/Figma-style editor.

## V2 Scope

- Custom background image
- Pattern backgrounds
- Text layer
- Watermark / logo
- Multiple screenshot layouts
- Saved presets
- Advanced device frames

Do not add:

- Freehand drawing
- Arbitrary vector shape editor
- Full layer panel
- Animation/timeline
- Collaboration
- Cloud sync
- Backend
- External image-processing APIs
- AI generation
- Multi-page documents

## Privacy

All processing must remain client-side.

Do not:

- Upload screenshots, background images, logos, or exports
- Send image content to external APIs
- Log image content
- Persist image blobs in presets

Use File/Blob/Object URLs for temporary local images and revoke Object URLs when no longer needed.

Saved presets may store configuration only.

---

## 1. Custom Background Image

Allow a local image as canvas background.

Support:

- PNG
- JPG/JPEG
- WEBP if already supported

Controls:

- Cover / Contain / Fill
- Position: Center / Top / Bottom / Left / Right
- Blur
- Brightness
- Optional overlay color
- Overlay opacity

The background must stay local.

If a preset is saved while a custom background is active, save only its visual settings, not the image. Clearly indicate that the image must be selected again when reusing the preset.

---

## 2. Pattern Backgrounds

Add lightweight generated patterns using CSS, SVG, or Canvas.

Suggested patterns:

- Dots
- Grid
- Diagonal lines
- Noise
- Checker
- Simple waves if easy

Controls:

- Pattern type
- Foreground color
- Background color
- Opacity
- Scale / density
- Rotation where relevant

Do not use remote pattern assets.

---

## 3. Text Layer

Support one or more text layers.

Each layer should support:

- Text content
- Font size
- Font weight
- Text color
- Alignment
- Position
- Rotation
- Opacity
- Optional max width
- Optional line height

Use existing/local fonts only unless the repo already has a safe font-loading strategy.

Actions:

- Add
- Edit
- Move
- Delete
- Duplicate if simple

Reuse existing drag/positioning primitives where possible.

Do not implement a full typography or professional layer system.

Never use dangerous HTML injection for text content.

---

## 4. Watermark / Logo

Allow a local image as a watermark/logo.

Support:

- PNG
- JPG/JPEG
- WEBP if already supported

Controls:

- Scale
- Position
- Opacity
- Rotation
- Margin / offset

Quick positions:

- Top left
- Top right
- Bottom left
- Bottom right
- Center

Do not persist the image binary in saved presets.

---

## 5. Multiple Screenshot Layouts

Support multiple screenshots using predefined templates rather than unrestricted freeform placement.

Suggested layouts:

- Single
- Side by side
- Two stacked
- Main + secondary
- Three-column
- Three-card staggered
- Before / after

Each slot should support:

- Upload / replace
- Remove
- Scale within slot
- Position within slot
- Radius
- Shadow
- Compatible frame selection

Make layout definitions data-driven.

A practical maximum of 3–4 screenshots is acceptable for v2.

Do not build an unlimited layer canvas.

---

## 6. Saved Presets

Allow users to save reusable visual presets locally.

Preset configuration may include:

- Name
- Canvas preset
- Background settings
- Pattern settings
- Padding
- Radius
- Shadow
- Frame
- Perspective
- Layout
- Text-layer configuration
- Watermark configuration excluding image data

Never store:

- Screenshot blobs
- Background image blobs
- Logo/watermark blobs
- Object URLs

Use the repository's existing persistence convention. Prefer existing IndexedDB/storage abstractions instead of creating a parallel system.

Actions:

- Save
- Apply
- Rename
- Delete
- Duplicate if simple

Include a few built-in presets separately from user presets, for example:

- Midnight Glow
- Soft Gradient
- Clean Light
- Product Launch
- Minimal Dark

Built-in presets must not be deletable.

---

## 7. Advanced Device Frames

Extend basic v1 frames with generic frame categories.

Suggested categories:

- Browser
- Desktop
- Laptop
- Tablet
- Phone
- Phone landscape

Possible variants:

- Minimal
- Rounded
- Dark
- Light
- Edge-to-edge

Use generic designs only. Do not reproduce specific branded Apple/Samsung/Google hardware.

Use CSS/SVG/local assets and avoid new external runtime resources.

Ensure screenshot clipping, border radius, perspective, and export remain correct.

---

## 8. Composition Model

Inspect and extend the existing v1 model instead of replacing it.

Keep persistent design state serializable.

A reasonable structure may contain:

- canvas
- background
- layout
- screenshots[]
- textLayers[]
- watermark config
- frame config
- perspective

Separate persistent serializable configuration from transient runtime resources such as:

- File
- Blob
- Object URL
- ImageBitmap
- DOM nodes

This separation is required for reliable presets and cleanup.

---

## 9. Runtime Resource Management

Create a clear lifecycle for screenshots, background images, and watermark/logo images.

When replacing/removing an image:

- Revoke old Object URLs
- Release transient references
- Avoid retaining unnecessary full-resolution copies

Avoid Base64 for large images unless the existing export pipeline requires it.

---

## 10. Export Compatibility

Every v2 feature must work in the existing export pipeline.

Verify export for:

- Custom background
- Patterns
- Text layers
- Watermark/logo
- Multiple screenshots
- Advanced frames
- Perspective

Keep PNG and JPG support.

Preview and export should match as closely as practical.

Do not ship preview-only features that fail during export.

If the existing export dependency has limitations, make the smallest compatible change and document it.

---

## 11. Inspector UX

Extend the current creator inspector rather than introducing admin-style navigation.

Suggested control groups:

- Canvas
- Background
- Pattern
- Layout
- Screenshots
- Text
- Watermark
- Frame
- Perspective
- Presets
- Export

Use collapsible groups/progressive disclosure if the panel becomes long.

Do not show every advanced control at once.

For selected text/watermark elements, show only relevant controls.

Do not create a full layer-management panel in v2.

---

## 12. Responsive Behavior

Desktop:

- Inspector on the left
- Large preview on the right

Mobile:

- Preview first
- Controls below or in tabs/accordions
- Avoid tiny drag handles
- Keep text editing touch-friendly
- Core workflows must not depend on precise pointer interaction

---

## 13. Accessibility

Ensure:

- Controls have labels
- Keyboard focus is visible
- Text editing is keyboard accessible
- Icon-only actions have accessible names
- Contrast remains readable
- Upload areas are keyboard accessible
- Selection state is not indicated by color alone

---

## 14. Performance

Do not decode source images on every setting change.

Reuse loaded resources.

Avoid unnecessary full-resolution rerenders.

If needed:

- Use a practical preview resolution
- Render high resolution only during export

Avoid processing many large screenshots concurrently.

Use sensible image count/dimension limits.

---

## 15. Security

Treat user images and text as untrusted input.

- Do not use dangerouslySetInnerHTML for text layers.
- Do not fetch arbitrary remote user image URLs in v2.
- Custom images must come from local file input/paste/drop only.
- Review CSP before introducing any new runtime resource.
- Prefer same-origin/local resources.

---

## 16. Tests

Add tests for pure logic where practical.

Good candidates:

- Built-in preset lookup
- User preset serialization
- Confirmation that presets exclude blobs/Object URLs
- Layout template definitions
- Slot calculation
- Pattern configuration
- Text layer add/update/remove
- Reset behavior
- Frame configuration
- File validation

Do not add heavy browser rendering tests unless the repo already uses them.

Follow existing test conventions.

---

## 17. Manual Verification

Verify at minimum:

Custom background:

- Upload
- Cover
- Contain
- Blur
- Brightness
- Overlay

Patterns:

- All implemented pattern types
- Opacity
- Scale
- Colors

Text:

- Add
- Edit
- Move
- Rotate
- Style
- Delete
- Multiple text layers

Watermark:

- Upload
- Move
- Scale
- Opacity
- Remove

Layouts:

- Single
- Two screenshots
- Three screenshots
- Replace slot image
- Remove slot image

Presets:

- Save
- Apply
- Rename
- Delete
- Built-in preset protection
- Confirm images are not persisted

Frames:

- Browser
- Desktop/laptop
- Tablet
- Phone
- Implemented variants

Export:

- PNG
- JPG
- Preview and export match closely

Also verify:

- Light theme
- Dark theme
- Desktop
- Tablet
- Mobile
- Large-image handling
- Object URL cleanup

---

## 18. Documentation

Update relevant project documentation with:

- V2 feature list
- Privacy behavior
- Preset persistence behavior
- Supported image formats
- Current screenshot/layout limits
- Export behavior
- Known browser limitations

Do not rewrite unrelated docs.

---

## 19. Quality Gate

Before finishing:

- Run formatter
- Run lint if configured
- Run TypeScript checks
- Run relevant tests
- Run production build
- Fix introduced errors
- Verify Object URL cleanup
- Verify preset serialization
- Verify export for every new composition type
- Verify responsive behavior

Do not modify unrelated features.

---

## Final Response

When complete, summarize:

- Files created/changed
- Dependencies added
- V2 features implemented
- Composition-model changes
- Preset persistence approach
- Export approach
- Test/build results
- Known limitations
- Anything intentionally deferred beyond v2

Keep the implementation focused.

The goal is a lightweight screenshot/mockup creator, not a full graphic-design application.
