# Mundo Pet

Aplicação React/Vite com o visual móvel do Stitch e funcionalidades conectadas ao Supabase da conta escolhida. O runtime compartilhado atende as oito rotas; a entrada React conserva o acesso pela Home.

## Funcionalidades

- Login por e-mail e senha e criação de conta com confirmação por e-mail.
- Perfil do tutor, endereço, validação de CPF e cadastro/edição de múltiplos pets, incluindo foto privada.
- Catálogo, busca, categorias, favoritos e carrinho persistente neste navegador.
- Pedidos de demonstração com preços calculados no servidor, estoque transacional, idempotência e cupom MUNDOPET10.
- Agendamentos de demonstração vinculados ao pet, com horários sem sobreposição.
- Pet shop: disponibilidade, pedidos, catálogo, preço e estoque; veterinário: agenda, pacientes e anotações clínicas; entregador: online, ofertas, aceite, coleta e conclusão por código; administrador: credenciamento e visão das operações.
- Conversa restrita aos participantes do pedido; comprovante/etiqueta imprimível; rota externa no Google Maps.
- Todas as tabelas mp_ usam RLS. Apenas a chave pública do cliente é empacotada. Funções privilegiadas ficam no schema não exposto mp_private.

## Desenvolvimento

`npm ci`, `npm run dev`, `npm test`, `npm run build`.

O `vite.config.js` prepara as rotas estáticas e a entrada `assets/runtime.js` no desenvolvimento e no build. Os arquivos HTML carregam fontes do Google e o CSS local.

## Banco

Os scripts em `database/` descrevem as alterações aplicadas. `schema.sql` é o snapshot inicial; `photos.sql` e `coupon.sql` adicionam os recursos correspondentes. Não reaplicar scripts de criação no banco já instalado. `verify.sql` roda fixtures dentro de uma transação e termina com rollback, sem criar/excluir contas reais nem deixar pedidos de teste.

## Acesso e operação

O administrador único confirmado no banco em 25/10/2026 é wap33000@gmail.com. A conta de infraestrutura do Mundo Pet é wap33003@gmail.com. Parceiros solicitam credenciamento pelo perfil; somente o administrador pode aprová-los. Não se atribui papel profissional por dados editáveis do usuário.

Cadastros e fotos são persistidos de verdade. A loja e os serviços de catálogo iniciais são explicitamente demonstrativos. Compras, agendamentos, entrega e cupom podem ser exercitados de ponta a ponta sem cobrança ou contratação real. As funções de compra/agendamento bloqueiam ofertas reais até concluir o cadastro operacional. Pix/cartão, cobrança, webhooks, comissões, repasses/saques, disponibilidade real de profissionais, teleconsulta e assinatura de receitas ainda exigem configuração e integração próprias. A interface não afirma que esses serviços foram ativados e não fabrica saldos.

O projeto Joias e seus registros mj_ foram preservados. A Adega Maromba não foi modificada. Não foram excluídos usuários.


## Estado verificado em 25/10/2026

O checkout de produtos usa as Edge Functions `mp-delivery-quote`, `mp-secure-checkout`, `mp-infinitepay` e `mp-infinitepay-webhook`, com recebedor `wgsolucoesfinaceira`. Seus fontes implantados foram copiados para `supabase/functions/` nesta revisão. Não inclua credenciais nesses fontes.

O frete e o checkout estão bloqueados porque `GOOGLE_MAPS_API_KEY` não está disponível no ambiente das Edge Functions do projeto `sppecskjgggfahokgccc`. Configurar apenas uma variável na Vercel não resolve esse ambiente. Validar Routes API, faturamento e restrições da chave no mesmo projeto Google Cloud antes de testar novamente. `INFINITEPAY_API_KEY` é lida opcionalmente pelo código; sua presença não foi confirmada.

A correção local de CORS de `mp-infinitepay` permite `x-client-info`, usado pelo cliente Supabase. Ela ainda precisa de implantação autorizada; nenhuma alteração desta revisão foi publicada.

O schema inicial e as instruções demonstrativas acima não refletem todos os objetos implantados. Não recrie o banco a partir desse snapshot. As 17 tabelas públicas têm RLS; sete funções públicas SECURITY DEFINER têm verificações de identidade/papel e precisam continuar sendo avaliadas caso a autorização mude. Agendamento comercial, repasses e saques não estão habilitados.
