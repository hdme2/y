import * as xlsx from 'xlsx';

function getConfig() {
  const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.VITE_BASE_URL || 'https://api.minimaxi.com/v1';
  
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
    return null;
  }
  
  return { apiKey, baseUrl };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

function extractJson(text: string): string {
  // Remove thinking tags
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // Find the first [ or { and take from there
  const firstBracket = cleaned.match(/[\[{]/);
  if (firstBracket) {
    const startIndex = cleaned.indexOf(firstBracket[0]);
    cleaned = cleaned.substring(startIndex);
  }
  
  return cleaned.trim();
}

function tryParseJson(text: string): any {
  const cleaned = extractJson(text);
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {}
  
  const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      try {
        const fixed = match[1].replace(/,(\s*[\]}])/g, '$1');
        return JSON.parse(fixed);
      } catch (e2) {}
    }
  }
  
  return null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    if (!config) {
      return res.status(500).json({ error: 'VITE_API_KEY environment variable is required' });
    }

    const mimeType = req.body.mimeType;
    const text = req.body.text;
    const file = req.body.file;
    
    let contentParts: any[] = [];

    if (text) {
      contentParts.push({ type: 'text', text: `Here is the data from a quote document (text format):\n\n${text}` });
    } else if (file) {
      if (!mimeType) {
        return res.status(400).json({ error: 'No file or text provided' });
      }
      
      const fileBuffer = Buffer.from(file, 'base64');

      const isExcel = mimeType?.includes('spreadsheet') || 
                      mimeType?.includes('excel') || 
                      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                      mimeType === 'application/vnd.ms-excel';
      
      if (isExcel) {
        try {
          const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
          const sheetNames = workbook.SheetNames;
          let allCsvData = '';
          
          for (const sheetName of sheetNames) {
            const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
            allCsvData += `=== 工作表: ${sheetName} ===\n${csvData}\n\n`;
          }
          
          const csvText = allCsvData.substring(0, 50000);
          contentParts.push({ type: 'text', text: `Here is the data from an uploaded spreadsheet with ${sheetNames.length} worksheets (CSV format):\n\n${csvText}` });
        } catch (e: any) {
          console.error('Excel parsing error:', e);
          return res.status(500).json({ error: `Excel解析失败: ${e.message}` });
        }
      } else {
        const base64Data = fileBuffer.toString('base64');
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`
          }
        });
      }
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    contentParts.push({
      type: 'text',
      text: `You are an expert perfume wholesale data extractor. Extract ALL product rows from this quote document. Do not skip any products.
IMPORTANT: Return ONLY a valid JSON array, no markdown, no code blocks, no thinking tags. Example: [{"barcode":"123","name":"Test"}]

Required fields:
- barcode (string, EAN/UPC barcode)
- name (string, product name)
- size (string, e.g., '100ml')
- spec (string, e.g., 'EDP', 'EDT')
- price (number)
- currency (string, e.g., 'HKD', 'USD')
- moq (number)
- status (string, e.g., '現貨', '期貨')
- supplier (string, from document header if available)

IMPORTANT: Extract ALL products, do not stop early. Return the complete JSON array.`
    });

    const messages = [{ role: 'user', content: contentParts }];
    const modelName = process.env.GEMINI_MODEL || 'MiniMax-M2.7';
    
    const requestBody: any = {
      model: modelName,
      messages: messages,
      temperature: 0.1,
      max_tokens: 8192,
    };

    const apiUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody)
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      return res.status(500).json({ error: `API Error ${response.status}: ${errorText}` });
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0]?.message?.content) {
      const responseText = result.choices[0].message.content;
      const parsed = tryParseJson(responseText);
      
      if (parsed) {
        return res.status(200).json(parsed);
      }
      
      // If still fails, show cleaned content
      const cleaned = extractJson(responseText);
      return res.status(500).json({ 
        error: `JSON解析失败`,
        cleaned: cleaned.substring(0, 1000)
      });
    }
    
    return res.status(500).json({ error: 'Invalid API response', details: result });

  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
