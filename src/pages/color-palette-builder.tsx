import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, Eraser, FileText, GripVertical, Pipette, Plus, Trash2 } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useRef, useState, type ReactNode } from "react";

import { MotionProvider } from "@/components/motion/motion-provider";

import { ToolStatus } from "@/components/tool/tool-status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_PALETTE_COLORS,
  extractColorsFromText,
  formatPaletteForCopy,
  isValidHexColor,
  normalizeHexColor,
  paletteSampleText,
  readableTextColor,
} from "@/features/color-palette";
import { useCopy } from "@/hooks/use-copy";
import { useListAutoAnimate } from "@/hooks/use-list-auto-animate";
import { fadeVariants, listContainerVariants, listItemVariants, popVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";

type PaletteItem = { id: number; name: string; hex: string };
type Notice = { state: "valid" | "invalid"; message: string } | null;

const fieldClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

/** Six-digit form for `<input type="color">`, which rejects #RGB. */
function toPickerValue(hex: string) {
  const value = normalizeHexColor(hex).slice(1);
  return `#${value.length === 3 ? [...value].map((character) => character.repeat(2)).join("") : value}`.toLowerCase();
}

export function ColorPaletteBuilder({ converter }: { converter: ReactNode }) {
  return (
    <MotionProvider>
      <PaletteWorkspace converter={converter} />
    </MotionProvider>
  );
}

function PaletteWorkspace({ converter }: { converter: ReactNode }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [batch, setBatch] = useState(0);
  const nextId = useRef(1);
  const { copied, copy } = useCopy();
  const stripRef = useListAutoAnimate<HTMLDivElement>();

  const toItems = (colors: { name: string; hex: string }[]) =>
    colors.map((color) => ({ id: nextId.current++, ...color }));
  const validColors = items
    .filter((item) => isValidHexColor(item.hex))
    .map((item) => ({ name: item.name.trim() || "Untitled", hex: normalizeHexColor(item.hex) }));
  const invalidCount = items.length - validColors.length;
  const isFull = items.length >= MAX_PALETTE_COLORS;

  const extract = () => {
    const colors = extractColorsFromText(text);
    if (colors.length === 0) {
      setNotice({ state: "invalid", message: "No HEX colors found. Use #RGB or #RRGGBB, for example #D5C49A." });
      return;
    }
    setItems(toItems(colors.slice(0, MAX_PALETTE_COLORS)));
    // A new key swaps the whole palette so the extracted cards stagger in together.
    setBatch((current) => current + 1);
    setNotice(
      colors.length > MAX_PALETTE_COLORS
        ? { state: "invalid", message: `Found ${colors.length} colors. Only the first ${MAX_PALETTE_COLORS} were kept.` }
        : { state: "valid", message: `Extracted ${colors.length} ${colors.length === 1 ? "color" : "colors"}.` },
    );
  };

  const clear = () => {
    setText("");
    setItems([]);
    setNotice(null);
  };

  const addColor = () => {
    if (isFull) return;
    setItems((current) => [...current, ...toItems([{ name: `Color ${current.length + 1}`, hex: "#7C3AED" }])]);
  };

  const updateItem = (id: number, patch: Partial<Omit<PaletteItem, "id">>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const removeItem = (id: number) => setItems((current) => current.filter((item) => item.id !== id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.id === active.id);
      const to = current.findIndex((item) => item.id === over.id);
      return from === -1 || to === -1 ? current : arrayMove(current, from, to);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {converter}
        <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-sm font-medium text-foreground">Extract colors from text</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste a color spec, notes, or Markdown. HEX colors (#RGB, #RRGGBB) are found in order, and a label on the
              same line or at the top of the paragraph becomes the color name.
            </p>
          </div>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Text to extract colors from"
            placeholder={"Primary Pearl Gold\n#D5C49A"}
            className="min-h-48 resize-y font-mono field-sizing-fixed"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={extract} disabled={!text.trim()}>
              <Pipette />
              Extract
            </Button>
            <Button type="button" variant="outline" onClick={() => setText(paletteSampleText)}>
              <FileText />
              Sample
            </Button>
            <Button type="button" variant="secondary" onClick={clear} disabled={!text && items.length === 0}>
              <Eraser />
              Clear
            </Button>
          </div>
          {notice && (
            <ToolStatus state={notice.state} message={notice.message} validLabel={notice.message} />
          )}
        </section>
      </div>

      <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-foreground">Palette</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {items.length} / {MAX_PALETTE_COLORS} colors
              {isFull && " · Limit reached"}
              {invalidCount > 0 && ` · ${invalidCount} invalid ${invalidCount === 1 ? "color is" : "colors are"} skipped when copying`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addColor} disabled={isFull}>
              <Plus />
              Add color
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void copy(formatPaletteForCopy(validColors))}
              disabled={validColors.length === 0}>
              <CopyStateIcon copied={copied} />
              Copy all colors
            </Button>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {items.length === 0 ? (
            <m.div
              key="empty"
              variants={fadeVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No colors yet.</p>
              <p className="text-xs text-muted-foreground/80">Extract colors from text or use Add color.</p>
            </m.div>
          ) : (
            <m.div
              key={`palette-${batch}`}
              variants={listContainerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex flex-col gap-4">
              <div ref={stripRef} className="flex h-16 overflow-hidden rounded-xl border border-border" aria-hidden="true">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "min-w-0 flex-1 transition-colors duration-200 ease-out motion-reduce:transition-none",
                      !isValidHexColor(item.hex) && "bg-muted",
                    )}
                    style={isValidHexColor(item.hex) ? { backgroundColor: normalizeHexColor(item.hex) } : undefined}
                  />
                ))}
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                    <AnimatePresence>
                      {items.map((item, index) => (
                        <PaletteCard
                          key={item.id}
                          item={item}
                          index={index}
                          onChange={(patch) => updateItem(item.id, patch)}
                          onRemove={() => removeItem(item.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </SortableContext>
              </DndContext>
            </m.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

/** Copy/Check icon swap with a small pop. */
function CopyStateIcon({ copied }: { copied: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.span
        key={copied ? "check" : "copy"}
        variants={popVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        className="inline-flex">
        {copied ? <Check className="text-success" /> : <Copy />}
      </m.span>
    </AnimatePresence>
  );
}

function PaletteCard({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: PaletteItem;
  index: number;
  onChange: (patch: Partial<Omit<PaletteItem, "id">>) => void;
  onRemove: () => void;
}) {
  const valid = isValidHexColor(item.hex);
  const hex = valid ? normalizeHexColor(item.hex) : "";
  const label = item.name.trim() || `Color ${index + 1}`;
  const { copied, copy } = useCopy();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    // Let dnd-kit also slide the remaining cards into place after one is removed.
    animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
  });

  return (
    // Motion animates enter/exit on the <li>; dnd-kit owns the transform of the inner wrapper, so the two never fight.
    <m.li variants={listItemVariants} exit="exit" className="min-w-0">
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn("h-full", isDragging && "relative z-10")}>
        <div
          className={cn(
            "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
            isDragging && "opacity-80 shadow-lg ring-2 ring-ring hover:translate-y-0",
          )}>
          <div
            className={cn(
              "flex h-28 flex-col justify-between gap-2 p-3 transition-colors duration-200 ease-out motion-reduce:transition-none",
              !valid && "bg-muted text-muted-foreground",
            )}
            style={valid ? { backgroundColor: hex, color: readableTextColor(hex) } : undefined}>
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${label}`}
              className="-m-1 flex size-7 cursor-grab touch-none items-center justify-center self-start rounded-md opacity-70 outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing">
              <GripVertical className="size-4" />
            </button>
            <div className="flex items-end justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
              <span className="shrink-0 font-mono text-xs">{valid ? hex : "Invalid"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-3">
            <input
              value={item.name}
              onChange={(event) => onChange({ name: event.target.value })}
              aria-label={`Name for color ${index + 1}`}
              placeholder={`Color ${index + 1}`}
              className={fieldClass}
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={valid ? toPickerValue(hex) : "#000000"}
                onChange={(event) => onChange({ hex: event.target.value.toUpperCase() })}
                aria-label={`Pick color ${index + 1}`}
                className="h-8 w-9 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
              />
              <input
                value={item.hex}
                onChange={(event) => onChange({ hex: event.target.value })}
                onBlur={() => valid && onChange({ hex })}
                aria-label={`HEX for color ${index + 1}`}
                aria-invalid={!valid}
                spellCheck={false}
                className={cn(fieldClass, "font-mono uppercase aria-invalid:animate-shake motion-reduce:animate-none")}
              />
            </div>
            {!valid && (
              <p className="animate-in text-xs text-destructive fade-in slide-in-from-top-1 duration-200">
                Use #RGB or #RRGGBB.
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!valid} onClick={() => void copy(hex)}>
                <CopyStateIcon copied={copied} />
                Copy
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${label}`}>
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </m.li>
  );
}
