'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store/store-context';
import { useAuth } from '@/lib/auth/auth-context';
import { fromScaledQty, toRupees, cn } from '@/lib/utils';
import {
  Bot, X, Send, Sparkles, MessageSquare, Loader2, Plus
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'I want to manufacture Murukku packets',
  'Check low stock & reorder alerts',
  'Sales & receivables summary',
  'How do I run a production batch?',
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi! I am **FoodFlow AI**. Ask me to estimate raw materials for a Murukku batch, predict production capacity from your current stock, or guide you through any ERP step.',
};

const STORAGE_KEY = 'foodflow-chat-history';

function loadSavedMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [WELCOME_MESSAGE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [WELCOME_MESSAGE];
}

function saveMessages(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {}
}

export function ErpChatbot() {
  const {
    products,
    materials,
    inventoryBalances,
    bomHeaders,
    bomItems,
    salesOrders,
    invoices,
    customers,
    productionRuns,
    settings,
  } = useStore();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [showAskMeHint, setShowAskMeHint] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'gemini' | 'smart-erp'>('gemini');
  const [messages, setMessages] = useState<ChatMessage[]>(loadSavedMessages);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, loading]);

  const erpContext = useMemo(() => {
    const totalRevenuePaise = invoices
      .filter((i) => i.status === 'posted')
      .reduce((s, i) => s + i.grandTotalPaise, 0);
    const totalOutstandingPaise = customers.reduce((s, c) => s + (c.outstandingPaise || 0), 0);

    return {
      companyName: settings.companyName,
      userRole: user?.role || 'owner',
      products: products.map((p) => {
        const bal = inventoryBalances.find((b) => b.itemId === p.id);
        return {
          name: p.name,
          code: p.code,
          sellingPriceRupees: toRupees(p.sellingPricePaise),
          stock: bal ? fromScaledQty(bal.currentStock) : 0,
        };
      }),
      materials: materials.map((m) => {
        const bal = inventoryBalances.find((b) => b.itemId === m.id);
        return {
          name: m.name,
          unit: m.unitName,
          type: m.type,
          stock: bal ? fromScaledQty(bal.currentStock) : 0,
          reorderLevel: fromScaledQty(m.reorderLevel),
          avgRateRupees: bal ? toRupees(bal.weightedAvgRatePaise) : toRupees(m.currentRatePaise),
        };
      }),
      boms: bomHeaders.map((bh) => ({
        productName: bh.productName,
        batchSize: bh.batchSize,
        items: bomItems
          .filter((bi) => bi.bomHeaderId === bh.id)
          .map((bi) => ({
            materialName: bi.materialName,
            unit: bi.materialUnit,
            qtyPerBatch: fromScaledQty(bi.standardQuantity),
          })),
      })),
      stats: {
        totalOrders: salesOrders.length,
        pendingOrders: salesOrders.filter(
          (o) => o.status === 'submitted' || o.status === 'under_review'
        ).length,
        totalRevenueRupees: toRupees(totalRevenuePaise),
        totalOutstandingRupees: toRupees(totalOutstandingPaise),
        completedRuns: productionRuns.filter((r) => r.status === 'completed').length,
      },
    };
  }, [
    products,
    materials,
    inventoryBalances,
    bomHeaders,
    bomItems,
    salesOrders,
    invoices,
    customers,
    productionRuns,
    settings.companyName,
    user?.role,
  ]);

  const sendMessage = async (textToSend?: string) => {
    const trimmed = (textToSend ?? input).trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          erpContext,
        }),
      });
      const data = await res.json();
      if (data.mode) setMode(data.mode);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply || data.error || 'Sorry, I could not generate a response.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: 'Network error while reaching the assistant. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      return (
        <p key={i} className={line.trim() === '' ? 'h-2' : 'leading-relaxed'}>
          {parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={idx} className="font-bold">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={idx}>{part.slice(1, -1)}</em>;
            }
            return <React.Fragment key={idx}>{part}</React.Fragment>;
          })}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-[calc(100vw-2.5rem)] sm:w-[400px] h-[540px] max-h-[78vh] rounded-2xl bg-white border border-surface-200 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-primary-700 to-primary-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Bot className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold leading-none">FoodFlow AI Assistant</h3>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/20 text-white">
                      {mode === 'gemini' ? 'Gemini' : 'Smart ERP'}
                    </span>
                  </div>
                  <p className="text-[11px] text-primary-100 mt-0.5">
                    Production & business predictions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setMessages([
                      {
                        id: 'welcome',
                        role: 'assistant',
                        content:
                          'Chat cleared! Ask me to estimate raw materials for a batch or summarize your business metrics.',
                      },
                    ])
                  }
                  title="Start new chat"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white/90 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close assistant"
                  className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50/70">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs space-y-1 shadow-xs',
                      msg.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-sm'
                        : 'bg-white text-surface-800 border border-surface-200 rounded-bl-sm'
                    )}
                  >
                    {renderFormattedText(msg.content)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-surface-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs text-surface-500 flex items-center gap-2 shadow-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}

              {messages.length <= 2 && !loading && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
                    Try asking
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q)}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-white border border-surface-200 text-surface-700 hover:border-primary-400 hover:text-primary-700 transition-colors cursor-pointer text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="p-3 border-t border-surface-200 bg-white flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Murukku materials, stock, or sales..."
                className="flex-1 h-10 px-3.5 rounded-xl border border-surface-300 bg-surface-50 text-xs text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-10 w-10 shrink-0 rounded-xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-40 transition-colors cursor-pointer"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-Right Launcher + "Ask me" Popup */}
      <div className="flex items-center gap-2.5">
        <AnimatePresence>
          {!isOpen && showAskMeHint && (
            <motion.div
              initial={{ opacity: 0, x: 12, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.9 }}
              className="flex items-center gap-2 rounded-full bg-white border border-surface-200 shadow-lg pl-3.5 pr-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => {
                  setIsOpen(true);
                  setShowAskMeHint(false);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-surface-800 hover:text-primary-700 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                <span>Ask me!</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAskMeHint(false)}
                className="p-0.5 rounded-full text-surface-400 hover:bg-surface-100 hover:text-surface-600 cursor-pointer"
                aria-label="Dismiss hint"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsOpen((prev) => !prev);
            setShowAskMeHint(false);
          }}
          className="h-14 w-14 rounded-full bg-gradient-to-br from-primary-600 to-primary-900 text-white shadow-xl shadow-primary-600/30 flex items-center justify-center ring-4 ring-white hover:shadow-2xl transition-shadow cursor-pointer"
          aria-label="Open FoodFlow AI Assistant"
        >
          {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        </motion.button>
      </div>
    </div>
  );
}

