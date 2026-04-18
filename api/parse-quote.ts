import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as xlsx from 'xlsx';

function getConfig() {
  const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.VITE_BASE_URL || process.env.GEMINI_BASE_URL;
  
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
    return null;
  }
  
  return { apiKey, baseUrl };
}

function isOpenAIFormat(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  return !baseUrl.includes('googleapis.com');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    if (!config) {
      return res.status(500).json({ error: 'VITE_API_KEY environment variable is required' });
    }

    const mimeType = req.body?.mimeType;
    const text = req.body?.text;
    const file = req.body?.file;
    
    let content: any = { role: 'user', parts: [] };

    if (text) {
      content.parts.push({ text: text });
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
          
          content.parts.push({ text: `Data:\n${allCsvData.substring(0, 80000)}` });
        } catch (e: any) {
          console.error('Excel error:', e.message);
          return res.status(500).json({ error: `Excel解析失败: ${e.message}` });
        }
      } else {
        const base64Data = fileBuffer.toString('base64');
        content.parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType || 'image/png',
          },
        });
      }
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }

    content.parts.push({
      text: `Extract ALL products. Return ONLY JSON array.
Fields: barcode, name, size, spec, price, currency, moq, status, supplier
Example: [{"barcode":"123","name":"Test","size":"100ml","spec":"EDP","price":100,"currency":"HKD","moq":10,"status":"現貨","supplier":"YJQ"}]`
    });

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    let apiUrl: string;
    let requestBody: any;
    const useOpenAIFormat = isOpenAIFormat(config.baseUrl);

    if (useOpenAIFormat) {
      const base = config.baseUrl!.replace(/\/$/, '');
      apiUrl = `${base}/chat/completions`;
      
      const textContent = content.parts.map((p: any) => p.text || '').join('\n');
      let imageContent = null;
      
      if (content.parts[0]?.inlineData) {
        imageContent = {
          type: 'image_url',
          image_url: {
            url: `data:${content.parts[0].inlineData.mimeType};base64,${content.parts[0].inlineData.data}`
          }
        };
      }
      
      requestBody = {
        model: modelName,
        messages: [{
          role: 'user',
          content: imageContent 
            ? [{ type: 'text', text: textContent }, imageContent]
            : textContent
        }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      };
    } else {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
      requestBody = {
        contents: [content],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        }
      };
    }

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `API Error ${response.status}`, detail: errorText });
    }

    const result = await response.json();
    
    if (useOpenAIFormat) {
      const text = result.choices?.[0]?.message?.content;
      if (text) {
        try {
          const parsedData = JSON.parse(text);
          return res.status(200).json(parsedData);
        } catch (e) {
          return res.status(500).json({ error: 'JSON解析失败', raw: text.substring(0, 500) });
        }
      }
    } else if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
      const text = result.candidates[0].content.parts[0].text;
      try {
        const parsedData = JSON.parse(text);
        return res.status(200).json(parsedData);
      } catch (e) {
        return res.status(500).json({ error: 'JSON解析失败', raw: text.substring(0, 500) });
      }
    }
    
    return res.status(500).json({ error: 'Invalid response', details: result });

  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
