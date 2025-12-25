import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, ShieldCheck, Copy, Check } from "lucide-react";

// --- Config ---
// If your Nest API runs on another origin, set VITE_API_BASE in .env, e.g. VITE_API_BASE=http://localhost:3000
const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

// Telegram bot username (without @)
const BOT_USERNAME = "ttt432_bot";

type Cell = 0 | 1 | 2; // 0 empty, 1 player X, 2 bot O
type GameStatus = "in_progress" | "win" | "lose" | "draw";

type MoveResponse = {
  success: boolean;
  status: GameStatus;
  board: Cell[];
  promoCode?: string; // бэк может прислать, но фронт больше не показывает
};

function clsx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function getOrCreateSessionId(): string {
  const key = "ttt_session_id";
  const existing = localStorage.getItem(key);
  if (existing && existing.length > 0) return existing;
  const id = `s_${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}

const X_MARK = "✕";
const O_MARK = "○";

const pastel = {
  bg: "from-rose-50 via-pink-50 to-purple-50",
  card: "bg-white/70",
  border: "border-white/50",
  text: "text-slate-800",
  sub: "text-slate-600",
  accent: "text-rose-500",
  accentBg: "bg-rose-500",
};

function prettyStatus(status: GameStatus) {
  switch (status) {
    case "in_progress":
      return "Ваш ход";
    case "win":
      return "Вы выиграли ✨";
    case "lose":
      return "Почти получилось";
    case "draw":
      return "Ничья — ещё раз?";
  }
}

async function postMove(sessionId: string, board: Cell[], cellIndex: number): Promise<MoveResponse> {
  const res = await fetch(`${API_BASE}/game/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, board, cellIndex }),
  });

  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const msg = body?.message || `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }

  return res.json();
}

function EmptyBoard(): Cell[] {
  return Array.from({ length: 9 }, () => 0) as Cell[];
}

function CellMark({ value }: { value: Cell }) {
  if (value === 1) return <span className="text-2xl sm:text-3xl font-semibold">{X_MARK}</span>;
  if (value === 2) return <span className="text-2xl sm:text-3xl font-semibold">{O_MARK}</span>;
  return <span className="text-2xl sm:text-3xl opacity-30">{O_MARK}</span>;
}

function TelegramLinkModal({
  link,
  onClose,
}: {
  link: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className={clsx(
            "relative w-full max-w-md rounded-3xl shadow-xl",
            pastel.card,
            "border",
            pastel.border,
            "p-5 sm:p-6"
          )}
          initial={{ y: 18, scale: 0.98, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 18, scale: 0.98, opacity: 0 }}
        >
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-800">Победа! 🎉</div>
              <div className="text-sm text-slate-600">Получите промокод в Telegram-боте</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/70 border border-white/60 p-4">
            <div className="text-xs text-slate-500">Ссылка на бота</div>
            <div className="mt-2 break-all text-sm text-slate-800 font-medium">
              {link}
            </div>

            <div className="mt-3 flex gap-2">
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-2xl px-4 py-3 bg-rose-500 text-white font-medium shadow-sm hover:opacity-95 text-center"
              >
                Открыть Telegram
              </a>

              <button
                onClick={copy}
                className="shrink-0 rounded-2xl px-3 py-3 bg-slate-900 text-white font-medium shadow-sm hover:opacity-95"
                aria-label="copy-link"
                title="Копировать ссылку"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 mt-0.5" />
            <div>
              В Telegram нажмите <b>/start</b> — бот проверит наличие промокодов и выдаст ваш.
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={onClose}
              className="w-full rounded-2xl px-4 py-3 bg-slate-900 text-white font-medium shadow-sm hover:opacity-95"
            >
              Понятно
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [sessionId, setSessionId] = useState<string>("");
  const [board, setBoard] = useState<Cell[]>(() => EmptyBoard());
  const [status, setStatus] = useState<GameStatus>("in_progress");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // вместо promoCode теперь показываем ссылку на бота
  const [tgLink, setTgLink] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const canPlay = useMemo(() => status === "in_progress" && !busy, [status, busy]);

  function resetGame() {
    setBoard(EmptyBoard());
    setStatus("in_progress");
    setError(null);
    setTgLink(null);
  }

  function buildTelegramLink(sid: string) {
    // Deep link с payload = sessionId (потом бот сможет найти/проверить промокоды именно для этой сессии)
    return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(sid)}`;
  }

  async function onCellClick(i: number) {
    if (!canPlay) return;
    if (board[i] !== 0) return;

    setError(null);
    setBusy(true);

    try {
      const res = await postMove(sessionId, board, i);
      setBoard(res.board);
      setStatus(res.status);

      if (res.status === "win") {
        setTgLink(buildTelegramLink(sessionId));
      }
    } catch (e: any) {
      setError(e?.message ?? "Ошибка запроса");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clsx("min-h-screen w-full bg-gradient-to-br", pastel.bg, "flex items-center justify-center")}>
      <div className="w-full max-w-3xl px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Copy + status */}
          <motion.div
            className={clsx("rounded-3xl border shadow-sm p-5 sm:p-6", pastel.card, pastel.border)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl sm:text-3xl font-semibold text-slate-800">Крестики-нолики</div>
                <div className="mt-1 text-sm text-slate-600">
                  Лёгкая игра — маленький шанс на приятную скидку ✨
                </div>
              </div>
              <div className="hidden sm:flex h-12 w-12 rounded-3xl bg-white/70 border border-white/60 items-center justify-center">
                <Sparkles className="h-6 w-6 text-rose-500" />
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm text-slate-500">Статус</div>
              <div className="mt-1 text-xl font-semibold text-slate-800">{prettyStatus(status)}</div>

              <div className="mt-3 text-sm text-slate-600">
                Вы играете за <span className="font-semibold">{X_MARK}</span>, компьютер — за{" "}
                <span className="font-semibold">{O_MARK}</span>.
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  className="mt-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-slate-700"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                onClick={resetGame}
                className="rounded-2xl px-4 py-3 bg-white/70 border border-white/60 text-slate-800 font-medium shadow-sm hover:bg-white/80"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className={clsx("h-4 w-4", busy && "animate-spin")} />
                  Сыграть заново
                </span>
              </button>

              <div className="sm:ml-auto text-xs text-slate-500 flex items-center">
                Session: <span className="ml-1 font-mono">{sessionId ? sessionId.slice(0, 10) + "…" : "—"}</span>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500 leading-relaxed">
              При победе появится ссылка на Telegram-бота. В боте вы нажмёте <b>/start</b> и получите промокод (если он
              есть).
            </div>
          </motion.div>

          {/* Right: Board */}
          <motion.div
            className={clsx("rounded-3xl border shadow-sm p-5 sm:p-6", pastel.card, pastel.border)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="grid grid-cols-3 gap-3">
              {board.map((v, i) => {
                const clickable = canPlay && v === 0;
                return (
                  <motion.button
                    key={i}
                    onClick={() => onCellClick(i)}
                    whileTap={clickable ? { scale: 0.98 } : undefined}
                    className={clsx(
                      "aspect-square rounded-3xl border shadow-sm flex items-center justify-center",
                      "bg-white/70 border-white/60",
                      clickable && "hover:bg-white/85",
                      !clickable && "opacity-95"
                    )}
                    aria-label={`cell-${i}`}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.12 }}
                      className={clsx(v === 1 && "text-slate-900", v === 2 && "text-rose-500")}
                    >
                      <CellMark value={v} />
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {(status === "lose" || status === "draw") && (
                <motion.div
                  className="mt-5 rounded-3xl bg-white/70 border border-white/60 p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <div className="text-slate-800 font-semibold">
                    {status === "lose" ? "Хотите попробовать ещё раз?" : "Сыграем ещё раз?"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">Иногда победа приходит со второй попытки 💫</div>
                  <button
                    onClick={resetGame}
                    className="mt-3 w-full rounded-2xl px-4 py-3 bg-rose-500 text-white font-medium shadow-sm hover:opacity-95"
                  >
                    Сыграть ещё раз
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {tgLink && <TelegramLinkModal link={tgLink} onClose={() => setTgLink(null)} />}
    </div>
  );
}
