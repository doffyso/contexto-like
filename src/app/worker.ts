import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

let extractor: any = null;
let embeddingsDB: Record<string, number[]> | null = null;
let wordRanks = new Map<string, number>();

async function init() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  }
  if (!embeddingsDB) {
    const res = await fetch('/embeddings.json');
    embeddingsDB = await res.json();
  }
  self.postMessage({ type: 'ready' });
  return { extractor, embeddingsDB };
}

init();

self.onmessage = async (e) => {
  const { type, target, guess } = e.data;
  const { extractor, embeddingsDB } = await init();

  const cleanTarget = target.toLowerCase().trim();

  try {
    if (type === 'start') {
      // Додаємо префікс для цілі
      const targetOut = await extractor(`query: ${cleanTarget}`, { pooling: 'mean', normalize: true });
      const targetVec = targetOut.data;
      const allWords = [];

      // Розрахунок семантичної схожості для всієї бази
      for (const word in embeddingsDB!) {
        const vec = embeddingsDB[word];
        let sim = 0;
        for (let i = 0; i < targetVec.length; i++) sim += targetVec[i] * vec[i];
        allWords.push({ word, sim });
      }

      // Сортування: найбільш схожі отримують менші ранги
      allWords.sort((a, b) => b.sim - a.sim);

      wordRanks.clear();
      const top500 = [];
      for (let i = 0; i < allWords.length; i++) {
        const rank = i + 1;
        const wKey = allWords[i].word.toLowerCase().trim();
        wordRanks.set(wKey, rank);
        if (i < 500) top500.push({ word: allWords[i].word, rank });
      }
      
      // Імунітет для цілі: гарантуємо Ранг 1
      wordRanks.set(cleanTarget, 1);
      self.postMessage({ type: 'init_done', top500 });
    }

    if (type === 'guess') {
      const cleanGuess = guess.toLowerCase().trim();
      
      // Миттєвий результат при ідентичному слові (захист від похибок 0.999...)
      if (cleanGuess === cleanTarget) {
        self.postMessage({ type: 'result', word: guess, rank: 1 });
        return;
      }

      const rank = wordRanks.get(cleanGuess) || 15000;
      self.postMessage({ type: 'result', word: guess, rank });
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err.message });
  }
};