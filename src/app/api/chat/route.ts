import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ErpMaterial {
  name: string;
  unit: string;
  type: string;
  stock: number;
  reorderLevel: number;
  avgRateRupees: number;
}

interface ErpBom {
  productName: string;
  batchSize: number;
  items: { materialName: string; unit: string; qtyPerBatch: number }[];
}

interface ErpContext {
  companyName?: string;
  userRole?: string;
  products: { name: string; code: string; sellingPriceRupees: number; stock: number }[];
  materials: ErpMaterial[];
  boms: ErpBom[];
  stats: {
    totalOrders: number;
    pendingOrders: number;
    totalRevenueRupees: number;
    totalOutstandingRupees: number;
    completedRuns: number;
  };
}

// Standard fallback recipe per 200 packets (used only when no custom BOM exists yet)
const DEFAULT_MURUKKU_PER_200 = [
  { name: 'Rice Flour / Besan', unit: 'kg', qtyPer200: 40 },
  { name: 'Cooking Oil', unit: 'L', qtyPer200: 10 },
  { name: 'Salt & Spice Mix', unit: 'kg', qtyPer200: 1.2 },
  { name: '200g Printed Pouches', unit: 'pcs', qtyPer200: 200 },
  { name: 'Corrugated Cartons', unit: 'pcs', qtyPer200: 10 },
];

