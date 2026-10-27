# Entrega e retirada

- O checkout inicia sem modalidade. O cliente escolhe entrega ou retirada antes de pagar.
- Retirada tem frete zero, não exige endereço residencial nem Google Maps e salva o endereço da loja no pedido.
- Entrega exige endereço e cotação de rota verificada no servidor: R$ 5 até 3 km, mais R$ 1,50 por km excedente, proporcional à distância e arredondado ao centavo.
- A compra fica disponível 24 horas. Atendimento ocorre nos dias úteis, das 9h às 18h, em America/Sao_Paulo. Às 18h já não são liberadas novas coletas.
- Pedidos fora do atendimento recebem a próxima janela, exibida antes do pagamento. O calendário exclui fins de semana, datas fixas nacionais, 9 de julho/SP, Sexta-feira Santa e datas adicionais de `mp_business_closures`.
- A rotina `mp-prepare-business-queue` organiza pedidos pagos às 8h de Brasília, sem aceitar pedidos pela loja nem atribuir entregadores.
- Ofertas de entrega só aparecem para entregadores aprovados e online quando há pagamento confirmado, status pronto, loja aberta, janela válida e modalidade entrega. A atribuição administrativa passa pela mesma proteção no banco.
- A retirada é concluída pela loja/administrador com o PIN do comprador, após o status pronto. Não passa pelas etapas de entregador atribuído ou em entrega.
- O acompanhamento do cliente mostra agendamento, modalidade e status pronto. A página atualiza enquanto visível; não foi incluído um novo serviço de notificações push em segundo plano.
- O estoque é reservado na criação do pedido. Repetir a mesma solicitação não reserva novamente. Cancelar um pedido ainda sem pagamento iniciado devolve a reserva. Pedidos com cobrança iniciada mantêm o fluxo existente de conferência/estorno.
- O código anterior dos pedidos é preservado. Pedidos existentes continuam como entrega; novos campos são aditivos.

## Verificação

`npm test` cobre modalidade obrigatória, retirada sem endereço/Maps, restrições por produto, carrinho com várias lojas e envio da modalidade ao servidor. O build Vite passa.

`database/fulfillment.verify.sql` exercita criação, reserva, repetição, cancelamento, permissões e calendário em transação revertida, sem realizar pagamentos. Uma transação financeira real na InfinitePay ainda depende de teste autorizado pelo titular.

Não foi implementada telemedicina nem venda a granel nesta alteração.
