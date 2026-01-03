async function generateEmbeddings(dictionary: any) {
    const { pipeline } = await import('@huggingface/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const database: any = {};

    console.log("Починаємо генерацію для 14к слів...");
    for (let i = 0; i < dictionary.length; i++) {
        const word = dictionary[i];
        const output = await extractor(word, { pooling: 'mean', normalize: true });
        database[word] = Array.from(output.data); // Перетворюємо у звичайний масив

        if (i % 500 === 0) console.log(`Оброблено: ${i}/${dictionary.length}`);
    }

    console.log("ГОТОВО! Скопіюйте текст нижче у файл public/embeddings.json:");
    console.log(JSON.stringify(database));
}