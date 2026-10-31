# Medicao de comportamento — GA4

Propriedade: Ferramentas — Esporte com Valor. ID: G-3X2SF5L8FV.
O script ecv-analytics.js atende a pagina principal e aos documentos de Projetor, Raio-X e Termometro. Os iframes usam a tag da pagina principal, sem page_view adicional. As paginas abertas diretamente carregam sua propria tag.

| Evento | Definicao |
|---|---|
| ecv_view_tool | Secao visivel por 2 segundos continuos; >=200 px ou metade da altura, uma vez por carregamento |
| ecv_use_tool | Primeira interacao com controles por ferramenta/carregamento; evento principal |
| ecv_select_team | Selecao explicita de clube, incluindo rankings e paineis incorporados |
| ecv_simulate | Valores numericos validos apos 1 segundo sem digitacao; cenarios identicos consecutivos nao repetem |
| ecv_filter_change | Mando, recorte 5/10, ordenacao, marco temporal ou modo manual |
| ecv_navigate_tool | Clique no menu de ferramentas |
| ecv_click_blog | Clique de saida para o blog |
| ecv_action | Restaurar, limpar, preencher manualmente ou comparar times |
| ecv_refresh_data | Solicitacao manual de nova consulta, nao confirma sucesso da coleta |
| ecv_expand_help | Abrir explicacao dos calculos |

Dimensoes de evento: ECV Campeonato (ecv_league), ECV Ferramenta (ecv_tool), ECV Time (ecv_team), ECV Projeto (ecv_project), ECV Controle (ecv_control), ECV Opcao (ecv_option).
As quatro medidas numericas de simulacao (ecv_target_points, ecv_current_points, ecv_played, ecv_remaining) ficam no evento para depuracao; nao sao dimensoes de alta cardinalidade.

## Consultar

Em Explorar > Formato livre, importe essas dimensoes e Usuarios ativos, Contagem de eventos e Sessoes. Filtre Nome do evento por ecv_use_tool para comparar uso real por ferramenta/campeonato; ecv_view_tool para exposicao; ecv_select_team para clubes; ecv_filter_change para filtros. Origem/midia da sessao e Categoria do dispositivo permitem comparar aquisicao e celular/computador. Visualizacao nao significa leitura integral. ecv_use_tool contabiliza controles, e nao leitura de rankings estaticos.

Os eventos comecam na publicacao e nao reconstroem o historico. Novas dimensoes podem levar 24–48 horas para aparecer em relatorios processados. Contagem de eventos difere de usuarios unicos; comparar usuarios por ferramenta evita confundir repeticoes com alcance.

## Validar e manter

Execute node tests/test_analytics.cjs. Para DebugView, abra a pagina principal com ?ecv_debug=1 e realize interacoes. Esse parametro ativa debug_mode somente nessa visita. Nao ha envio de texto livre, credenciais ou identificadores pessoais personalizados. A tag continua respeitando o comportamento de consentimento existente; nao forca armazenamento nem contorna bloqueadores. Nao remova o script das quatro paginas ao atualizar os projetos.
