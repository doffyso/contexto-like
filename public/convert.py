import json

# Читаємо слова з txt файлу
with open('wordlist.txt', 'r', encoding='utf-8') as f:
    # Прибираємо зайві пробіли, пусті рядки та переводимо в нижній регістр
    words = [line.strip().lower() for line in f if line.strip()]

# Видаляємо дублікати
unique_words = list(dict.fromkeys(words))

# Записуємо у json форматі
with open('dictionary.json', 'w', encoding='utf-8') as f:
    json.dump(unique_words, f, ensure_ascii=False, indent=2)

print(f"Готово! Оброблено {len(unique_words)} слів.")