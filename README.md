This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Privilégios mecânicos

Escolha uma semana na aba Privilégios Mecânicos para abrir o modal das reuniões.
O botão **Inserir automático** preenche os campos vazios, priorizando publicadores
sem designação há mais tempo e evitando repetir pessoas na semana. As sugestões
podem ser ajustadas antes de clicar em **Salvar semana**. O ancião de apoio é
escolhido entre os anciãos; os demais privilégios usam publicadores do sexo masculino
batizados. O leitor de A Sentinela aparece apenas na reunião de fim de semana.

O histórico e o resumo de próximas designações incluem Vida e Ministério,
privilégios mecânicos, discursos públicos e limpeza semanal. A limpeza por grupo
aparece para os integrantes do grupo; responsáveis informados por nome e oradores
são associados quando o nome corresponde ao cadastro.

## Alertas e lembretes automáticos

O sininho mostra apenas alertas da pessoa conectada: próximas designações de todas
as categorias, limpeza do grupo/responsável e relatório do mês anterior pendente.
O prazo do relatório usa o mês civil; a consulta respeita o ano de serviço.
É possível marcar alertas como lidos. Alterações e exclusões nas designações são
refletidas automaticamente, e reuniões canceladas não geram lembretes.

Em **Configurações → Alertas e lembretes**, defina os tipos e a antecedência.
As regras são da congregação e a edição exige `configuracoes_editar`.
Ativar os e-mails também exige `designacoes_email`. O envio começa desativado.

Para ativar os e-mails, configure no servidor/hospedagem:

- `EMAIL_USER`: conta Gmail remetente.
- `EMAIL_PASS`: senha de aplicativo dessa conta (a mesma usada no envio manual).
- `CRON_SECRET`: segredo aleatório forte para autenticar o agendador.

