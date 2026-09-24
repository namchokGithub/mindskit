<h1>
  MindsKit
  <img
    src="src/assets/mindskit-logo2.png"
    alt="Logo"
    width="48"
    height="48"
    align="center"
  />
</h1>

> A privacy-first developer toolbox that runs entirely in your browser.

![Version](https://img.shields.io/badge/version-0.2.1-ad60fb?style=flat-square)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/) [![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vite.dev/)

MindsKit is a focused collection of tools for formatting data, transforming text, encoding values, and generating identifiers. Paste your content, process it locally, and copy the result—nothing is uploaded to a server.

## Available tools

### Formatters

- JSON Formatter, Minifier, and Validator
- JSON Data Generator for schema-based fictional records, with copy/download and transfer to SQL INSERT
- XML Formatter, Minifier, and Validator

### SQL

- SQL Formatter with PostgreSQL, MySQL, and SQL Server dialects, indentation, and keyword casing
- SQL Minifier that removes comments and unnecessary whitespace while keeping quoted values and identifiers intact
- SQL Parameters Preview for `?`, `$1`, and `:name` placeholders with JSON values; output is for debugging only
- CREATE TABLE → Types for common scalar columns in TypeScript or Go
- SQL Syntax Checker for parser-level checks against PostgreSQL, MySQL, or SQL Server
- SQL IN Builder for UUIDs, text, or numbers, with input separators, duplicate removal, and `IN` / `NOT IN`; the existing `/formatters/sql-in` link remains valid
- JSON / CSV → INSERT with schema/table naming, identifier and literal escaping, `NULL` handling, and batches of 1–1000 rows
- Copy or download generated SQL as a `.sql` file; all processing stays in the browser and no queries are executed

CSV requires a header and preserves values as text, including leading zeros. Empty fields can optionally become `NULL`. JSON requires a flat array of objects; missing fields become `NULL`, and large integers should be supplied as strings. The formatter does not support stored procedures or custom delimiters.

### Text tools

- Remove Spaces
- Make One Line, with a custom separator
- Text Decoration: case transforms plus prefix and suffix wrapping
- Markdown: bold and italic transforms with a rendered Markdown preview
- Split Text and Join Text
- README Builder: compose a structured README from templates and a section library, with a GitHub-style preview, Markdown import/export, and local-only drafts (browser storage, not sent anywhere)

### Encode / Decode

- Base64 Encode / Decode
- URL Encode / Decode
- HTML Encode / Decode
- JWT Decoder, with formatted header/payload inspection and expiry status (decoding only; no signature verification)

### Generators

- UUID v4, generated in batches of 1, 5, 10, or a custom amount up to 200
- Random String, with configurable count, length, character sets, uniqueness, prefix/suffix, and separators
- Strong Password Generator with cryptographically secure Random, Memorable, and PIN modes; strength/entropy feedback; character exclusions; and no local password storage
- QR Code generator, with size/error-correction options and PNG download
- Barcode generator (Code 128, Code 39, EAN-13, EAN-8, and UPC-A), with SVG download

### Converters

- Unix Timestamp ↔ ISO date/time, with browser-local timezone by default and searchable timezone selection
- JSON → YAML, with copy and YAML-file download
- JSON → CSV for arrays of objects, with copy and CSV-file download
- JSON → Go Struct and JSON → TypeScript type generation
- JSON ↔ XML conversion
- Number Base Converter for binary, octal, decimal, and hexadecimal values
- Letters ↔ Numbers for A1Z26, reverse alphabet, printable ASCII, and Roman numeral mappings
- Color Converter for HEX, RGB, and HSL formats
- Date Formatter for common date-time formats and time zones
- Roman Numeral Date Converter for Gregorian `YYYY-MM-DD` / `DD/MM/YYYY` dates and `DD/MM/YYYY` Roman numeral dates

### Image tools

- Image Resize for PNG, JPEG, and WebP: export one uploaded image at multiple pixel or percentage sizes, processed sequentially in the browser, with an individual download for every result
- Image Crop with freeform and preset aspect ratios
- Remove Background using an in-browser AI model

## Themes

Choose the system theme or one of six built-in themes. Light themes appear first in the picker:

- Pearl Light, Mint Frost, Amber Dawn
- Midnight Violet, Aurora Blue, Cyber Rose

The shared app shell layers the transparent [background artwork](src/assets/bg.png) at the bottom of the viewport behind the interface. It preserves the artwork's aspect ratio and adapts to every theme without affecting editor or card readability.

## Privacy

All processing happens in the browser. Pasted text and generated values are not sent to a server or third-party API. Saving input locally is optional and off by default; generated passwords are never saved locally.

## Tech stack

- [Vite](https://vite.dev/)
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/)
- [React Router](https://reactrouter.com/)
- [CodeMirror](https://codemirror.net/) for JSON, XML, Markdown, and TypeScript editing
- [sql-formatter](https://github.com/sql-formatter-org/sql-formatter) for dialect-aware SQL formatting
- [react-markdown](https://github.com/remarkjs/react-markdown) for Markdown previews
- [qrcode](https://github.com/soldair/node-qrcode), [JsBarcode](https://github.com/lindell/JsBarcode), and [yaml](https://github.com/eemeli/yaml) for client-side generators and conversions

## Getting started

### Prerequisites

- Node.js 20 or newer
- [pnpm](https://pnpm.io/)

### Install and run

```bash
git clone https://github.com/namchokGithub/mheemindskit.git
cd mheemindskit
pnpm install
pnpm dev
```

The development server opens at [http://localhost:5173](http://localhost:5173).

### Quality checks

```bash
pnpm lint
pnpm build
pnpm test:sql # SQL and JSON generator regression tests; requires Node.js 22.18+ or 24+
```

### Deployment

MindsKit is a static single-page application. Deploy it to a static host such as Cloudflare Pages with:

- Build command: `pnpm build`
- Output directory: `dist`
- SPA redirects: `public/_redirects`

## License

[MIT](LICENSE)

---

© _2026 Namchok Singhachai_. MindsKit is released under the MIT License.
