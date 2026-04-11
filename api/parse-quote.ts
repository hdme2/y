import * as xlsx from 'xlsx';

function getConfig() {
  const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.VITE_BASE_URL || 'https://openrouter.ai/api/v1';
  
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
    let fileText = '';

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
      
      const isPDF = mimeType?.includes('pdf');

      if (isExcel) {
        try {
          const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
          const sheetNames = workbook.SheetNames;
          let allCsvData = '';
          
          for (const sheetName of sheetNames) {
            const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
            allCsvData += `=== 工作表: ${sheetName} ===\n${csvData}\n\n`;
          }
          
          fileText = allCsvData.substring(0, 50000);
          contentParts.push({ type: 'text', text: `Here is the data from an uploaded spreadsheet with ${sheetNames.length} worksheets (CSV format):\n\n${fileText}` });
        } catch (e) {
          console.error('Excel parsing failed:', e);
          contentParts.push({ type: 'text', text: 'Failed to parse Excel file. Please convert to image or use a different format.' });
        }
      } else if (isPDF) {
        contentParts.push({ type: 'text', text: 'PDF parsing not fully supported. Please convert PDF to image for better results.' });
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
Return a JSON array of objects. Each object MUST have these fields:
- barcode (string, the EAN/UPC barcode, prioritize this)
- name (string, product name)
- size (string, e.g., '100ml')
- spec (string, e.g., 'EDP', 'EDT')
- price (number)
- currency (string, e.g., 'USD', 'EUR', 'HKD', 'RMB')
- moq (number)
- status (string, e.g., '現貨', '期貨', '途中', '預訂')
- batchNumber (string, if available)
- supplier (string, infer from document header if available)
- date (string, YYYY-MM-DD, infer from document if available)

Return ONLY the JSON array, no additional text.`
    });

    const messages = [{ role: 'user', content: contentParts }];
    const modelName = process.env.GEMINI_MODEL || 'google/gemini-2.5-flash';
    
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
        'HTTP-Referer': 'https://y-theta-brown.vercel.app',
        'X-Title': 'Perfume Quote Parser'
      },
      body: JSON.stringify(requestBody)
    };

    console.log('API URL:', apiUrl);
    console.log('Model:', modelName);
    console.log('File type:', mimeType);
    console.log('Content parts count:', contentParts.length);

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        const msg = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson);
        return res.status(500).json({ error: msg });
      } catch {
        return res.status(500).json({ error: errorText });
      }
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0]?.message?.content) {
      const text = result.choices[0].message.content;
      console.log('Raw response:', text.substring(0, 500));
      try {
        const parsedData = JSON.parse(text);
        return res.status(200).json(parsedData);
      } catch {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            return res.status(200).json(JSON.parse(jsonMatch[0]));
          } catch {}
        }
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            return res.status(200).json(JSON.parse(objMatch[0]));
          } catch {}
        }
        return res.status(500).json({ error: 'Failed to parse JSON from response', raw: text.substring(0, 1000) });
      }
    }
    
    return res.status(500).json({ error: 'Invalid API response', details: result });

  } catch (error: any) {
    console.error('Error parsing quote:', error);
    res.status(500).json({ error: error.message });
  }
}