Depois, publique e habilite os lembretes em Configurações. O `vercel.json` chama
`GET /api/cron/lembretes` diariamente às 13h UTC (10h em Brasília). A Vercel envia
`Authorization: Bearer <CRON_SECRET>` automaticamente; veja a
[documentação do agendador](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
Em outra hospedagem, programe a mesma chamada diária com esse cabeçalho.
No ambiente local, o `next dev` não executa o agendamento sozinho.

Cada e-mail reúne as designações da pessoa para uma data. A rotina registra
sucesso/falha por destinatário e por antecedência, evita repetir envios confirmados
e tenta novamente falhas nas próximas execuções até a data da designação.
Limpeza pode ser incluída separadamente. Não há envio de relatório atrasado por
e-mail nesta versão. A configuração mostra os totais de envios e falhas pendentes.
As tabelas `alertas_*` são criadas automaticamente no primeiro uso; não é
necessário executar um SQL manual. Os testes simulam também o servidor de e-mail.

O recebimento por e-mail é ativado por padrão para cada pessoa, inclusive novos
cadastros. Quem não quiser receber pode desmarcar **Receber lembretes das minhas
designações por e-mail** em Configurações → Alertas → Meus lembretes por e-mail.
O menu do usuário também oferece **Minhas configurações**, disponível mesmo sem
permissão para acessar as configurações gerais. Essa preferência altera somente
o próprio recebimento; o sininho permanece funcionando.
O envio depende também da opção geral **Ativar envio automático para a congregação**.
O cron respeita as preferências pessoais tanto nos novos envios quanto nas tentativas
de reenvio, e quem nunca salvou uma preferência continua habilitado.

## Calendário compartilhado de reuniões e designações

Execute uma vez no banco de cada ambiente antes de usar esta versão:

```bash
npm run migrate:calendar
```

A migração acrescenta vínculos por `reuniao_id` e associa os registros existentes
quando a data e o tipo correspondem. Ela pode ser repetida. Registros sem reunião
correspondente ou com duplicidades permanecem preservados para revisão.

Em **Reuniões → Gerar reuniões do mês**, escolha o mês e confira a prévia.
As datas aparecem automaticamente nas quatro abas de Designações: meio de semana
em Vida e Ministério, fim de semana em Discursos Públicos, e todas as reuniões
em Privilégios Mecânicos e Limpeza. A criação prepara a agenda; os responsáveis
continuam sendo escolhidos em cada aba. A limpeza tem uma designação por reunião,
permitindo repetir o grupo nas duas reuniões da semana.

Em Vida e Ministério, as reuniões sem conteúdo aparecem como **Programação
pendente**. Selecione o ano da apostila antes de importar o RTF. A semana do arquivo
é vinculada à data real da reunião, incluindo visitas na terça-feira. Sem reunião
ativa ou com mais de uma reunião na semana, a importação solicita revisão do calendário.

O mês e o ano selecionados são mantidos ao trocar as abas. Limpeza também permite
consultar um intervalo de datas. Reuniões já existentes não são duplicadas pela
geração; “Próximo Mês” agora cobre o próximo mês civil inteiro. Períodos que cruzam
o ano exigem os dias de reunião configurados também para o ano seguinte.

Alterar a data de uma reunião atualiza a programação, as designações e a limpeza
vinculadas, incluindo as datas usadas pelos relatórios e lembretes. **Cancelar
reuniões** preserva o histórico e interrompe os lembretes. O botão **Restaurar**
reativa uma reunião cancelada manualmente; eventos especiais continuam sendo respeitados.

Além dos testes simulados, há uma verificação opcional do SQL:

```bash
npm run verify:calendar
```

Esse comando requer conexão ao PostgreSQL configurado em `.env.local`, usa uma
conexão direta e cria somente tabelas temporárias com dados fictícios. Verifica
migração repetida, geração, agendas pendentes, importação, preenchimento, mudança
de data, cancelamento e restauração sem modificar os registros persistentes.

## Executar os testes

### Serviço de Campo

Em **Designações → Serviço de Campo**, cadastre locais e registre os territórios.
Na saída, escolha qualquer publicador pelo nome no campo **Dirigente**, sem cadastro
adicional, ou mantenha **A definir**. Selecionar o local preenche os grupos habituais,
que podem ser ajustados. A agenda aceita várias saídas no mesmo dia,
grupos distintos, horário definido ou pós reunião, cartas e revisitas/estudos.
Novas saídas podem se repetir semanalmente por até 12 semanas. Cada ocorrência
é independente para edição e exclusão; conflitos de dirigente ou grupos no mesmo
horário impedem a gravação de todo o lote. Sem grupos selecionados, a saída é da
congregação. Os dirigentes e suas saídas permanecem registrados na agenda.

Territórios planejados na agenda não geram designação nem conclusão automática.
Em **Territórios**, anexe o mapa geral da congregação no topo da seção e o mapa
individual no cadastro ou no card **Mapas individuais**, organizado por território.
Cada território possui um PDF fixo, um link do Google Maps e referências de quadras
e ruas. Edite as referências ou substitua o PDF quando houver atualização; o mapa
continua vinculado ao mesmo território. Os arquivos devem ser PDFs
de até 10 MB. **Visualizar mapa** abre o PDF e **Baixar PDF** faz o download;
enviar outro arquivo substitui o anterior. Cadastro e PDF podem ser salvos juntos.
Os PDFs são armazenados no PostgreSQL, incluídos no backup e acessíveis somente
a usuários com acesso a Designações. Upload exige permissão de Serviço de Campo.
Use **Compartilhar** na agenda para revisar uma mensagem com data, horário, dirigente,
grupos, local da consideração e territórios, incluindo os links do Google Maps e
orientações. Nos mapas individuais, o botão compartilha somente o território.
Você pode editar/copiar a mensagem ou abrir o WhatsApp para escolher o destinatário
e enviar. O app não envia automaticamente. Os PDFs privados não são transformados
em links públicos; os links do Google Maps podem ser abertos sem acesso ao sistema.
Use **Designar** para registrar a entrega ao publicador e **Registrar conclusão**
para devolver o território. O histórico é consultado por ano de serviço (setembro
a agosto). Locais e territórios são desativados para preservar seus
vínculos históricos. As planilhas de referência não são importadas automaticamente.

Para instalar as tabelas em outro ambiente e verificar o banco:

```bash
npm run migrate:field-service
npm run verify:field-service
```

A migração é idempotente e converte as saídas com antigos dirigentes para o vínculo
direto ao publicador, preservando os registros anteriores. A verificação grava registros de teste dentro de uma
transação e reverte todos eles no final. Requer `.env.local` com PostgreSQL.
Edição exige a permissão **Gerenciar Serviço de Campo e Territórios** na gestão de
acessos; visualização usa a permissão de Designações, e PDF usa **Gerar PDF
(Designações)**. As alterações são auditadas na mesma transação e as novas tabelas
integram o backup. Esta versão não envia notificações ou e-mails de campo.

### Programação automática de Vida e Ministério

Nos geradores de reuniões (Designações, Reuniões e Configurações), a opção
**Buscar automaticamente a programação de Vida e Ministério no jw.org** vem
marcada. Após criar o calendário, o app consulta a página semanal em português
da Biblioteca On-line, valida as seções e salva as partes e cânticos sem participantes.
O resultado informa importações, registros preservados e pendências por data.
Programações e participantes já salvos são preservados. Não é necessária migração:
a origem e o horário da importação ficam em `dados_json.source`.

Em Vida e Ministério, abra uma reunião com **Programação pendente** e clique em
**Buscar programação no jw.org** para tentar novamente, inclusive em reuniões
criadas anteriormente. A importação RTF continua disponível. Uma falha de conexão,
apostila ainda não publicada ou estrutura não reconhecida deixa a reunião criada,
sem gravar uma programação incompleta. A busca usa duas requisições por semana,
com limite de tempo e domínio fixo; não executa scripts das páginas nem usa IA.
Cada programação salva é reutilizada ao abrir a reunião. Buscar pendências exige
`designacoes_importar`; o servidor também aceita `configuracoes_editar` para o
fluxo de geração. Não há sincronização periódica nem substituição automática.

```bash
npm test
```

Os testes usam somente pessoas, IDs e designações fictícios. As consultas e gravações
do aplicativo são simuladas nos testes; o comando não acessa nem altera o banco real.
