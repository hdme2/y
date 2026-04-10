import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { Resend } from 'resend';
import path from 'path';
import * as xlsx from 'xlsx';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

// Initialize APIs lazily
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    let key = process.env.GEMINI_API_KEY;
    if (key) {
      key = key.replace(/^["']|["']$/g, ''); // Strip quotes if accidentally included
    }
    if (!key || key === 'MY_GEMINI_API_KEY' || key === 'your_api_key_here') {
      return null;
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY || 're_placeholder';
    resendClient = new Resend(key);
  }
  return resendClient;
}

// --- API Routes ---

// 1. Upload & Parse Quote (PDF/Image/Excel)
app.post('/api/parse-quote', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const mimeType = req.file.mimetype;
    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is required. Please set it in the AI Studio Secrets panel.' });
    }
    let contentsParts: any[] = [];

    // Handle Excel files by converting to CSV text
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      req.file.originalname.endsWith('.xlsx') ||
      req.file.originalname.endsWith('.xls') ||
      req.file.originalname.endsWith('.csv')
    ) {
      const isOldExcel = mimeType === 'application/vnd.ms-excel' || req.file.originalname.endsWith('.xls');
      const workbook = xlsx.read(req.file.buffer, { 
        type: 'buffer', 
        cellNF: true, 
        cellText: true,
        raw: false,
        codepage: isOldExcel ? 936 : undefined
      });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const csvData = xlsx.utils.sheet_to_csv(sheet);
      
      // Add UTF-8 BOM to ensure Chinese characters are preserved
      const bom = '\uFEFF';
      contentsParts.push({
        text: `Here is the data from an uploaded spreadsheet. Preserve ALL original characters including Chinese, Japanese, Korean, special symbols, etc. DO NOT convert or strip any characters:\n\n${bom}${csvData.substring(0, 50000)}`
      });
    } else {
      // Handle PDF and Images via inlineData
      const base64Data = req.file.buffer.toString('base64');
      contentsParts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      });
    }

    contentsParts.push({
      text: `You are an expert perfume wholesale data extractor. Extract all product rows from this quote document.

IMPORTANT COLUMN MAPPING LOGIC:
1. Find the BARCODE column: look for columns named "UPC", "條碼", "条码", "barcode" etc.
2. Find the Chinese PRODUCT NAME: 
   - Look for columns with Chinese names like "品名", "名称", "商品名称", "中文名", "產品名稱", "貨名" etc.
   - ALSO: if a row has TWO columns that both look like product names, one contains Chinese text and the other contains English text, ALWAYS use the Chinese one as PRIMARY name.
3. Find the English PRODUCT NAME: the other column with English product names.
4. If only one name column exists and it contains Chinese text, use it as name.

Example 1 (columns: English name | Chinese name):
AS Fantasia EDT 30ml | 獨角獸EDT
-> name = "獨角獸EDT", name_en = "AS Fantasia EDT 30ml"

Example 2 (columns with header):
R-CD-116817 | CLEAN | C_DIOR | 3348901116817 | CD FAHRENHEIT PARFUM SPRAY 75ML | DIOR 迪奧 華氏溫度香精噴霧 75ML | 5D01 | 2025.04.01 | | 665 | HK$640
-> barcode = 3348901116817, name = "DIOR 迪奧 華氏溫度香精噴霧 75ML", name_en = "CD FAHRENHEIT PARFUM SPRAY 75ML"

Return a JSON array of objects with these fields:
- barcode (string)
- name (string, Chinese product name - PRIMARY, ALWAYS prioritize Chinese)
- name_en (string, English product name if available)
- size (string)
- spec (string)
- price (number)
- currency (string)
- moq (number)
- status (string)
- batchNumber (string)
- supplier (string)
- date (string)
      `,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: contentsParts,
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              barcode: { type: Type.STRING },
              name: { type: Type.STRING },
              name_en: { type: Type.STRING },
              size: { type: Type.STRING },
              spec: { type: Type.STRING },
              price: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              moq: { type: Type.NUMBER },
              status: { type: Type.STRING },
              batchNumber: { type: Type.STRING },
              supplier: { type: Type.STRING },
              date: { type: Type.STRING },
            },
          },
        },
      },
    });

    const parsedData = JSON.parse(response.text || '[]');
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error parsing quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Decode Batch Number
app.post('/api/decode-batch', async (req, res) => {
  try {
    const { batchNumber, brand } = req.body;
    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is required. Please set it in the AI Studio Secrets panel.' });
    }
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Decode this perfume batch number: "${batchNumber}" for brand "${brand}". 
      Return a JSON object with "productionDate" (YYYY-MM-DD) and "expiryDate" (YYYY-MM-DD, usually 3-5 years after production).
      If you cannot determine exactly, provide your best estimate based on common industry formats.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productionDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
          },
        },
      },
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. AI Assistant
app.post('/api/ai-assistant', async (req, res) => {
  try {
    const { message, history } = req.body;
    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is required. Please set it in the AI Studio Secrets panel.' });
    }
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: '你是香港香水批發中間商的專業 AI 決策助手。請根據市場趨勢、庫存、利潤等提供專業的採購與銷售建議。使用繁體中文，語氣專業且具備商業洞察力。',
      },
    });

    // We could load history here if needed, but for simplicity we just send the message
    const response = await chat.sendMessage({ message });
    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Send Email
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html, attachments } = req.body;
    const resend = getResend();
    const data = await resend.emails.send({
      from: 'Perfume Tracker <onboarding@resend.dev>', // Use verified domain in prod
      to: [to],
      subject: subject,
      html: html,
      attachments: attachments,
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Fetch Image from Barcode
app.get('/api/fetch-image', async (req, res) => {
  try {
    const { barcode } = req.query;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Attempt to fetch from UPCItemDB (Free tier, no API key required for trial)
    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0 && data.items[0].images && data.items[0].images.length > 0) {
        return res.json({ imageUrl: data.items[0].images[0] });
      }
    }

    // Fallback to placeholder if not found or API fails
    res.json({ imageUrl: `https://picsum.photos/seed/${barcode}/400/400` });
  } catch (error: any) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
