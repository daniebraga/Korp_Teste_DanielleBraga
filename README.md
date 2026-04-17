# Korp — Sistema de emissão de Notas Fiscais (demo técnico)

Monorepo com **dois microsserviços** em **ASP.NET Core 9** (C#) persistindo em **SQLite** (arquivos `stock.db` e `billing.db` gerados na pasta de cada serviço) e um **frontend Angular 19** com **Angular Material**.

## Pré-requisitos

- [.NET SDK 9](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) (testado com npm 10)

## Como executar

Abra **três** terminais na raiz do repositório.

### 1) Estoque (porta 5053)

```powershell
cd services/StockService
dotnet run --launch-profile http
```

### 2) Faturamento (porta 5251)

```powershell
cd services/BillingService
dotnet run --launch-profile http
```

A URL do estoque está em `services/BillingService/appsettings.json` (`StockService:BaseUrl`).

### 3) Frontend Angular (porta 4200)

```powershell
cd frontend
npm start
```

Acesse `http://localhost:4200`.

### Swagger (OpenAPI)

Com os serviços em execução:

- **Estoque:** [http://localhost:5053/swagger](http://localhost:5053/swagger)
- **Faturamento:** [http://localhost:5251/swagger](http://localhost:5251/swagger)

## Fluxo funcional

1. Cadastre produtos (código, descrição, saldo) na tela **Produtos**.
2. Em **Notas fiscais**, monte linhas (produto + quantidade) e crie a nota — ela nasce **Aberta**, com numeração sequencial automática.
3. Abra **Detalhes**, use **Imprimir NF**: aparece o indicador de processamento; ao concluir, a nota vai para **Fechada** e o estoque é baixado no microsserviço de estoque.
4. **Falha de microsserviço**: encerre o processo do **StockService** e tente imprimir — o faturamento devolve erro amigável; ao subir o estoque novamente, a operação pode ser retentada (baixa idempotente por `invoiceId` no estoque).

## Entrega (e-mail / vídeo)

Use o arquivo `ENTREGA_DETALHAMENTO_TECNICO.md` como base do detalhamento técnico solicitado e publique o repositório com o nome exigido pela banca (`Korp_Teste_SeuNome`).
