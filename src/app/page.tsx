"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, RefreshCcw, Sun, Moon, CheckCircle2, Trophy, HelpCircle, Flag, ListOrdered } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast, Toaster } from "sonner";
import { useTheme } from 'next-themes';

export default function ContextoUA() {
  const [target, setTarget] = useState("");
  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<{word: string, rank: number}[]>([]);
  const [precomputedTop, setPrecomputedTop] = useState<{word: string, rank: number}[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatus, setLoadStatus] = useState("Ініціалізація...");
  const [hasSurrendered, setHasSurrendered] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    worker.current = new Worker(new URL('./worker.ts', import.meta.url));
    worker.current.onmessage = (e) => {
      const { type, word, rank, top500, progress, file } = e.data;
      if (type === 'download_progress') {
        setLoadProgress(progress);
        setLoadStatus(`Завантаження AI: ${Math.round(progress)}%`);
      }
      if (type === 'ready') {
        const saved = localStorage.getItem('contexto_target');
        if (saved) {
          setTarget(saved);
          setGuesses(JSON.parse(localStorage.getItem('contexto_guesses') || '[]'));
          worker.current?.postMessage({ type: 'start', target: saved });
        } else { startNewGame(); }
      }
      if (type === 'init_done') {
        setPrecomputedTop(top500);
        setStatus('ready');
      }
      if (type === 'result') {
        setGuesses(prev => {
          const upd = [{ word, rank }, ...prev].sort((a, b) => a.rank - b.rank);
          localStorage.setItem('contexto_guesses', JSON.stringify(upd));
          return upd;
        });
        setStatus('ready');
        if (rank === 1) toast.success("🎉 ПЕРЕМОГА!");
      }
    };
    return () => worker.current?.terminate();
  }, []);

  const startNewGame = async () => {
    setStatus('loading');
    const res = await fetch('/dictionary.json');
    const dict = await res.json();
    const random = dict[Math.floor(Math.random() * dict.length)];
    setTarget(random);
    setGuesses([]);
    setHasSurrendered(false);
    localStorage.setItem('contexto_target', random);
    localStorage.removeItem('contexto_guesses');
    worker.current?.postMessage({ type: 'start', target: random });
  };

  // НОВА ЛОГІКА ПІДКАЗОК
  const onHint = () => {
    if (precomputedTop.length === 0 || status !== 'ready') return;

    // Визначаємо ваш поточний найкращий ранг (найменше число)
    const currentBestRank = guesses.length > 0 ? Math.min(...guesses.map(g => g.rank)) : 15000;

    // Фільтруємо кандидатів для підказки:
    // 1. Ранг має бути кращим (меншим), ніж ваш поточний найкращий
    // 2. Ранг має бути не менше 2 (щоб не видавати слово №1)
    // 3. Слова ще не має бути у вашому списку
    const candidates = precomputedTop.filter(h => 
      h.rank < currentBestRank && 
      h.rank >= 2 && 
      !guesses.some(g => g.word.toLowerCase() === h.word.toLowerCase())
    );

    if (candidates.length > 0) {
      // Вибираємо випадкове слово з кандидатів, щоб гра залишалася цікавою
      const hint = candidates[Math.floor(Math.random() * candidates.length)];
      
      setStatus('loading');
      worker.current?.postMessage({ type: 'guess', target, guess: hint.word });
    } else {
      toast.success("Ви вже максимально близько до цілі!");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center pt-10">
      <Toaster position="top-center" richColors />

      <AnimatePresence>
        {status === 'loading' && guesses.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background/90 flex items-center justify-center p-6">
            <Card className="w-full max-w-md p-8 text-center space-y-4">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <h3 className="text-xl font-bold">Завантаження...</h3>
              <Progress value={loadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{loadStatus}</p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="w-full max-w-lg shadow-2xl rounded-[2rem]">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-2xl font-black text-primary italic uppercase tracking-tighter">
            <div className="flex flex-col gap-2">
              <span>Полуконтексто</span>
              <span className='text-xs text-neutral-500 tracking-normal lowercase not-italic font-normal'>Слова потрібно шукати більше за написанням, а не за змістом</span>
            </div>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
              {resolvedTheme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
            </Button>
            <Button variant="ghost" size="icon" onClick={startNewGame}><RefreshCcw size={20}/></Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {(hasSurrendered || (guesses.length > 0 && guesses[0].rank === 1)) && (
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="mb-6 p-6 bg-primary/10 rounded-2xl text-center border-2 border-primary/20">
              <Trophy className="mx-auto mb-2 text-primary" />
              <p className="text-xs font-bold uppercase">Слово дня:</p>
              <h2 className="text-3xl font-black uppercase mb-4">{target}</h2>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary" className="w-full gap-2"><ListOrdered size={18}/> Показати ТОП-500</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh]">
                  <SheetHeader><SheetTitle>Близькі слова (ТОП-500)</SheetTitle></SheetHeader>
                  <ScrollArea className="h-full mt-4 pr-4">
                    {precomputedTop.map(t => (
                      <div key={t.rank} className="flex justify-between py-2 border-b">
                        <span className="uppercase font-medium">{t.word}</span>
                        <span className="font-mono">#{t.rank}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </motion.div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); if (input && status === 'ready') { setStatus('loading'); worker.current?.postMessage({ type: 'guess', target, guess: input }); setInput(""); }}} className="flex gap-2 mb-6">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введіть слово..." className="h-14 rounded-xl" disabled={hasSurrendered || (guesses.length > 0 && guesses[0].rank === 1)} />
            <Button type="submit" size="icon" className="h-14 w-14 rounded-xl" disabled={status === 'loading'}><Search size={24}/></Button>
          </form>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <Button variant="secondary" className="rounded-xl gap-2" onClick={onHint} disabled={status === 'loading' || hasSurrendered || (guesses.length > 0 && guesses[0].rank === 1)}><HelpCircle size={18}/> Підказка</Button>
            <Button variant="outline" className="rounded-xl text-destructive gap-2" onClick={() => { setHasSurrendered(true); toast.error("Ви здалися!"); }} disabled={hasSurrendered || (guesses.length > 0 && guesses[0].rank === 1)}><Flag size={18}/> Здатися</Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {guesses.map((g) => (
              <div key={g.word} className="relative h-12 flex items-center px-4 bg-secondary/30 rounded-xl overflow-hidden border">
                <div className={`absolute left-0 top-0 h-full opacity-30 transition-all duration-1000 ${g.rank === 1 ? 'bg-green-500' : g.rank < 300 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${Math.max(5, 100 - (g.rank / 100))}%` }} />
                <span className="z-10 font-bold uppercase text-sm tracking-widest">{g.word}</span>
                <span className="z-10 ml-auto font-mono text-xs font-black opacity-50">#{g.rank}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}