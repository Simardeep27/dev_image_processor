**Tool used: ChatGPT 5.2 Reasoning**

**Prompt:**

In a React application using Pyodide for image processing, I observe that UI
loading indicators do not render while Python code is executing, even though
state updates (e.g., setBusy(true)) are triggered. This is mainly happening due
to pyodide running on the main thread.

Analyze:
- Why this happens in the context of the browser event loop and React rendering
- Whether this behavior is specific to Pyodide or applies to any synchronous
  computation
- At least two architectural plans to ensure responsive UI feedback.

Provide reasoning first, then minimal example code.
