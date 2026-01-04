import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let extractor: any = null;
let embeddingsDB: Record<string, number[]> | null = null;
let wordRanks = new Map<string, number>();

async function init() {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
      progress_callback: (data: any) => {
        if (data.status === 'progress') {
          self.postMessage({ type: 'download_progress', progress: data.progress, file: data.file });
        }
      }
    });
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

  if (type === 'start') {
    const targetOut = await extractor(`query: ${target.toLowerCase()}`, { pooling: 'mean', normalize: true });
    const targetVec = targetOut.data;
    const allWords = [];

    for (const word in embeddingsDB!) {
      const vec = embeddingsDB[word];
      let sim = 0;
      for (let i = 0; i < targetVec.length; i++) sim += targetVec[i] * vec[i];
      allWords.push({ word, sim });
    }

    allWords.sort((a, b) => b.sim - a.sim);
    wordRanks.clear();
    const top500 = [];
    for (let i = 0; i < allWords.length; i++) {
      const rank = i + 1;
      const wKey = allWords[i].word.toLowerCase().trim();
      wordRanks.set(wKey, rank);
      if (i < 500) top500.push({ word: allWords[i].word, rank });
    }
    wordRanks.set(target.toLowerCase().trim(), 1);
    self.postMessage({ type: 'init_done', top500 });
  }

  if (type === 'guess') {
    const cleanGuess = guess.toLowerCase().trim();
    const rank = wordRanks.get(cleanGuess) || 15000;
    self.postMessage({ type: 'result', word: guess, rank });
  }
};