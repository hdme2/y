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

// Robust JSON extractor
function extractJson(text: string): any | null {
  // Step 1: Remove thinking tags completely
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
  
  // Step 2: Find JSON array or object
  const jsonPattern = /(\[[\s\S]*\]|\{[\s\S]*\})/;
  const match = cleaned.match(jsonPattern);
  
  if (!match) {
    console.log('No JSON pattern found in response');
    return null;
  }
  
  let jsonStr = match[1];
  
  // Step 3: Try to parse
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Step 4: Try to fix common issues
    try {
      // Remove trailing commas
      jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
      // Remove control characters
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');
      return JSON.parse(jsonStr);
    } catch (e2) {
      console.log('Failed to parse JSON after cleanup');
      console.log('JSON snippet:', jsonStr.substring(0, 200));
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

    // Handle text input
    if (text) {
      contentParts.push({ type: 'text', text: text });
    }
    // Handle file input
    else if (file) {
      if (!mimeType) {
        return res.status(400).json({ error: 'No file or text provided' });
      }
      
      const fileBuffer = Buffer.from(file, 'base64');
      
      // Check if Excel
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
            allCsvData += `=== Sheet: ${sheetName} ===\n${csvData}\n\n`;
          }
          
          contentParts.push({ 
            type: 'text', 
            text: `Here is spreadsheet data in CSV format:\n\n${allCsvData.substring(0, 80000)}` 
          });
        } catch (e: any) {
          console.error('Excel parse error:', e);
          // If Excel fails, try as text
          contentParts.push({ 
            type: 'text', 
            text: `File data (base64): ${file.substring(0, 1000)}...` 
          });
        }
      } else {
        // Image or PDF - send as base64
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

    // Add extraction prompt
    contentParts.push({
      type: 'text',
      text: `Extract ALL product rows from this document. Return ONLY a JSON array.
Do NOT include any text before or after the JSON. Do NOT use markdown. Do NOT include thinking tags.
Example valid response: [{"barcode":"123","name":"Product"}]

Fields: barcode, name, size, spec, price, currency, moq, status, supplier`
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

    console.log('Calling API with model:', modelName);

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      return res.status(500).json({ error: `API Error ${response.status}`, detail: errorText });
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0]?.message?.content) {
      const responseText = result.choices[0].message.content;
      console.log('Response length:', responseText.length);
      console.log('Response start:', responseText.substring(0, 200));
      
      const parsed = extractJson(responseText);
      
      if (parsed) {
        return res.status(200).json(parsed);
      }
      
      return res.status(500).json({ 
        error: 'Failed to parse JSON from response',
        responseLength: responseText.length,
        responseStart: responseText.substring(0, 500)
      });
    }
    
    return res.status(500).json({ error: 'No content in response', details: result });

  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
