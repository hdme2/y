export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { barcode } = req.query;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const cleanBarcode = barcode.replace(/[^0-9]/g, '');

    const apis = [
      // UPC Item DB - 尝试多次
      { 
        url: `https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`, 
        extract: (data: any) => {
          if (data.items && data.items[0]) {
            const item = data.items[0];
            // 优先选择大图
            return item.images?.[0] || item.medium_image || item.small_image;
          }
          return null;
        }
      },
      // Open Food Facts - 适合化妆品
      { 
        url: `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`, 
        extract: (data: any) => {
          const p = data.product;
          if (p) {
            return p.image_url || p.image_front_url || p.image_front_small_url;
          }
          return null;
        }
      },
      // Google Custom Search API (如果有配置)
      ...(process.env.GOOGLE_SEARCH_KEY ? [{
        url: `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_KEY}&cx=${process.env.GOOGLE_CX_ID}&q=${encodeURIComponent(cleanBarcode + ' perfume')}&searchType=image`,
        extract: (data: any) => data.items?.[0]?.link
      }] : []),
      // 尝试搜索引擎备用方案 - 通过 DuckDuckGo
      {
        url: `https://duckduckgo.com/?q=${cleanBarcode}+perfume+buy&ia=products`,
        extract: () => null // 需要解析HTML，比较复杂
      }
    ];

    for (const api of apis) {
      try {
        const response = await fetch(api.url, {
          headers: api.url.includes('rapidapi') ? {
            'X-RapidAPI-Key': process.env.BARCODE_API_KEY || '',
            'X-RapidAPI-Host': 'barcode-lookup.p.rapidapi.com'
          } : {}
        });
        
        if (response.ok) {
          const data = await response.json();
          const imageUrl = api.extract(data);
          if (imageUrl && imageUrl.startsWith('http')) {
            return res.status(200).json({ imageUrl });
          }
        }
      } catch (e) {
        console.log('API failed, trying next...');
      }
    }

    // 如果都失败了，返回空，让前端显示默认图
    res.status(200).json({ imageUrl: null });
  } catch (error: any) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: error.message });
  }
}
