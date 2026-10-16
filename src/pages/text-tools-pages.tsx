import {
  AlignLeft,
  Bold,
  Combine,
  Eraser,
  Heading,
  SplitSquareHorizontal,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { TextTransformPage } from "@/components/tool/text-transform-page";
import {
  decorateText,
  formatMarkdown,
  joinText,
  removeSpaces,
  splitText,
  textOperations,
} from "@/features/text-tools/text";

export function RemoveSpacesPage() {
  return (
    <TextTransformPage
      title="Remove Spaces"
      description="Remove whitespace or clean up extra spaces in your text."
      actionLabel="Remove Spaces"
      actionIcon={Eraser}
      storageKey="remove-spaces"
      inputPlaceholder="Paste text here…"
      sample={"  MindsKit   keeps   your\ntext tidy.  "}
      process={removeSpaces}
      operations={textOperations.removeSpaces}
    />
  );
}

export function MakeOneLinePage() {
  return (
    <TextTransformPage
      title="Make One Line"
      description="Join multi-line text using a space, no separator, or your own separator."
      actionLabel="Make One Line"
      actionIcon={AlignLeft}
      storageKey="make-one-line"
      inputPlaceholder="Paste multi-line text here…"
      sample={"MindsKit\nturns text\ninto one line."}
      process={joinText}
      delimiter={{
        label: "Separator",
        placeholder: "Space, blank, or custom text",
        defaultValue: " ",
      }}
    />
  );
}

export function TextDecorationPage() {
  return (
    <TextTransformPage
      title="Text Decoration"
      description="Change letter case or wrap text with a prefix and suffix."
      actionLabel="Transform"
      actionIcon={Bold}
      storageKey="text-decoration"
      inputPlaceholder="Paste text here…"
      sample="make this text easier to read"
      process={decorateText}
      operations={textOperations.decoration}
      affixes
    />
  );
}

export function MarkdownPage() {
  return (
    <TextTransformPage
      title="Markdown"
      description="Apply Markdown emphasis and see the rendered result instantly."
      actionLabel="Apply"
      actionIcon={Heading}
      storageKey="markdown"
      inputPlaceholder="Paste text here…"
      sample="Make this stand out"
      process={formatMarkdown}
      operations={[
        { label: "None", value: "none" },
        { label: "Bold", value: "bold" },
        { label: "Italic", value: "italic" },
      ]}
      language="markdown"
      outputPreview={(output) => (
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
        </div>
      )}
    />
  );
}

export function SplitTextPage() {
  return (
    <TextTransformPage
      title="Split Text"
      description="Split text at a delimiter and put each part on its own line."
      actionLabel="Split Text"
      actionIcon={SplitSquareHorizontal}
      storageKey="split-text"
      inputPlaceholder="Paste text to split…"
      sample="red,green,blue"
      process={splitText}
      delimiter={{
        label: "Delimiter",
        placeholder: "Comma",
        defaultValue: ",",
      }}
    />
  );
}

export function JoinTextPage() {
  return (
    <TextTransformPage
      title="Join Text"
      description="Join every line of text using a separator of your choice."
      actionLabel="Join Text"
      actionIcon={Combine}
      storageKey="join-text"
      inputPlaceholder="Paste one item per line…"
      sample={"red\ngreen\nblue"}
      process={joinText}
      delimiter={{
        label: "Separator",
        placeholder: "Comma",
        defaultValue: ",",
      }}
    />
  );
}
