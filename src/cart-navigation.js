const cartPath='/mundo_pet_carrinho_checkout_rastreio/';
export function cartNavigation(itemCount,ordersOnly=false) {
 const count=Number.isSafeInteger(itemCount)&&itemCount>0?itemCount:0;
 const tabs=`<nav class="mp-scrollrow" aria-label="Sacola e pedidos" style="margin-bottom:16px"><a class="mp-btn ${ordersOnly?'outline':''}" href="${cartPath}" ${ordersOnly?'':'aria-current="page"'}>Sacola (${count})</a><a class="mp-btn ${ordersOnly?'':'outline'}" href="${cartPath}?orders=1" ${ordersOnly?'aria-current="page"':''}>Meus pedidos</a></nav>`;
 const reminder=ordersOnly&&count?`<section class="mp-card"><h2>Sua compra ainda está na sacola</h2><p>Você tem ${count} ${count===1?'item':'itens'} para finalizar. Esses produtos ainda não viraram um pedido.</p><p class="mp-muted">Escolha entrega ou retirada e continue para o pagamento.</p><a class="mp-btn mp-full" href="${cartPath}">Finalizar compra</a></section>`:'';
 return {tabs,reminder};
}
