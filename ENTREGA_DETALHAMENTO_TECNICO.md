# Detalhamento técnico — Sistema de emissão de Notas Fiscais (demo)

## Visão geral da arquitetura

- **Microsserviço de Estoque (`StockService`)**: cadastro de produtos, saldo e operação transacional de baixa (`POST /api/inventory/commit`) com **idempotência por nota** (`ProcessedInvoiceCommit` indexado por `InvoiceId`).
- **Microsserviço de Faturamento (`BillingService`)**: cadastro de notas com numeração sequencial, status **Aberta/Fechada** e orquestração da impressão chamando o estoque via **HTTP (`HttpClient`)**.
- **Frontend (`frontend`)**: Angular standalone, rotas lazy-loaded, comunicação REST direta com as duas APIs (URLs em `src/app/core/environment.ts`).

## Ciclos de vida do Angular utilizados

- **`ngOnInit`**: carregamento inicial de listas (`produtos`, `notas`) e composição de fluxos com `ActivatedRoute` + `switchMap` no detalhe da nota.
- **`ngOnDestroy`**: encerramento com `Subject` + `takeUntil` para cancelar assinaturas ao sair da tela de produtos (fluxo do assistente) e do detalhe da nota.

## Uso da biblioteca RxJS

- **`switchMap`**: recarregar a nota sempre que o parâmetro `:id` da rota mudar; encadear chamada ao assistente após debounce do código do produto.
- **`takeUntil` / `Subject`**: teardown explícito no `ngOnDestroy`.
- **`finalize`**: desligar o estado de “imprimindo” após sucesso ou erro da chamada `printInvoice`.
- **`debounceTime` / `distinctUntilChanged` / `filter`**: reduzir chamadas ao endpoint de assistência enquanto o usuário digita o código.
- **`forkJoin`**: carregar em paralelo `GET /api/invoices` e `GET /api/products` na tela de criação de notas.
- **`catchError` + `throwError`**: normalizar mensagens de erro HTTP nos serviços (`StockApiService`, `BillingApiService`).

## Outras bibliotecas e finalidades

| Camada        | Biblioteca / recurso                         | Finalidade |
|---------------|----------------------------------------------|------------|
| Backend       | **Entity Framework Core 9 + SQLite**         | ORM, persistência física, transações e concorrência otimista (`RowVersion` em `Product`). |
| Backend       | **`IHttpClientFactory` (`AddHttpClient`)**   | Cliente resiliente para chamar o microsserviço de estoque. |
| Frontend      | **Angular Material**                         | Toolbar, tabelas, formulários, botões, snackbar, spinner. |
| Frontend      | **RxJS** (acima)                             | Composição de fluxos assíncronos e UX de carregamento/erro. |

## Componentes visuais (UI)

- **Angular Material** (`MatToolbar`, `MatTable`, `MatFormField`, `MatInput`, `MatSelect`, `MatButton`, `MatCard`, `MatSnackBar`, `MatProgressSpinner`, `MatIcon`).

## Gerenciamento de dependências em Go

- **Não aplicável**: o backend foi implementado em **C# / .NET 9** (o ambiente local não possuía Go instalado). O gerenciamento de dependências do backend é feito com **`dotnet` + NuGet** (`*.csproj` / `dotnet restore`).

## Frameworks no backend (C#)

- **ASP.NET Core 9** (Minimal APIs), **Entity Framework Core 9** (provedor SQLite).

## Tratamento de erros e exceções no backend

- **Validações de domínio**: respostas `400 Bad Request` com corpo `{ "message": "..." }` (ex.: saldo insuficiente, nota já fechada).
- **Conflitos de concorrência no estoque**: `DbUpdateConcurrencyException` mapeada para `409 Conflict` com orientação de nova tentativa.
- **Falha de comunicação entre microsserviços**: `HttpRequestException` / timeout no `StockHttpClient` convertidos em `StockCommitResult` com **HTTP 503** e mensagem orientando o usuário a subir o estoque e tentar de novo.
- **Persistência após sucesso do estoque**: `try/catch` ao salvar a nota como **Fechada**; mensagem informa retentativa segura graças à **idempotência** no estoque.

## Uso de LINQ (C#)

- Consultas com **`Where`**, **`OrderBy` / `OrderByDescending`**, **`Select`**, **`Any`**, **`Max`**, **`GroupBy`**, **`Sum`**, **`ToList` / `ToDictionary`** sobre `DbSet`/`IQueryable` e coleções em memória (ex.: agregação de quantidades por produto antes da baixa no estoque).

## Requisitos opcionais atendidos

- **Concorrência**: token de concorrência (`RowVersion`) em `Product` + tratamento de `DbUpdateConcurrencyException` na baixa.
- **Idempotência**: tabela `ProcessedInvoiceCommit` garante que a mesma `InvoiceId` não debita o estoque duas vezes; reimpressão após falha parcial é segura.
- **“IA” (demonstração)**: endpoint `GET /api/assistant/product-hint` no faturamento com sugestões baseadas em regras simples; no Angular, fluxo RxJS (`debounce` + `switchMap`) dispara o assistente a partir do código digitado.

## Gravação do vídeo sugerida

1. Mostrar cadastro de produto e listagem com saldo.  
2. Criar nota com múltiplos itens e mostrar numeração/status **Aberta**.  
3. Detalhe da nota → **Imprimir NF** com overlay de processamento → nota **Fechada** e saldo alterado.  
4. Parar o `StockService`, tentar imprimir outra nota **Aberta** → mensagem de indisponibilidade; subir o serviço e repetir com sucesso.
