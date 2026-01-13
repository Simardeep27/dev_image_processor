import React, { useMemo, useRef, useState } from "react";
import { usePyodide } from "../hooks/pyodide_caller";


function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function drawImageToCanvas(imgUrl, canvas) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = imgUrl;
  });

  const ctx = canvas.getContext("2d");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);

  return { width: canvas.width, height: canvas.height };
}

export default function GrayscaleDropzone() {
  const { pyodide, ready, loading, error } = usePyodide();

  const inputRef = useRef(null);
  const inCanvasRef = useRef(null);
  const outCanvasRef = useRef(null);

  const [dragOver, setDragOver] = useState(false);
  const [imgInfo, setImgInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  // Python: convert RGBA -> grayscale (luma) -> RGBA
  const pythonCode = useMemo(
    () => `
import numpy as np

def to_grayscale_rgba(flat_rgba, w, h):
    arr = np.array(flat_rgba, dtype=np.uint8)
    if arr.size != w * h * 4:
        raise ValueError(
            f"RGBA size mismatch: got {arr.size}, expected {w*h*4}"
        )

    arr = arr.reshape((h, w, 4))

    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)

    gray = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.uint8)

    arr[:, :, 0] = gray
    arr[:, :, 1] = gray
    arr[:, :, 2] = gray

    return arr.reshape(-1)
`,
    []
  );

  async function loadAndPreview(file) {
    const url = await readFileAsDataURL(file);

    const inCanvas = inCanvasRef.current;
    const outCanvas = outCanvasRef.current;

    const { width, height } = await drawImageToCanvas(url, inCanvas);
    outCanvas.width = width;
    outCanvas.height = height;

    setImgInfo({ width, height });
  }

  function onPickClick() {
    inputRef.current?.click();
  }

  async function onInputChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadAndPreview(file);
    e.target.value = "";
  }

  async function onDrop(e) {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    await loadAndPreview(file);
  }

async function convertToGrayscale() {
  if (!ready || !pyodide) return;


  const inCanvas = inCanvasRef.current;
  const outCanvas = outCanvasRef.current;
  const inCtx = inCanvas.getContext("2d");
  const outCtx = outCanvas.getContext("2d");

  // 🔑 SOURCE OF TRUTH
  const w = inCanvas.width;
  const h = inCanvas.height;

  const imageData = inCtx.getImageData(0, 0, w, h);
  const rgba = new Uint8Array(imageData.data.buffer);

  const start = performance.now();

  setBusy(true);
  try {
    // ensure function exists
    pyodide.runPython(pythonCode);

    pyodide.globals.set("flat_rgba", rgba);
    pyodide.globals.set("w", w);
    pyodide.globals.set("h", h);

    const result = pyodide.runPython(
      "to_grayscale_rgba(flat_rgba, w, h)"
    );

    const outFlat = result.toJs({ create_proxies: false });
    result.destroy?.();

    const out = new ImageData(w, h);
    out.data.set(outFlat);
    outCtx.putImageData(out, 0, 0);

    const url = outCanvas.toDataURL("image/png");
    setDownloadUrl(url);
  } catch (e) {
    console.error("FULL PYTHON ERROR:", e);
    alert(e.message);
  } finally {
    setBusy(false);
    const end = performance.now();
    console.log(`Total conversion time: ${(end - start).toFixed(2)} ms`);
  }
}

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div
        onClick={onPickClick}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        style={{
          border: "2px dashed #bbb",
          borderRadius: 12,
          padding: 18,
          cursor: "pointer",
          background: dragOver ? "#f5f5f5" : "transparent",
          userSelect: "none",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          Drag & drop an image here, or click to select
        </div>
        <div style={{ opacity: 0.75 }}>
          {loading && "Loading Pyodide..."}
          {error && `Pyodide error: ${String(error)}`}
          {ready && !imgInfo && "No image selected yet"}
          {ready && imgInfo && `Loaded: ${imgInfo.width}×${imgInfo.height}`}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onInputChange}
          style={{ display: "none" }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={convertToGrayscale} disabled={!ready || busy || !imgInfo}>
          {busy ? "Converting..." : "Convert to grayscale (Pyodide)"}
        </button>
          {downloadUrl && (
        <a href={downloadUrl} download="grayscale.png"
        style={{
            padding: "6px 12px",
            background: "#222",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 14,
        }}
        >
        Download converted image
        </a>
    )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Original</div>
          <canvas
            ref={inCanvasRef}
            style={{ width: "100%", border: "1px solid #ddd", borderRadius: 10 }}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Grayscale</div>
          <canvas
            ref={outCanvasRef}
            style={{ width: "100%", border: "1px solid #ddd", borderRadius: 10 }}
          />
        </div>
      </div>
    </div>
  );
}
