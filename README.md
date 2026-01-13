# Pyodide Image Grayscale Converter

A static web application that allows users to upload an image and convert it to grayscale directly in the browser using **Pyodide (Python compiled to WebAssembly)**.  
The application is built with **React + Vite** and deployed on **GitHub Pages**.

## Project Features
- Upload an image (via file picker or drag-and-drop)
- Convert the image to grayscale using Python(numpy)
- View a side-by-side comparison (original vs grayscale)
- Download the processed grayscale image


## Design Decisions

1. Python Processing
- **Pyodide** is used to run Python entirely in the browser without any backend.
- The grayscale conversion logic is implemented in using **NumPy**, leveraging vectorized operations for clarity and correctness.
- NumPy was chosen over alternatives for its simplicity, performance, and suitability for array-based image manipulation.
- **AVG Time taken for conversion through numpy: 2068.00 ms**

2. JavaScript-Python Bridge
- The JS Python boundary is handled carefully to avoid unnecessary complexity (given the time duration of 1-2 hours):
  - Raw RGBA pixel buffers are extracted from the canvas using `getImageData`.
  - These buffers are converted into NumPy arrays inside Pyodide.
  - The processed pixel data is returned to JavaScript and rendered back to the output canvas.

3. UI components
- Built using **React** with functional components and hooks.
- UI state (loading, busy state, image metadata) is managed via `useState` and `useRef`.
- The interface prioritizes clarity:
  - Prominent drag-and-drop upload area
  - Explicit “Convert to Grayscale” action
  - Side-by-side before/after comparison
  - Download button for the processed image

4. Codebase Organization
- The Codebase is organized such that it is easy to understand and replicate.
  - Components: React UI Components
  - Hooks: Pyodide initialization hook
  - Libs: Pyodide and Image heler utils
  - Styles: Centralized Styles for the canvas, dropzone and actions


5. Deployment Link:
   https://simardeep27.github.io/dev_image_processor/


7. Local deployment can be easily replicated by:
 - ```bash npm install```
 - ```bash npm run dev```
