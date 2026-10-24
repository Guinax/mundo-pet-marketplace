# Mundo Pet — implementação funcional

As referências visuais aprovadas do Stitch continuam orientando paleta, fontes, cartões e estrutura móvel das oito áreas. Conteúdo fictício de usuários, avaliações, faturamento e saldos foi substituído pelos dados da conta ou por estados vazios. Os fluxos que ainda não têm provedor comercial são identificados como demonstração.

Os dados de tutor/pets e credenciamento ficam no Supabase com autenticação e RLS. Preços, estoque, transições de pedido, código de entrega e disponibilidade de agenda são verificados no servidor.

Verificações: build de produção, testes de cálculos e validação de dados, testes transacionais de preço/idempotência/RLS/agenda/entrega e interação no navegador com busca, carrinho, quantidade e barreiras de autenticação.

Login com credenciais reais e testes completos dos painéis autenticados dependem da sessão do usuário; não foram simulados como uma sessão de produção. Pagamentos e contratações reais continuam bloqueados até sua configuração.
