# Programação e histórico de campo

Em **Designações → Serviço de Campo**:

- **Agenda → Registrar resultado:** escolha a data e o resultado de cada território. “Marcar todos como concluídos” preenche a seleção; salvar registra uma conclusão para cada território. É necessário definir o dirigente da saída primeiro.
- **Histórico ao designar:** clicar em “Designar” no território ou selecionar um território no formulário abre uma telinha com até três datas de conclusão, da mais recente para a mais antiga, e os responsáveis. Isso também acontece ao adicionar territórios à saída na Agenda. “OK, continuar” fecha apenas a consulta, mantendo o formulário preenchido. Os botões de histórico permitem consultar novamente antes de salvar. Entregas pendentes não contam como trabalho concluído.
- **Parcial:** informe o que falta trabalhar. A entrega permanece pendente e pode ser concluída posteriormente pelo Histórico.
- **Não trabalhado:** registra o resultado sem gerar uma conclusão. Uma entrega que já existia permanece pendente.
- Resultados salvos são preservados. A saída passa a manter a data, o dirigente e os territórios; excluir a saída preserva o histórico.
- **Histórico:** consulte as entregas e conclusões dos territórios. A carga dos registros antigos é feita pelo SQL conferido, sem importação de PDF na tela.
- **Histórico → Exportar histórico (PDF):** escolha o ano de serviço e clique em “Baixar PDF”. A tabela em A4 paisagem contém território, FDS, última conclusão, responsáveis e datas de entrega/conclusão. Territórios ativos sem registros ficam com células vazias; designações pendentes são identificadas. Há cinco blocos por linha e continuação automática para históricos maiores. O período é setembro a agosto e independe dos filtros de calendário da lista. A exportação usa a permissão existente de gerar PDFs de designações, sem exigir permissão de edição de campo.
- **Histórico → Exportar dirigentes do mês:** escolha mês e ano e clique em “Baixar PDF”. A tabela mensal contém data, dia da semana, horário, dirigente, local, grupos e territórios ou modalidade. O PDF usa cabeçalho roxo, linhas alternadas e paginação. O mês e ano selecionados no Histórico são sugeridos; quando estiverem em “Todos”, é sugerido o período atual. A tabela vem das saídas da Agenda e inclui dirigentes a definir. Usa a mesma permissão de gerar PDFs de designações.
- **Territórios → Editar → Quando usar este território:** escolha durante a semana, fim de semana ou ambos. A antiga preferência por fim de semana é migrada para uso no fim de semana.
- **Agenda → Gerar programação:** configure período, dias, horários, locais, grupos e quantidade de territórios. Confira a prévia, selecione dirigentes ou mantenha “A definir” e salve o lote. As regras dos territórios também podem ser ajustadas nessa tela.

## Sugestões automáticas

O gerador prioriza territórios nunca concluídos ou com conclusões mais antigas. Exclui territórios inativos ou com entrega pendente e considera saídas já planejadas no intervalo mínimo entre usos. O intervalo padrão é de 14 dias. Faltas de territórios são sinalizadas; remova as saídas vazias ou ajuste as regras antes de salvar.

As referências, disponibilidade e conflitos são verificados novamente ao salvar. Qualquer falha reverte o lote inteiro, incluindo suas alterações de regras. As operações usam a permissão existente de edição de Serviço de Campo e são auditadas.

## Carga inicial do histórico

O arquivo `scripts/sql/carga-historico-territorios-2027.sql` contém os 51 registros extraídos e conferidos nas duas páginas do controle do ano de serviço 2027. Ele não faz parte da migração automática: execute-o separadamente depois de revisar os dados.

O ano de serviço 2027 vai de setembro de 2026 a agosto de 2027. As datas de setembro e outubro do PDF foram interpretadas como 2026. Os nomes são mantidos conforme a fonte, sem vincular abreviações ou “Visita” a publicadores por suposição. No SQL, os vínculos podem ser preenchidos explicitamente na coluna `publicador_id` antes da execução.

São considerados os 31 territórios. Os nove marcados como FDS recebem a regra de fim de semana: 17, 20, 21, 22, 23, 28, 29, 30 e 31. As regras dos demais territórios são preservadas. Os territórios 21, 23 e 30 não recebem histórico, pois estão sem registros no PDF. A coluna “Última data concluída” é conferida contra os registros e não gera uma designação adicional.

O SQL exige que todos os territórios já estejam cadastrados, ignora registros já existentes com o mesmo território e datas e registra auditoria. Registros sobrepostos são listados como conflitos e ficam fora da carga, preservando o histórico existente. A execução é transacional. Não são criadas saídas antigas na Agenda: os registros alimentam o Histórico e a prioridade do gerador de programação.

Na conferência inicial com o banco configurado, quatro linhas do PDF apresentaram divergências nos territórios 6, 8, 11 e 12. Os registros existentes terminam em 04/11/2026, enquanto o PDF traz registros de “Visita” em 29 ou 30/10/2026. A carga não escolhe qual fonte está correta: importa os 47 registros sem conflito e lista essas quatro linhas para decisão separada. O resultado depende do estado do banco no momento da execução.

## Banco e verificação

Em cada ambiente que receber a atualização, execute:

```sh
npm run migrate:field-service
```

A migração `scripts/sql/adicionar-planejamento-campo.sql` é repetível e preserva os registros existentes. Resultados das saídas também são incluídos no backup.

```sh
npm test
npm run verify:field-service
npm run build
```

A verificação de integração usa o banco configurado e reverte seus registros ao terminar.
