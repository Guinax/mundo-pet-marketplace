# Auditoria do export Google Stitch — 24/10/2026

## Inventário conferido
Arquivo original: `stitch_mundo_pet_marketplace (1).zip`. Conteúdo verificado sem erros de leitura:
- `mundo_pet_tela_principal/code.html` + `screen.png`
- `mundo_pet_agendamento_de_servi_os/code.html` + `screen.png`
- `mundo_pet_cadastro_de_tutor_pets/code.html` + `screen.png`
- `mundo_pet_carrinho_checkout_rastreio/code.html` + `screen.png`
- `mundo_pet_painel_do_pet_shop_lojista/code.html` + `screen.png`
- `mundo_pet_painel_do_veterin_rio_agenda/code.html` + `screen.png`
- `mundo_pet_painel_do_entregador_corridas/code.html` + `screen.png`
- `mundo_pet_painel_administrativo_geral/code.html` + `screen.png`
- `pet_care_marketplace/DESIGN.md`

## Limitações conhecidas
As oito telas são desenhos de interface, sem backend conectado. Formulários, pagamentos, estoque, entregas e agendamento real NÃO estão integrados. O cadastro do exportado não conclui operação de servidor.

## GitHub — estado da importação
O repositório já possui `index.html` do projeto Vite (React 19) e `package.json`. **Não sobrescrever esses arquivos com a navegação HTML do protótipo.** A navegação foi adicionada separadamente em `stitch-preview/index.html`. Os respectivos HTMLs e PNGs ainda precisam ser versionados em `stitch-original/` para que seus links funcionem; portanto, a visualização no GitHub ainda está incompleta.

## Próximas verificações
1. Importar os 8 HTMLs, 8 screenshots e DESIGN.md do ZIP original, mantendo paths corretos.
2. Confirmar os links das oito telas e a responsividade em celular.
3. Inspecionar scripts/recursos externos, acessibilidade, segurança e viabilidade de migrar o layout para componentes React.
4. Testar build Vite (atualmente, no repositório observado, a entrada `src/main.jsx` ainda não foi localizada).
5. Somente então planejar as tabelas, autenticação e políticas do Supabase, **sem mexer na Adega Maromba** e sem publicar site em produção sem aprovação.

## Atualização — 24/10/2026
- Arquivo `src/main.jsx` criado para corrigir a entrada que faltava no `index.html` do Vite; fornece painel inicial com as oito áreas previstas. Ainda não foi executado build validado no ambiente GitHub.
- **Importação original ainda pendente**: `stitch-original/` ainda não contém os oito HTMLs e PNGs do ZIP. Os arquivos originais permanecem no pacote ZIP entregue na conversa. O preview em `stitch-preview/` depende dessa importação e não deve ser considerado funcional.
- Nenhuma integração Supabase, deploy ou alteração da Adega Maromba foi feita nesta etapa.
