"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Loader2, RefreshCcw, Sun, Moon, 
  CheckCircle2, Trophy, Share2, HelpCircle, Flag, X, ListOrdered 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast, Toaster } from "sonner";
import { useTheme } from 'next-themes';

export default function ContextoUA() {
  const [target, setTarget] = useState("");
  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<{word: string, rank: number}[]>([]);
  const [precomputedTop, setPrecomputedTop] = useState<{word: string, rank: number}[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [hasSurrendered, setHasSurrendered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const worker = useRef<Worker | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const w = new Worker(new URL('./worker.ts', import.meta.url));
    worker.current = w;

    w.onmessage = (e) => {
      const { type, word, rank, top500, message } = e.data;
      if (type === 'ready') {
        const saved = localStorage.getItem('contexto_target');
        if (saved) {
          setTarget(saved);
          setGuesses(JSON.parse(localStorage.getItem('contexto_guesses') || '[]'));
          setPrecomputedTop(JSON.parse(localStorage.getItem('contexto_top500') || '[]'));
          w.postMessage({ type: 'start', target: saved });
        } else {
          startNewGame();
        }
      }
      if (type === 'init_done') {
        setPrecomputedTop(top500);
        localStorage.setItem('contexto_top500', JSON.stringify(top500));
        setStatus('ready');
      }
      if (type === 'result') {
        setGuesses(prev => {
          const upd = [{ word, rank }, ...prev].sort((a, b) => a.rank - b.rank);
          localStorage.setItem('contexto_guesses', JSON.stringify(upd));
          return upd;
        });
        setStatus('ready');
        if (rank === 1) toast.success("Бінго! Слово знайдено!");
      }
      if (type === 'error') toast.error(message);
    };
    return () => w.terminate();
  }, [mounted]);

  const startNewGame = async () => {
    setStatus('loading');
    setIsModalOpen(false);
    try {
      const res = await fetch('/dictionary.json');
      const dict = await res.json();
      const random = dict[Math.floor(Math.random() * dict.length)];
      setTarget(random);
      setGuesses([]);
      setHasSurrendered(false);
      localStorage.setItem('contexto_target', random);
      localStorage.removeItem('contexto_guesses');
      localStorage.removeItem('contexto_top500');
      worker.current?.postMessage({ type: 'start', target: random });
    } catch (e) { toast.error("Помилка завантаження"); }
  };

  const onHint = () => {
    if (precomputedTop.length === 0 || status !== 'ready') return;
    const bestRank = guesses.length > 0 ? Math.min(...guesses.map(g => g.rank)) : 15000;
    // Випадковий вибір підказки з кращих слів, але не №1
    const candidates = precomputedTop.filter(h => h.rank < bestRank && h.rank >= 2 && !guesses.some(g => g.word === h.word));
    if (candidates.length > 0) {
      const hint = candidates[Math.floor(Math.random() * candidates.length)];
      setStatus('loading');
      worker.current?.postMessage({ type: 'guess', target, guess: hint.word });
    } else { toast.success("Ви вже максимально близько!"); }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col items-center pt-10 transition-colors duration-500">
      <Toaster position="top-center" richColors />
      <Card className="w-full max-w-lg shadow-2xl border-none bg-card/50 backdrop-blur-xl rounded-[2.5rem]">
        <CardHeader className="flex flex-row items-center justify-between px-8 border-b border-border/50 pb-6">
          <CardTitle className="text-3xl font-black italic text-primary uppercase tracking-tighter">
            <div className="flex flex-col">
              <span>Contexto UA</span>
              <span className='text-xs text-neutral-500 tracking-normal lowercase not-italic font-normal'>Слова потрібно шукати більше за написанням, а не за змістом</span>
            </div>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
              {resolvedTheme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => {if(confirm("Нова гра?")) startNewGame()}} disabled={status === 'loading'}><RefreshCcw size={20}/></Button>
          </div>
        </CardHeader>
        <CardContent className="px-8 pt-8 pb-10">
          {(hasSurrendered || guesses[0]?.rank === 1) && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8 p-6 bg-primary/10 border-2 border-primary/20 rounded-[2rem] text-center shadow-inner">
              <Trophy className="mx-auto mb-3 text-primary" size={40} />
              <p className="text-[10px] font-black text-primary uppercase mb-1 tracking-widest">Загадане слово:</p>
              <h2 className="text-4xl font-black uppercase tracking-widest mb-6">{target}</h2>
              <div className="grid grid-cols-2 gap-2">
                <Button className="rounded-xl font-bold h-12 gap-2 shadow-lg" onClick={() => {
                  navigator.clipboard.writeText(`Contexto UA 🇺🇦\nСпроб: ${guesses.length}\nРанг 1!`);
                  toast.success("Результат скопійовано");
                }}><Share2 size={18} /> ПОДІЛИТИСЯ</Button>
                <Button variant="secondary" className="rounded-xl font-bold h-12 shadow-lg gap-2 border-primary/20 border" onClick={() => setIsModalOpen(true)}><ListOrdered size={18} /> ТОП-500</Button>
              </div>
            </motion.div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); const val = input.toLowerCase().trim(); if (val && status === 'ready') { setStatus('loading'); worker.current?.postMessage({ type: 'guess', target, guess: val }); setInput(""); }}} className="flex gap-2 mb-8">
            <div className="relative flex-1">
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введіть слово..." className="h-16 text-xl rounded-2xl bg-background/50 border-2 px-6" disabled={hasSurrendered || guesses[0]?.rank === 1} />
              {status === 'loading' && <Loader2 className="absolute right-4 top-5 h-6 w-6 animate-spin text-primary" />}
            </div>
            <Button type="submit" size="icon" className="h-16 w-16 rounded-2xl shadow-xl" disabled={status === 'loading' || hasSurrendered}><Search size={28} /></Button>
          </form>

          <div className="grid grid-cols-2 gap-3 mb-10">
            <Button variant="secondary" className="h-12 font-bold rounded-xl gap-2" onClick={onHint} disabled={hasSurrendered || status === 'loading' || guesses[0]?.rank === 1}><HelpCircle size={18} /> Підказка</Button>
            <Button variant="outline" className="h-12 font-bold rounded-xl gap-2 text-destructive border-destructive/30" onClick={() => setHasSurrendered(true)} disabled={hasSurrendered || guesses[0]?.rank === 1}><Flag size={18} /> Здатися</Button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence initial={false}>
              {guesses.map((g) => (
                <motion.div layout key={g.word} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative h-14 flex items-center px-6 bg-secondary/30 rounded-2xl overflow-hidden border border-border/50 group">
                  <div className={`absolute left-0 top-0 h-full opacity-40 transition-all duration-1000 ease-out ${g.rank === 1 ? 'bg-green-500' : g.rank < 300 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${Math.max(4, 100 - (g.rank / 100))}%` }} />
                  <span className="z-10 font-black uppercase text-sm tracking-widest">{g.word} {g.rank === 1 && <CheckCircle2 size={16} className="text-green-600 inline ml-2"/>}</span>
                  <span className="z-10 ml-auto font-mono text-sm font-black opacity-40">{g.rank}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg max-h-[80vh] bg-card border shadow-2xl rounded-[2.5rem] overflow-hidden flex flex-col">
              <div className="p-6 border-b flex justify-between items-center bg-card"><h3 className="text-xl font-black uppercase tracking-tighter">Найближчі 500 слів</h3><Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}><X /></Button></div>
              <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
                {precomputedTop.map((g) => (
                  <div key={g.word} className="relative h-12 flex items-center px-6 bg-secondary/20 rounded-xl overflow-hidden border border-border/50">
                    <div className={`absolute left-0 top-0 h-full opacity-20 ${g.rank === 1 ? 'bg-green-500' : g.rank < 300 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.max(4, 100 - (g.rank / 100))}%` }} />
                    <span className="z-10 font-bold uppercase text-xs tracking-widest">{g.word}</span><span className="z-10 ml-auto font-mono text-xs opacity-40">{g.rank}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}