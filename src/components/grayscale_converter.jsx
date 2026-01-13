import React, { useMemo, useRef, useState } from "react";
import { usePyodide } from "../hooks/pyodide_caller";
import { flushSync } from "react-dom";


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

  const w = inCanvas.width;
  const h = inCanvas.height;

  const imageData = inCtx.getImageData(0, 0, w, h);
  const rgba = new Uint8Array(imageData.data.buffer);

  const minLoaderMs = 300;
  const start = performance.now();

  flushSync(() => setBusy(true));                 // ✅ force render now
  await new Promise((r) => setTimeout(r, 0));     // ✅ allow paint

  try {
    pyodide.runPython(pythonCode);

    pyodide.globals.set("flat_rgba", rgba);
    pyodide.globals.set("w", w);
    pyodide.globals.set("h", h);

    const result = pyodide.runPython("to_grayscale_rgba(flat_rgba, w, h)");
    const outFlat = result.toJs({ create_proxies: false });
    result.destroy?.();

    const out = new ImageData(w, h);
    out.data.set(outFlat);
    outCtx.putImageData(out, 0, 0);

    const url = outCanvas.toDataURL("image/png");
    setDownloadUrl(url);
  } catch (e) {
    console.error("FULL PYTHON ERROR:", e);
    alert(e?.message || "Conversion failed");
  } finally {
    const end = performance.now();
    const remaining = minLoaderMs - (end - start);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

    setBusy(false);
    console.log(`Total conversion time: ${(end - start).toFixed(2)} ms`);
  }
}

  return (
  <div style={styles.page}>
    <div style={styles.container}>
      {/* Dropzone */}
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
          ...styles.dropzone,
          ...(dragOver ? styles.dropzoneActive : {}),
        }}
      >
        <div style={styles.dropTitle}>
          Drag & drop an image here, or click to select
        </div>

        <div style={styles.dropSub}>
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

      {/* Actions */}
      <div style={styles.actions}>
        <button
          onClick={convertToGrayscale}
          disabled={!ready || busy || !imgInfo}
          style={{
            ...styles.button,
            ...( (!ready || busy || !imgInfo) ? styles.buttonDisabled : {}),
          }}
        >
          {busy ? "Converting..." : "Convert to grayscale (Pyodide)"}
        </button>

        {downloadUrl && (
          <a
            href={downloadUrl}
            download="grayscale.png"
            style={styles.linkButton}
          >
            Download converted image
          </a>
        )}
      </div>

      {/* Canvases */}
      <div style={styles.grid}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Original</div>
          <div style={styles.canvasWrap}>
            <canvas ref={inCanvasRef} style={styles.canvas} />
          </div>
        </div>

        <div style={styles.panel}>
        <div style={styles.panelTitle}>Grayscale</div>

        <div style={styles.canvasWrap}>
            <canvas ref={outCanvasRef} style={styles.canvas} />

            {busy && (
            <div style={styles.overlay}>
                <span style={styles.spinner} />
                <div style={{ marginTop: 10, opacity: 0.9 }}>Converting…</div>
            </div>
            )}
        </div>
        </div>
      </div>
    </div>
  </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    padding: 24,
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    alignItems: "stretch",
  },
  container: {
    width: "min(1200px, 100%)",
    display: "grid",
    gap: 16,
  },

  dropzone: {
    width: "100%",
    minHeight: 160,
    border: "2px dashed rgba(255,255,255,0.25)",
    borderRadius: 14,
    padding: 18,
    cursor: "pointer",
    userSelect: "none",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  dropzoneActive: {
    borderColor: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.07)",
  },
  dropTitle: {
    fontWeight: 800,
    marginBottom: 6,
    fontSize: 16,
  },
  dropSub: {
    opacity: 0.75,
    fontSize: 13,
    lineHeight: 1.4,
  },

  actions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  button: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  linkButton: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontSize: 14,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 16,
  },
  panel: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
  },
  panelTitle: {
    marginBottom: 10,
    fontWeight: 700,
    opacity: 0.9,
  },

  canvasWrap: {
    width: "100%",
    aspectRatio: "16 / 10",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.15)",
    position: "relative",
  },
  canvas: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  overlay: {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeContent: "center",
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(2px)",
  textAlign: "center",
},
spinner: {
  width: 18,
  height: 18,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.25)",
  borderTopColor: "rgba(255,255,255,0.9)",
  animation: "spin 0.8s linear infinite",
},
};