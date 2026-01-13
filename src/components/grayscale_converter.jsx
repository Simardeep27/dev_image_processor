import React, { useRef, useState } from "react";
import { usePyodide } from "../hooks/pyodide_caller";
import { readFileAsDataURL, drawImageToCanvas } from "../lib/imageUtils";
import { ensureGrayscaleFn, grayscaleRGBA } from "../lib/pyodideImageOps";
import { styles } from "../styles/grayscaleStyles";

const PY_GRAYSCALE = `
import numpy as np
def to_grayscale_rgba(flat_rgba, w, h):
    arr = np.array(flat_rgba, dtype=np.uint8)
    if arr.size != w * h * 4:
        raise ValueError(f"RGBA size mismatch: got {arr.size}, expected {w*h*4}")
    arr = arr.reshape((h, w, 4))
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    gray = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.uint8)
    arr[:, :, 0] = gray
    arr[:, :, 1] = gray
    arr[:, :, 2] = gray
    return arr.reshape(-1)
`;

export default function GrayscaleDropzone() {
  const { pyodide, ready, loading, error } = usePyodide();

  const inputRef = useRef(null);
  const inCanvasRef = useRef(null);
  const outCanvasRef = useRef(null);

  const [dragOver, setDragOver] = useState(false);
  const [imgInfo, setImgInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  async function loadAndPreview(file) {
    const url = await readFileAsDataURL(file);
    const inCanvas = inCanvasRef.current;
    const outCanvas = outCanvasRef.current;

    const { width, height } = await drawImageToCanvas(url, inCanvas);
    outCanvas.width = width;
    outCanvas.height = height;

    setImgInfo({ width, height });
    setDownloadUrl(null);
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
    if (!file || !file.type.startsWith("image/")) return;
    await loadAndPreview(file);
  }

  function onPickClick() {
    inputRef.current?.click();
  }

  async function convertToGrayscale() {
    if (!ready || !pyodide || !imgInfo) return;

    const inCanvas = inCanvasRef.current;
    const outCanvas = outCanvasRef.current;
    const inCtx = inCanvas.getContext("2d");
    const outCtx = outCanvas.getContext("2d");

    const w = inCanvas.width;
    const h = inCanvas.height;

    const imageData = inCtx.getImageData(0, 0, w, h);
    const rgba = new Uint8Array(imageData.data.buffer);

    setBusy(true);
    const start = performance.now();
    try {
      ensureGrayscaleFn(pyodide, PY_GRAYSCALE);
      const outFlat = grayscaleRGBA(pyodide, rgba, w, h);

      const out = new ImageData(w, h);
      out.data.set(outFlat);
      outCtx.putImageData(out, 0, 0);

      setDownloadUrl(outCanvas.toDataURL("image/png"));
    } catch (e) {
      console.error(e);
      alert(e?.message || "Conversion failed");
    } finally {
      setBusy(false);
      console.log(`Conversion took ${(performance.now() - start).toFixed(2)} ms`);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div
          onClick={onPickClick}
          onDragEnter={(e) => (e.preventDefault(), setDragOver(true))}
          onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
          onDragLeave={(e) => (e.preventDefault(), setDragOver(false))}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
        >
          <div style={styles.dropTitle}>Drag & drop an image here, or click to select</div>
          <div style={styles.dropSub}>
            {loading && "Loading Pyodide..."}
            {error && `Pyodide error: ${String(error)}`}
            {ready && !imgInfo && "No image selected yet"}
            {ready && imgInfo && `Loaded: ${imgInfo.width}×${imgInfo.height}`}
          </div>
          <input ref={inputRef} type="file" accept="image/*" onChange={onInputChange} style={{ display: "none" }} />
        </div>

        <div style={styles.actions}>
          <button
            onClick={convertToGrayscale}
            disabled={!ready || busy || !imgInfo}
            style={{ ...styles.button, ...((!ready || busy || !imgInfo) ? styles.buttonDisabled : {}) }}
          >
            {busy ? "Converting..." : "Convert to grayscale (Pyodide)"}
          </button>

          {downloadUrl && (
            <a href={downloadUrl} download="grayscale.png" style={styles.linkButton}>
              Download converted image
            </a>
          )}
        </div>

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