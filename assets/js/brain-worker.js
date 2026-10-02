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
      // a first answer, as long as a real conversation, compiles the graphics-card programs for that size,
      // so the visitor's first real question is answered quickly (this happens under the loading screen)
      const brief = "You are the voice of a web designer's website. Answer in one short, witty sentence. ".repeat(14);
      await gen([{ role: "system", content: brief }, { role: "user", content: "chips" }, { role: "assistant", content: "Chips? If you sell them, I will make you a crunchy website." }, { role: "user", content: "hello there" }], { max_new_tokens: 12 });
      self.postMessage({ type: "ready" });
    } catch (err) { self.postMessage({ type: "error", message: String(err && err.message || err) }); }
  }
  if (type === "ask") {
    if (!gen) { self.postMessage({ type: "answer", id, text: "" }); return; }
    try {
      const r = await gen(messages, { max_new_tokens: 48, do_sample: true, temperature: e.data.temperature || 0.7, top_p: 0.92, repetition_penalty: 1.15 });
      self.postMessage({ type: "answer", id, text: r[0].generated_text.at(-1).content || "" });
    } catch (err) { self.postMessage({ type: "answer", id, text: "" }); }
  }
};
