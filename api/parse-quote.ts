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

function cleanResponse(text: string): string {
  // Remove thinking tags: <think>...</think>
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<strip思考>[\s\S]*?<\/strip思考>/gi, '')
    .trim();
  return cleaned;
}

function extractJson(text: string): any | null {
  const cleaned = cleanResponse(text);
  
  // Find JSON array or object
  const jsonPattern = /(\[[\s\S]*\]|\{[\s\S]*\})/;
  const match = cleaned.match(jsonPattern);
  
  if (!match) {
    console.log('No JSON found');
    return null;
  }
  
  let jsonStr = match[1];
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try fixing
    jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
    try {
      return JSON.parse(jsonStr);
    } catch (e2) {
      console.log('Parse failed:', jsonStr.substring(0, 100));
      return null;
    }
  }
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
      contentParts.push({ type: 'text', text: text });
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
            allCsvData += `Sheet: ${sheetName}\n${csvData}\n\n`;
          }
          
          contentParts.push({ 
            type: 'text', 
            text: `Data:\n${allCsvData.substring(0, 80000)}` 
          });
        } catch (e: any) {
          console.error('Excel error:', e.message);
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
      text: `Extract ALL products. Return ONLY JSON array. No markdown, no thinking tags.
Fields: barcode, name, size, spec, price, currency, moq, status, supplier
Example: [{"barcode":"123","name":"Test","size":"100ml","spec":"EDP","price":100,"currency":"HKD","moq":10,"status":"現貨","supplier":"YJQ"}]`
    });

    const messages = [{ role: 'user', content: contentParts }];
    const modelName = process.env.GEMINI_MODEL || 'MiniMax-M2.7';
    
    const requestBody = {
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
      return res.status(500).json({ error: `API Error ${response.status}`, detail: errorText });
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0]?.message?.content) {
      const responseText = result.choices[0].message.content;
      const cleaned = cleanResponse(responseText);
      
      const parsed = extractJson(cleaned);
      
      if (parsed) {
        return res.status(200).json(parsed);
      }
      
      return res.status(500).json({ 
        error: 'JSON解析失败',
        cleaned: cleaned.substring(0, 1000)
      });
    }
    
    return res.status(500).json({ error: 'No response content', details: result });

  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