function buildFallbackReply(message: string, ctx: ErpContext): string {
  const lower = message.toLowerCase();

  // Extract packet count if user mentioned a number
  const numMatch = message.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
  const requestedQty = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : null;

  // 1. Manufacturing / raw material estimation
  if (
    lower.includes('murukku') ||
    lower.includes('manufactur') ||
    lower.includes('produc') ||
    lower.includes('raw material') ||
    lower.includes('estimate') ||
    lower.includes('recipe') ||
    lower.includes('bom') ||
    (requestedQty !== null && (lower.includes('packet') || lower.includes('pkt') || lower.includes('batch')))
  ) {
    // Find matching BOM if user configured one
    const matchedBom =
      ctx.boms.find((b) => lower.includes(b.productName.toLowerCase())) || ctx.boms[0];

    if (!requestedQty || requestedQty <= 0) {
      const productHint = matchedBom ? matchedBom.productName : 'Murukku 200g';
      return `I can estimate the exact raw materials and packaging needed for **${productHint}**!\n\nHow many **packets** are you planning to manufacture? (For example, reply with *"200 packets"* or *"500 packets"*.)`;
    }

    if (matchedBom && matchedBom.items.length > 0) {
      const scale = requestedQty / (matchedBom.batchSize || 1);
      const lines = matchedBom.items.map((item) => {
        const needed = item.qtyPerBatch * scale;
        const inv = ctx.materials.find(
          (m) => m.name.toLowerCase() === item.materialName.toLowerCase()
        );
        const stockNote = inv
          ? inv.stock >= needed
            ? `In stock: ${inv.stock.toFixed(2).replace(/\.00$/, '')} ${inv.unit} (OK)`
            : `In stock: ${inv.stock.toFixed(2).replace(/\.00$/, '')} ${inv.unit} (Short by ${(needed - inv.stock).toFixed(2).replace(/\.00$/, '')} ${item.unit})`
          : 'Not in inventory yet';
        return `• **${item.materialName}**: **${needed.toFixed(2).replace(/\.00$/, '')} ${item.unit}** — ${stockNote}`;
      });

      return `Here is the required material estimate for **${requestedQty} packets of ${matchedBom.productName}** (scaled from your saved BOM of ${matchedBom.batchSize} pkts):\n\n${lines.join('\n')}\n\nNext step: Go to **Operations → Production & BOM → New Production Run** to schedule this batch.`;
    }

    // No BOM saved yet — use standard South Indian Murukku 200g approximation
    const scale = requestedQty / 200;
    const lines = DEFAULT_MURUKKU_PER_200.map((item) => {
      const needed = item.qtyPer200 * scale;
      return `• **${item.name}**: ~**${needed.toFixed(2).replace(/\.00$/, '')} ${item.unit}**`;
    });

    return `Here is an approximate raw material & packaging estimate for **${requestedQty} packets** (standard 200g Murukku ratio, assuming ~5% frying oil absorption):\n\n${lines.join('\n')}\n\nTip: Save your exact recipe under **Operations → Production & BOM → Create BOM** so future runs and my estimates use your exact factory formula.`;
  }

  // 2. Low stock / reorder prediction
  if (lower.includes('stock') || lower.includes('short') || lower.includes('reorder') || lower.includes('capacity')) {
    const lowMats = ctx.materials.filter((m) => m.stock <= m.reorderLevel);
    if (ctx.materials.length === 0) {
      return 'Your inventory is currently empty. Add your raw materials and opening stock in **Operations → Inventory & Stock Ledger → Add Material** to start tracking capacity and reorder alerts.';
    }
    if (lowMats.length === 0) {
      return `All **${ctx.materials.length} tracked materials** are currently above their reorder levels! You can inspect full stock valuations in **Operations → Inventory & Stock Ledger**.`;
    }
    const list = lowMats
      .map((m) => `• **${m.name}**: ${m.stock} ${m.unit} (Reorder level: ${m.reorderLevel} ${m.unit})`)
      .join('\n');
    return `**Low Stock Alert (${lowMats.length} item(s)):**\n\n${list}\n\nConsider recording a purchase receipt in **Operations → Purchases & Suppliers**.`;
  }

  // 3. Business / sales / receivables summary
  if (lower.includes('sale') || lower.includes('revenue') || lower.includes('receivable') || lower.includes('summary') || lower.includes('predict')) {
    return `**Live Business Snapshot:**\n• **Total Invoiced Revenue:** ₹${ctx.stats.totalRevenueRupees.toLocaleString('en-IN')}\n• **Customer Receivables (Outstanding):** ₹${ctx.stats.totalOutstandingRupees.toLocaleString('en-IN')}\n• **Sales Orders:** ${ctx.stats.totalOrders} total (${ctx.stats.pendingOrders} pending approval)\n• **Completed Production Batches:** ${ctx.stats.completedRuns}\n\nAsk me to estimate raw materials for a target packet count or check your low-stock items anytime!`;
  }

  // 4. General help
  return `I'm your **FoodFlow ERP Assistant**. I can help you with:\n• **Production Estimates:** e.g. *"I want to manufacture 500 Murukku packets"*\n• **Inventory & Capacity:** e.g. *"Check low stock & reorder alerts"*\n• **Business Snapshot:** e.g. *"Sales & receivables summary"*\n• **Workflow Guidance:** Purchases (GRN), BOMs, Production Runs, GST Invoices, and Payments.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = (body?.message || '').trim();
    const history: ChatMessage[] = Array.isArray(body?.history) ? body.history.slice(-8) : [];
    const erpContext: ErpContext = body?.erpContext || {
      products: [],
      materials: [],
      boms: [],
      stats: {
        totalOrders: 0,
        pendingOrders: 0,
        totalRevenueRupees: 0,
        totalOutstandingRupees: 0,
        completedRuns: 0,
      },
    };

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: buildFallbackReply(message, erpContext),
        mode: 'smart-erp',
      });
    }

    const systemInstruction = `You are FoodFlow AI, an expert ERP & food-manufacturing operations assistant for a South Indian packaged food manufacturer (${erpContext.companyName || 'FoodFlow Foods'}).
Current user role: ${erpContext.userRole || 'owner'}.

LIVE FACTORY SNAPSHOT:
- Products (${erpContext.products.length}): ${JSON.stringify(erpContext.products.slice(0, 15))}
- Materials & Stock (${erpContext.materials.length}): ${JSON.stringify(erpContext.materials.slice(0, 25))}
- Saved BOM Recipes (${erpContext.boms.length}): ${JSON.stringify(erpContext.boms.slice(0, 10))}
- Business Stats: ${JSON.stringify(erpContext.stats)}

GUIDELINES:
1. If the user wants to manufacture a product (e.g., Murukku, Mixture) and has NOT specified how many packets/units, ask them for the target number of packets first so you can calculate exact quantities.
2. When a packet quantity IS given, calculate required raw materials & packaging using their saved BOM if available (otherwise give approximate standard South Indian snack ratios and clearly label them as approximate), and compare against their live stock to highlight any shortages.
3. Help with production planning, yield/cost predictions, reorder suggestions, GST invoicing (CGST+SGST intra-state vs IGST inter-state), and step-by-step FoodFlow navigation.
4. Keep answers concise, structured with bullet points, and use Indian Rupees (₹).`;

    const contents = [
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 700,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      console.error('Gemini API error:', geminiRes.status, await geminiRes.text());
      return NextResponse.json({
        reply: buildFallbackReply(message, erpContext),
        mode: 'smart-erp',
      });
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      buildFallbackReply(message, erpContext);

    return NextResponse.json({ reply, mode: 'gemini' });
  } catch (err) {
    console.error('Chat API route error:', err);
    return NextResponse.json(
      { error: 'Unable to process chat request right now.' },
      { status: 500 }
    );
  }
}
