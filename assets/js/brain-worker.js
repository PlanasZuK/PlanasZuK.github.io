/* brain-worker.js — an open model that thinks inside the visitor's browser (Gemma 3 1B, Google, open weights).
   It runs on the visitor's own graphics card through WebGPU, in this worker so the rain never stutters.
   No server, no account, no key, no cost: the weights come from Hugging Face once and stay in the browser cache. */
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0";

const MODEL = "onnx-community/gemma-3-1b-it-ONNX-GQA";
let gen = null;
const files = new Map();

self.onmessage = async (e) => {
  const { type, id, messages } = e.data;
  if (type === "load" && !gen) {
    try {
      gen = await pipeline("text-generation", MODEL, {
        device: "webgpu", dtype: "q4", // full-precision maths: the fp16 build overflows on many graphics cards
        progress_callback: (p) => {
          if (p.status !== "progress" || !p.total) return;
          files.set(p.file, [p.loaded, p.total]);
          let a = 0, b = 0;
          for (const [l, t] of files.values()) { a += l; b += t; }
          self.postMessage({ type: "progress", value: b ? a / b : 0 });
        },
      });
      // a first tiny answer compiles the graphics-card programs, so the first real one is quick
      await gen([{ role: "user", content: "hi" }], { max_new_tokens: 4 });
      self.postMessage({ type: "ready" });
    } catch (err) { self.postMessage({ type: "error", message: String(err && err.message || err) }); }
  }
  if (type === "ask") {
    if (!gen) { self.postMessage({ type: "answer", id, text: "" }); return; }
    try {
      const r = await gen(messages, { max_new_tokens: 36, do_sample: true, temperature: e.data.temperature || 0.7, top_p: 0.9, repetition_penalty: 1.1 });
      self.postMessage({ type: "answer", id, text: r[0].generated_text.at(-1).content || "" });
    } catch (err) { self.postMessage({ type: "answer", id, text: "" }); }
  }
};
