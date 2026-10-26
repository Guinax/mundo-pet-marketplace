# Mundo Pet Marketplace

Aplicação React/Vite com cadastro de tutores e pets, catálogo, carrinho, checkout InfinitePay e painéis de lojas, profissionais, entregadores e administração.

## Atualização 0.6.0 — 26/10/2026

- Meus pedidos permite continuar um pagamento pendente e consultar sua confirmação. A retomada usa o mesmo pedido e o endpoint autenticado da InfinitePay.
- O retorno do provedor só confirma pagamento depois da consulta do servidor. Os dados de retorno são preservados enquanto a consulta falhar ou estiver pendente.
- A confirmação desconta do carrinho apenas os produtos e as quantidades daquele pedido, com marcador por conta/pedido para não repetir a remoção.
- O checkout informa falhas de frete sem ficar indefinidamente em cálculo. Orientações de configuração são mostradas apenas ao administrador.
- As funções de frete reconhecem `GOOGLE_MAPS_API_KEY` e o nome alternativo com espaços. Um valor com formato de SHA-256 é tratado como configuração inválida, sem expor a credencial.
- A atualização do banco adicionou 18 índices de apoio e otimizou 13 políticas com `(select auth.uid())`. Foram preservadas as regras, papéis e proteção RLS. Script aplicado: `database/review_performance.sql`; migração remota: `review_supporting_indexes_and_auth_initplans`.

## Configuração

A infraestrutura do Mundo Pet usa a conta wap33003@gmail.com. O administrador único confirmado no banco é wap33000@gmail.com.

O frontend usa somente a URL e chave pública de `src/config.json`, para o projeto Supabase `sppecskjgggfahokgccc`. Não coloque chaves secretas no frontend, no Git ou em mensagens de erro.

As funções em `supabase/functions/` executam o frete, a criação segura de pedidos, o link InfinitePay e a confirmação por webhook. A chave Google deve ser salva no ambiente das Edge Functions. Copie a chave original em Google Cloud → Credenciais → Mostrar chave. O campo Digest do Supabase não é o valor original e não deve ser cadastrado como chave. Também é necessário habilitar Routes API, faturamento e restrições compatíveis com chamadas do servidor.

O recebedor configurado é `wgsolucoesfinaceira`. `INFINITEPAY_API_KEY` é usada apenas no servidor quando disponível. Não mude o contrato de opções ou webhook sem validar a versão da integração na conta.

## Desenvolvimento e verificação

Execute `npm ci`, `npm test` e `npm run build`. O build preserva as páginas HTML em `public/` e gera `assets/runtime.js` para a aplicação.

Os testes cobrem valores em centavos, carrinho, CPF, URLs de pagamento, disponibilidade de ações de pedidos, limpeza de carrinho, CORS e erros/configuração de frete sem registro de credenciais. Não substituem compra real ou validação do painel autenticado.

## Estado operacional e limites

As correções de navegação, demonstração, instrução do código de entrega e CORS foram publicadas na revisão anterior. Os pagamentos reais ainda exigem validação ponta a ponta; o último diagnóstico identificou um segredo com 64 caracteres hexadecimais, compatível com um digest SHA-256, e consultas de rota com erro.

Agendamento comercial, comissão conciliada, repasses automáticos e saque Pix continuam pendentes de integração. As telas de carteira não executam pagamentos. As duas lojas com mesmo nome exigem conferência manual; não há exclusão automática de cadastros.

Os arquivos iniciais `database/schema.sql`, `photos.sql` e `coupon.sql` são históricos e não representam todo o banco atual. Não os reaplique em um projeto instalado. O banco atual mantém 17 tabelas públicas com RLS. Os avisos de funções privilegiadas, proteção contra senhas vazadas e políticas sobrepostas precisam continuar sendo acompanhados.

Nenhuma atualização deve excluir usuários, alterar preços ou modificar a Adega Maromba. Publicações devem permanecer dentro da autorização do usuário.
