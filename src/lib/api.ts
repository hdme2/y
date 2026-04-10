import { supabase } from './supabase';

const TABLE_PREFIX = 'yjq2_';

export async function getProducts() {
  const { data, error } = await supabase.from(`${TABLE_PREFIX}products`).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProductByBarcode(barcode: string) {
  const { data, error } = await supabase.from(`${TABLE_PREFIX}products`).select('*').eq('barcode', barcode).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProduct(product: any) {
  if (!product.barcode) {
    return addProduct(product);
  }
  
  // Check for existing product with same barcode AND same supplier
  const { data: existingProducts, error: findError } = await supabase
    .from(`${TABLE_PREFIX}products`)
    .select('*')
    .eq('barcode', product.barcode)
    .eq('supplier', product.supplier || '')
    .maybeSingle();
  
  if (findError) throw findError;
  
  if (existingProducts) {
    // Update existing product with same barcode and supplier
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}products`)
      .update(product)
      .eq('id', existingProducts.id)
      .select();
    if (error) throw error;
    return data;
  }
  
  // Check if any product with same barcode exists (for name preference)
  const { data: anyExisting } = await supabase
    .from(`${TABLE_PREFIX}products`)
    .select('*')
    .eq('barcode', product.barcode)
    .maybeSingle();
  
  // Only use longer name if no supplier conflict
  if (anyExisting && (product.name || '').length > (anyExisting.name || '').length) {
    product.name = anyExisting.name;
  }
  
  return addProduct(product);
}

export async function addProduct(product: any) {
  const { data, error } = await supabase.from(`${TABLE_PREFIX}products`).insert([product]).select();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: any) {
  const { data, error } = await supabase.from(`${TABLE_PREFIX}products`).update(updates).eq('id', id).select();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from(`${TABLE_PREFIX}products`).delete().eq('id', id);
  if (error) throw error;
}

export async function deleteProductsBySupplier(supplier: string) {
  const trimmedSupplier = supplier.trim();
  if (!trimmedSupplier) return;
  
  let { error } = await supabase
    .from(`${TABLE_PREFIX}products`)
    .delete()
    .eq('supplier', trimmedSupplier);
  
  if (error) {
    console.error('Delete by exact supplier failed:', error);
    const { error: error2 } = await supabase
      .from(`${TABLE_PREFIX}products`)
      .delete()
      .ilike('supplier', `%${trimmedSupplier}%`);
    if (error2) throw error2;
  }
}

export async function getQuotes() {
  const { data, error } = await supabase.from(`${TABLE_PREFIX}quotes`).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addQuote(quote: any) {
  const { data, error } = await supabase.from(`${TABLE_PREFIX}quotes`).insert([quote]).select();
  if (error) throw error;
  return data;
}

export async function updateQuote(id: string, updates: any) {
  const { data, error } = await supabase.from(`${TABLE_PREFIX}quotes`).update(updates).eq('id', id).select();
  if (error) throw error;
  return data;
}

export async function deleteQuote(id: string) {
  const { error } = await supabase.from(`${TABLE_PREFIX}quotes`).delete().eq('id', id);
  if (error) throw error;
}

export async function getSettings() {
  try {
    const { data, error } = await supabase
      .from(`${TABLE_PREFIX}settings`)
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) {
      console.log('getSettings error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.log('getSettings exception:', e);
    return null;
  }
}

export async function updateSettings(updates: any) {
  try {
    const { data: existing } = await supabase
      .from(`${TABLE_PREFIX}settings`)
      .select('id')
      .limit(1)
      .maybeSingle();
    
    if (existing?.id) {
      const { data, error } = await supabase
        .from(`${TABLE_PREFIX}settings`)
        .update(updates)
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from(`${TABLE_PREFIX}settings`)
        .insert([updates])
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  } catch (e) {
    console.log('updateSettings error:', e);
    throw e;
  }
}

export async function uploadImage(file: File, bucket: string = 'images') {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
