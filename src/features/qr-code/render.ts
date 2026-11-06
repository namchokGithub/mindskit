import QRCode from "qrcode";

export type QrLevel = "L" | "M" | "Q" | "H";
export type QrShape = "square" | "rounded" | "dots" | "diamond";
export type QrEye = "square" | "rounded" | "circle";
export type QrFrame = "none" | "outline" | "corners" | "caption";

export interface QrStyle {
  size: number;
  level: QrLevel;
  shape: QrShape;
  outerEye: QrEye;
  innerEye: QrEye;
  frame: QrFrame;
  foreground: string;
  background: string;
  transparent: boolean;
  caption: string;
  logoUrl: string;
  logoSize: number;
  logoBackground: boolean;
}

export const defaultQrStyle: QrStyle = {
  size: 256,
  level: "M",
  shape: "square",
  outerEye: "square",
  innerEye: "square",
  frame: "none",
  foreground: "#000000",
  background: "#ffffff",
  transparent: false,
  caption: "",
  logoUrl: "",
  logoSize: 20,
  logoBackground: true,
};

export function isFinderModule(row: number, col: number, count: number): boolean {
  return (row < 7 && col < 7) ||
    (row < 7 && col >= count - 7) ||
    (row >= count - 7 && col < 7);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the selected logo."));
    image.src = url;
  });
}

function drawEye(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  outer: QrEye,
  inner: QrEye,
  color: string,
  background: string,
) {
  const tile = unit * 7;
  const draw = (left: number, top: number, width: number, style: QrEye) => {
    context.beginPath();
    if (style === "circle") {
      context.arc(left + width / 2, top + width / 2, width / 2, 0, Math.PI * 2);
    } else {
      context.roundRect(left, top, width, width, style === "rounded" ? width * 0.28 : 0);
    }
    context.fill();
  };
  context.fillStyle = color;
  draw(x, y, tile, outer);
  context.fillStyle = background;
  draw(x + unit, y + unit, unit * 5, outer);
  context.fillStyle = color;
  draw(x + unit * 2, y + unit * 2, unit * 3, inner);
}

export async function renderQrCode(value: string, style: QrStyle): Promise<string> {
  const matrix = QRCode.create(value, { errorCorrectionLevel: style.level }).modules;
  const size = Math.max(128, Math.min(1024, style.size || 256));
  const frameInset = style.frame === "none" ? 0 : Math.max(10, Math.round(size * 0.045));
  const captionHeight = style.frame === "caption" ? Math.max(35, Math.round(size * 0.17)) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = size + frameInset * 2;
  canvas.height = size + frameInset * 2 + captionHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  const background = style.transparent ? "#ffffff" : style.background;
  if (!style.transparent) {
    context.fillStyle = style.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const margin = 4;
  const unit = size / (matrix.size + margin * 2);
  const origin = frameInset + margin * unit;
  context.fillStyle = style.foreground;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (!matrix.get(row, col) || isFinderModule(row, col, matrix.size)) continue;
      const x = origin + col * unit;
      const y = origin + row * unit;
      if (matrix.reservedBit[row * matrix.size + col]) {
        context.fillRect(x, y, unit + 0.08, unit + 0.08);
        continue;
      }
      context.beginPath();
      if (style.shape === "dots") {
        context.arc(x + unit / 2, y + unit / 2, unit * 0.43, 0, Math.PI * 2);
      } else if (style.shape === "diamond") {
        context.moveTo(x + unit / 2, y);
        context.lineTo(x + unit, y + unit / 2);
        context.lineTo(x + unit / 2, y + unit);
        context.lineTo(x, y + unit / 2);
        context.closePath();
      } else {
        context.roundRect(x, y, unit + 0.08, unit + 0.08, style.shape === "rounded" ? unit * 0.3 : 0);
      }
      context.fill();
    }
  }

  for (const [row, col] of [[0, 0], [0, matrix.size - 7], [matrix.size - 7, 0]]) {
    drawEye(context, origin + col * unit, origin + row * unit, unit, style.outerEye, style.innerEye, style.foreground, background);
  }

  if (style.logoUrl) {
    const image = await loadImage(style.logoUrl);
    const logoSize = size * Math.max(0.12, Math.min(0.26, style.logoSize / 100));
    const center = frameInset + size / 2;
    if (style.logoBackground) {
      const pad = logoSize * 0.18;
      context.fillStyle = background;
      context.beginPath();
      context.roundRect(center - logoSize / 2 - pad, center - logoSize / 2 - pad, logoSize + pad * 2, logoSize + pad * 2, logoSize * 0.18);
      context.fill();
    }
    context.drawImage(image, center - logoSize / 2, center - logoSize / 2, logoSize, logoSize);
  }

  if (style.frame !== "none") {
    context.strokeStyle = style.foreground;
    context.lineWidth = Math.max(2, size * 0.008);
    if (style.frame === "outline" || style.frame === "caption") {
      context.strokeRect(frameInset / 2, frameInset / 2, canvas.width - frameInset, canvas.height - frameInset);
    } else {
      const length = size * 0.13;
      const left = frameInset / 2;
      const top = frameInset / 2;
      const right = canvas.width - left;
      const bottom = canvas.height - top;
      context.beginPath();
      for (const [x, y, dx, dy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
        context.moveTo(x + dx * length, y);
        context.lineTo(x, y);
        context.lineTo(x, y + dy * length);
      }
      context.stroke();
    }
    if (style.frame === "caption" && style.caption.trim()) {
      context.fillStyle = style.foreground;
      context.font = `600 ${Math.max(13, Math.round(size * 0.055))}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(style.caption.trim(), canvas.width / 2, frameInset + size + captionHeight / 2, size * 0.86);
    }
  }
  return canvas.toDataURL("image/png");
}
