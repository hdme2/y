import * as xlsx from 'xlsx';

function getConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  
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
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY environment variable is required' });
    }

    const mimeType = req.body.mimeType;
    const text = req.body.text;
    const file = req.body.file;
    
    const messages: any[] = [];
    let contentParts: any[] = [];

    if (text) {
      contentParts.push({
        type: 'text',
        text: `Here is the data from a quote document (text format):\n\n${text}`
      });
    } else if (file) {
      if (!mimeType) {
        return res.status(400).json({ error: 'No file or text provided' });
      }
      
      const fileBuffer = Buffer.from(file, 'base64');

      if (
        mimeType?.includes('spreadsheet') ||
        mimeType?.includes('excel') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        try {
          const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
          const sheetNames = workbook.SheetNames;
          let allCsvData = '';
          
          for (const sheetName of sheetNames) {
            const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
            allCsvData += `=== 工作表: ${sheetName} ===\n${csvData}\n\n`;
          }
          
          contentParts.push({
            type: 'text',
            text: `Here is the data from an uploaded spreadsheet with ${sheetNames.length} worksheets (CSV format):\n\n${allCsvData.substring(0, 50000)}`
          });
        } catch (e) {
        }
      }

      if (contentParts.length === 0) {
        const base64Data = fileBuffer.toString('base64');
        const imageMimeType = mimeType?.includes('pdf') ? 'application/pdf' : (mimeType || 'image/png');
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${imageMimeType};base64,${base64Data}`
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

    messages.push({
      role: 'user',
      content: contentParts
    });

    const modelName = process.env.DEEPSEEK_MODEL || 'deepseek-v4.0';
    
    const requestBody: any = {
      model: modelName,
      messages: messages,
      temperature: 0.1,
    };

    if (modelName.includes('deepseek-v4.0')) {
      requestBody.max_tokens = 4096;
      requestBody.response_format = { type: 'json_object' };
    }

    const apiUrl = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    };

    console.log('API URL:', apiUrl);
    console.log('Model:', modelName);

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
      const parsedData = JSON.parse(result.choices[0].message.content);
      return res.status(200).json(parsedData);
    }
    
    return res.status(500).json({ error: 'Invalid API response', details: result });

  } catch (error: any) {
    console.error('Error parsing quote:', error);
    res.status(500).json({ error: error.message });
  }
}
