import fs from 'fs';
import { pipeline } from '@huggingface/transformers';

// Налаштування фільтрації для "людської" логіки
const DISCARD_SUFFIXES = ['ція', 'ння', 'ість', 'зм', 'кація', 'фікація'];
const NOISE_WORDS = ['таргетування', 'махінація', 'позиція'];

async function generate() {
    console.log("🚀 Завантаження моделі Multilingual E5-small...");
    const extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');

    // 1. Завантаження та фільтрація словника
    const rawDict = JSON.parse(fs.readFileSync('./public/dictionary.json', 'utf-8'));
    
    console.log("🧹 Очищення словника від абстрактних слів та шуму...");
    const dictionary = rawDict.filter(word => {
        const w = word.toLowerCase().trim();
        if (w.length < 3) return false;
        if (DISCARD_SUFFIXES.some(s => w.endsWith(s))) return false;
        if (NOISE_WORDS.includes(w)) return false;
        return true;
    });

    const database = {};
    const total = dictionary.length;

    

    console.log(`📝 Обробка ${total} слів (видалено ${rawDict.length - total} "шумних" слів)...`);

    for (let i = 0; i < total; i++) {
        const word = dictionary[i];
        
        // 2. Генерація вектора з префіксом 'query: ' для точності
        const output = await extractor(`query: ${word.toLowerCase().trim()}`, { 
            pooling: 'mean', 
            normalize: true 
        });

        // 3. Оптимізація розміру: округлюємо до 4 знаків після коми
        // Це зменшить вагу JSON-файлу майже вдвічі без втрати якості гри.
        const vector = Array.from(output.data).map(n => parseFloat(n.toFixed(4)));
        
        database[word] = vector;

        if (i % 500 === 0) {
            const percent = Math.round((i / total) * 100);
            console.log(`⏳ Прогрес: ${percent}% (${i}/${total})`);
        }
    }

    // 4. Збереження результату
    fs.writeFileSync('./public/embeddings.json', JSON.stringify(database));
    
    const stats = fs.statSync('./public/embeddings.json');
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n✅ Готово!`);
    console.log(`📦 Файл: public/embeddings.json`);
    console.log(`📊 Розмір: ${sizeInMB} MB (має бути < 100 MB)`);
    console.log(`🔤 Слів у базі: ${total}`);
}

generate().catch(console.error);