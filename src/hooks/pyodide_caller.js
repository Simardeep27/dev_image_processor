import { useEffect, useRef, useState } from "react";
import { loadPyodide } from "pyodide";

export function usePyodide() {
  const pyodideRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const py = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.1/full/",
        });

        await py.loadPackage("numpy");

        py.runPython(`
import numpy as np
print("NumPy OK:", np.__version__)
        `);

        if (!cancelled) {
          pyodideRef.current = py;
          setReady(true);
        }
      } catch (e) {
        console.error("Pyodide init failed:", e);
        if (!cancelled) setError(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { pyodide: pyodideRef.current, ready, error };
}
