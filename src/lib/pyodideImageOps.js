export function ensureGrayscaleFn(pyodide, pythonCode) {
  pyodide.runPython(pythonCode);
}

export function grayscaleRGBA(pyodide, rgba, w, h) {
  pyodide.globals.set("flat_rgba", rgba);
  pyodide.globals.set("w", w);
  pyodide.globals.set("h", h);

  const result = pyodide.runPython("to_grayscale_rgba(flat_rgba, w, h)");
  const outFlat = result.toJs({ create_proxies: false });
  result.destroy?.();
  return outFlat;
}
