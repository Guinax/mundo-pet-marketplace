export const sectorImages = {
  veterinary: '/media/sectors/veterinaria.webp',
  grooming: '/media/sectors/banho-e-tosa.webp',
  pharmacy: '/media/sectors/pet-shop-farmacia.webp',
  shop: '/media/sectors/pet-shop-farmacia.webp',
};
export const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export function selectProducts(products, { category = '', search = '', brand = '', inStock = false, sort = 'relevance', maxPrice = 0, favorites = null } = {}) {
  const query = normalizeSearch(search);
  const selected = products.filter(p => p.active !== false && !['pending','rejected'].includes(p.approval_status)
    && (!category || p.category === category)
    && (!brand || p.brand === brand)
    && (!inStock || p.stock > 0)
    && (!maxPrice || p.price_cents <= maxPrice)
    && (!favorites || favorites.includes(p.id))
    && normalizeSearch([p.name, p.brand, p.category, p.description].filter(Boolean).join(' ')).includes(query));
  if (sort === 'price-asc') selected.sort((a,b) => a.price_cents - b.price_cents);
  if (sort === 'price-desc') selected.sort((a,b) => b.price_cents - a.price_cents);
  if (sort === 'name') selected.sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
  return selected;
}
export function packagingLabel(product) {
  const ml = Number(product.volume_ml), kg = Number(product.weight_kg);
  if (ml > 0) return new Intl.NumberFormat('pt-BR').format(ml) + ' mL';
  if (kg > 0) return new Intl.NumberFormat('pt-BR').format(kg) + ' kg';
  return '';
}
export function productImages(product) {
  const images = [product.image_url, ...(Array.isArray(product.images) ? product.images.map(x => typeof x === 'string' ? x : x?.url) : [])];
  return [...new Set(images.filter(x => typeof x === 'string' && x.startsWith('https://')))];
}
export const productUrl = id => '/mundo_pet_produto/?id=' + encodeURIComponent(id);
