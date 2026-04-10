-- 香水批發追蹤君 - 資料庫初始化腳本
-- 表名前綴：YJQ (與其他項目區分)

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 產品主檔表
CREATE TABLE IF NOT EXISTS yjq_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode VARCHAR(50),
  sku VARCHAR(50),
  custom_code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  size VARCHAR(50),
  spec VARCHAR(50),
  price DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'HKD',
  moq INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT '現貨',
  batch_number VARCHAR(100),
  supplier VARCHAR(255),
  product_date DATE,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 客戶表 (CRM)
CREATE TABLE IF NOT EXISTS yjq_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 報單記錄表
CREATE TABLE IF NOT EXISTS yjq_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier VARCHAR(255),
  name VARCHAR(255),
  item_count INTEGER,
  product_ids TEXT[],
  currency VARCHAR(10) DEFAULT 'HKD',
  margin INTEGER DEFAULT 15,
  quantity INTEGER DEFAULT 100,
  total_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 系統設定表
CREATE TABLE IF NOT EXISTS yjq_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 啟用 RLS
ALTER TABLE yjq_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjq_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjq_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjq_settings ENABLE ROW LEVEL SECURITY;

-- 允許匿名讀寫
CREATE POLICY "Allow all for yjq_products" ON yjq_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for yjq_customers" ON yjq_customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for yjq_quotes" ON yjq_quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for yjq_settings" ON yjq_settings FOR ALL USING (true) WITH CHECK (true);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_products_barcode ON yjq_products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON yjq_products(sku);
CREATE INDEX IF NOT EXISTS idx_products_custom_code ON yjq_products(custom_code);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON yjq_products(supplier);
CREATE INDEX IF NOT EXISTS idx_customers_name ON yjq_customers(name);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON yjq_quotes(created_at DESC);
