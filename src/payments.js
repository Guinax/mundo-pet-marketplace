export function approvedPaymentUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    return host === 'checkout.infinitepay.com.br' || host === 'infinitepay.io' || host.endsWith('.infinitepay.io') ? url.href : null;
  } catch { return null; }
}

export function paymentActions(order) {
  const eligible = !order.is_demo && ['infinitepay_pix', 'infinitepay_card'].includes(order.payment_method);
  const pending = order.status === 'pending' && order.payment_status === 'unpaid';
  return {
    pay: eligible && pending,
    check: eligible && order.status !== 'canceled' && order.payment_status === 'unpaid' && Boolean(order.payment_checkout_url || order.payment_provider === 'infinitepay'),
    cancel: pending && !order.payment_checkout_url,
  };
}

// A payment for an earlier order must not erase items added afterwards.
export function cartAfterPayment(items, paidItems) {
  const purchased = new Map();
  for (const item of paidItems) {
    if (typeof item.product_id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0)
      purchased.set(item.product_id, (purchased.get(item.product_id) || 0) + item.quantity);
  }
  return items.map(item => ({ ...item, quantity: Math.max(0, item.quantity - (purchased.get(item.product_id) || 0)) }))
    .filter(item => item.quantity > 0);
}

export function paymentIssueMessage(code, admin = false) {
  const publicMessages = {
    maps_not_configured: 'A entrega está temporariamente indisponível. Tente novamente mais tarde.',
    maps_credential_invalid: 'A entrega está temporariamente indisponível. A loja precisa revisar a integração de frete.',
    store_unavailable: 'A loja está fechada ou ainda não pode realizar entregas.',
    delivery_address_incomplete: 'Complete o endereço de entrega no seu perfil.',
    route_provider_failed: 'Não foi possível consultar a rota agora. Confira seu endereço e tente novamente.',
    shipping_provider_failed: 'Não foi possível confirmar o frete. Confira seu endereço e tente novamente.',
    route_unavailable: 'Não foi encontrada uma rota até o endereço informado.',
    route_not_found: 'Não foi encontrada uma rota até o endereço informado.',
    route_service_unreachable: 'O serviço de rotas não respondeu. Tente novamente.',
    authentication_required: 'Entre na sua conta para continuar.',
    invalid_session: 'Sua sessão expirou. Entre novamente na sua conta.',
    invalid_checkout: 'Confira os dados do carrinho e tente novamente.',
    invalid_cart: 'Confira as quantidades e os produtos do carrinho.',
    product_unavailable: 'Um produto ficou indisponível. Atualize o carrinho.',
    multiple_stores: 'Finalize os produtos de uma loja por vez.',
    order_creation_failed: 'Não foi possível registrar o pedido. Atualize o carrinho e tente novamente.',
    payment_link_failed: 'Seu pedido foi salvo, mas o pagamento não abriu. Tente novamente em Meus pedidos.',
    payment_url_invalid: 'Não foi possível abrir um endereço seguro de pagamento. Tente novamente em Meus pedidos.',
  };
  if (admin && code === 'maps_credential_invalid') return 'O valor do segredo Google Maps tem formato de hash SHA-256. Substitua o Valor pela chave original do Google Cloud; não copie o Digest.';
  if (admin && code === 'maps_not_configured') return 'Cadastre GOOGLE_MAPS_API_KEY nos segredos das funções do Supabase do Mundo Pet.';
  if (admin && ['server_not_configured', 'checkout_not_configured'].includes(code)) return 'A configuração do checkout no Supabase está incompleta. Revise os segredos do projeto.';
  return publicMessages[code] || 'Não foi possível concluir esta etapa. Tente novamente.';
}
