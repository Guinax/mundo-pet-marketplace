export const SERVICE_HOURS = 'Dias úteis, das 9h às 18h (horário de Brasília)';
export const validFulfillment = value => value === 'pickup' || value === 'delivery';
export function fulfillmentEligibility(mode, items, products, stores, address = {}) {
  if (!validFulfillment(mode)) return { error: 'Escolha receber em casa ou retirar na loja.' };
  if (!items.length) return { error: 'Seu carrinho está vazio.' };
  const selected = items.map(item => products.find(p => p.id === item.product_id));
  if (selected.some(p => !p)) return { error: 'Atualize os produtos do carrinho.' };
  const ids = [...new Set(selected.map(p => p.store_id))];
  if (ids.length !== 1) return { error: 'Finalize os produtos de uma loja por vez. Cada loja tem seu ponto de retirada.' };
  const store = stores.find(s => s.id === ids[0]);
  if (!store || store.is_demo || !store.address?.trim()) return { error: 'A loja ainda não está disponível para compras reais.' };
  if (selected.some(p => p[mode === 'pickup' ? 'pickup_enabled' : 'delivery_enabled'] === false))
    return { error: 'Um produto não permite essa modalidade. Escolha outra opção ou ajuste o carrinho.' };
  if (mode === 'delivery' && (!address.street || !address.number || !address.city || !address.state))
    return { error: 'Complete seu endereço para calcular a entrega.' };
  return { store };
}
export function orderFulfillmentLabel(order) {
  const pickup = order.fulfillment_method === 'pickup';
  if (order.status === 'delivered') return pickup ? 'Retirado na loja' : 'Entregue';
  if (order.status === 'ready' && pickup) return 'Pronto para retirada';
  if (order.scheduled_for && new Date(order.scheduled_for) > new Date() && !['canceled','delivering','assigned'].includes(order.status))
    return 'Agendado para o próximo atendimento';
  return null;
}
