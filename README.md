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

```bash
npm test
```

Os testes usam somente pessoas, IDs e designações fictícios. As consultas e gravações
do aplicativo são simuladas nos testes; o comando não acessa nem altera o banco real.
