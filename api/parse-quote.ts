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
  let jsonStr = text.trim();
  
  // Remove thinking tags like <think>...</think> or just <think> without closing tag
  jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // Also remove any remaining thinking content before first JSON character
  const firstBracket = jsonStr.search(/[\[{]/);
  if (firstBracket > 0) {
    jsonStr = jsonStr.substring(firstBracket);
  }
  
  // Try to extract JSON array or object
  const match = jsonStr.match(/^(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) {
    jsonStr = match[1];
  }
  
  return jsonStr;
}

function findJsonInText(text: string): any {
  // Try to find and parse JSON array or object anywhere in text
  const bracketMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (bracketMatch) {
    try {
      return JSON.parse(bracketMatch[1]);
    } catch (e) {
      // Try to fix common issues
      try {
        // Remove trailing commas
        const fixed = bracketMatch[1].replace(/,(\s*[\]}])/g, '$1');
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
        } catch (e) {
          console.error('Excel parsing error:', e);
          return res.status(500).json({ error: 'Failed to parse Excel file. Please convert to image format.' });
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
      text: `You are an expert perfume wholesale data extractor. Extract all product rows from this quote document.
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
- supplier (string, from document header if available)`
    });

    const messages = [{ role: 'user', content: contentParts }];
    const modelName = process.env.GEMINI_MODEL || 'MiniMax-M2.7';
    
    const requestBody: any = {
      model: modelName,
      messages: messages,
      temperature: 0.1,
      max_tokens: 4096,
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
      
      // Try to extract and parse JSON
      const jsonStr = extractJson(responseText);
      try {
        const parsedData = JSON.parse(jsonStr);
        return res.status(200).json(parsedData);
      } catch (e) {
        // Try to find JSON anywhere in text
        const found = findJsonInText(responseText);
        if (found) {
          return res.status(200).json(found);
        }
        console.error('JSON parse failed');
        console.error('Cleaned:', jsonStr.substring(0, 300));
        return res.status(500).json({ 
          error: `JSON解析失败`,
          raw: responseText.substring(0, 500)
        });
      }
    }
    
    return res.status(500).json({ error: 'Invalid API response', details: result });

  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
