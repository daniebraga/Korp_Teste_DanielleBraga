using System.Net;
using BillingService.Contracts;
using Microsoft.OpenApi;
using BillingService.Data;
using BillingService.Integration;
using BillingService.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BillingDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Billing")));

builder.Services.AddHttpClient<IStockClient, StockHttpClient>((sp, client) =>
{
    var baseUrl = sp.GetRequiredService<IConfiguration>()["StockService:BaseUrl"]
        ?? "http://localhost:5053";
    client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Billing Service — Faturamento",
        Version = "v1",
        Description = "Notas fiscais, impressão e integração com o microsserviço de estoque."
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<BillingDbContext>().Database.EnsureCreatedAsync();
}

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Faturamento v1");
    options.DocumentTitle = "Billing Service — Swagger";
});

app.MapGet("/api/invoices", async (BillingDbContext db, CancellationToken ct) =>
{
    var list = await db.Invoices
        .AsNoTracking()
        .Include(i => i.Lines)
        .OrderByDescending(i => i.SequentialNumber)
        .ToListAsync(ct);

    return Results.Ok(list.Select(InvoiceMapper.ToResponse).ToList());
});

app.MapGet("/api/invoices/{id:guid}", async (Guid id, BillingDbContext db, CancellationToken ct) =>
{
    var invoice = await db.Invoices.AsNoTracking().Include(i => i.Lines).FirstOrDefaultAsync(i => i.Id == id, ct);
    return invoice is null ? Results.NotFound() : Results.Ok(InvoiceMapper.ToResponse(invoice));
});

app.MapPost("/api/invoices", async (CreateInvoiceRequest body, BillingDbContext db, CancellationToken ct) =>
{
    if (body.Lines.Count == 0)
    {
        return Results.BadRequest(new { message = "Inclua ao menos um produto na nota." });
    }

    if (body.Lines.Any(l => l.Quantity <= 0))
    {
        return Results.BadRequest(new { message = "Quantidades devem ser maiores que zero." });
    }

    if (body.Lines.Any(l => string.IsNullOrWhiteSpace(l.ProductCode) || string.IsNullOrWhiteSpace(l.ProductDescription)))
    {
        return Results.BadRequest(new { message = "Código e descrição do produto são obrigatórios em cada linha." });
    }

    await using var tx = await db.Database.BeginTransactionAsync(ct);
    try
    {
        var nextNumber = await db.Invoices.AnyAsync(ct)
            ? await db.Invoices.MaxAsync(i => i.SequentialNumber, ct) + 1
            : 1;

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            SequentialNumber = nextNumber,
            Status = InvoiceStatus.Aberta
        };

        foreach (var line in body.Lines)
        {
            invoice.Lines.Add(new InvoiceLine
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                ProductId = line.ProductId,
                ProductCode = line.ProductCode.Trim(),
                ProductDescription = line.ProductDescription.Trim(),
                Quantity = line.Quantity
            });
        }

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return Results.Created($"/api/invoices/{invoice.Id}", InvoiceMapper.ToResponse(invoice));
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync(ct);
        return Results.Problem(detail: ex.Message, statusCode: (int)HttpStatusCode.InternalServerError);
    }
});

app.MapPut("/api/invoices/{id:guid}", async (
    Guid id,
    UpdateInvoiceRequest body,
    BillingDbContext db,
    CancellationToken ct) =>
{
    if (body.Lines.Count == 0)
    {
        return Results.BadRequest(new { message = "Inclua ao menos uma linha na nota." });
    }

    if (body.Lines.Any(l => l.Quantity <= 0))
    {
        return Results.BadRequest(new { message = "Quantidades devem ser maiores que zero." });
    }

    var invoice = await db.Invoices.Include(i => i.Lines).FirstOrDefaultAsync(i => i.Id == id, ct);
    if (invoice is null)
    {
        return Results.NotFound(new { message = "Nota não encontrada." });
    }

    if (invoice.Status != InvoiceStatus.Aberta)
    {
        return Results.BadRequest(new { message = "Somente notas com status Aberta podem ser alteradas." });
    }

    var requestedIds = body.Lines.Select(l => l.Id).ToHashSet();
    if (requestedIds.Count != body.Lines.Count)
    {
        return Results.BadRequest(new { message = "Cada linha deve ser única." });
    }

    var existingLines = invoice.Lines.ToDictionary(l => l.Id);
    foreach (var line in body.Lines)
    {
        if (!existingLines.TryGetValue(line.Id, out var existingLine))
        {
            return Results.BadRequest(new { message = $"Linha de nota {line.Id} não encontrada." });
        }

        existingLine.Quantity = line.Quantity;
    }

    var linesToRemove = invoice.Lines.Where(l => !requestedIds.Contains(l.Id)).ToList();
    foreach (var line in linesToRemove)
    {
        invoice.Lines.Remove(line);
    }

    try
    {
        await db.SaveChangesAsync(ct);
        return Results.Ok(InvoiceMapper.ToResponse(invoice));
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: (int)HttpStatusCode.InternalServerError);
    }
});

app.MapDelete("/api/invoices/{id:guid}", async (Guid id, BillingDbContext db, CancellationToken ct) =>
{
    var invoice = await db.Invoices.Include(i => i.Lines).FirstOrDefaultAsync(i => i.Id == id, ct);
    if (invoice is null)
    {
        return Results.NotFound(new { message = "Nota não encontrada." });
    }

    if (invoice.Status != InvoiceStatus.Aberta)
    {
        return Results.BadRequest(new { message = "Somente notas com status Aberta podem ser excluídas." });
    }

    db.Invoices.Remove(invoice);
    await db.SaveChangesAsync(ct);

    return Results.NoContent();
});

app.MapPost("/api/invoices/{id:guid}/print", async (
    Guid id,
    BillingDbContext db,
    IStockClient stock,
    CancellationToken ct) =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    var invoice = await db.Invoices.Include(i => i.Lines).FirstOrDefaultAsync(i => i.Id == id, ct);
    if (invoice is null)
    {
        return Results.NotFound(new { message = "Nota não encontrada." });
    }

    if (invoice.Status != InvoiceStatus.Aberta)
    {
        return Results.BadRequest(new { message = "Somente notas com status Aberta podem ser impressas." });
    }

    var stockRequest = new StockInventoryCommitRequest(
        invoice.Id,
        invoice.Lines
            .Select(l => new StockInventoryLine(l.ProductId, l.Quantity))
            .ToList());

    var stockResult = await stock.CommitInventoryAsync(stockRequest, ct);
    if (!stockResult.Success)
    {
        var status = stockResult.StatusCode is >= 400 and <= 599
            ? stockResult.StatusCode
            : StatusCodes.Status502BadGateway;

        return Results.Json(
            new { message = stockResult.ErrorMessage ?? "Falha ao processar impressão no estoque." },
            statusCode: status);
    }

    try
    {
        invoice.Status = InvoiceStatus.Fechada;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(InvoiceMapper.ToResponse(invoice));
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync(ct);
        return Results.Problem(
            title: "Persistência da nota falhou após estoque processar a operação.",
            detail: $"{ex.Message} Tente imprimir novamente: o estoque é idempotente por nota.",
            statusCode: (int)HttpStatusCode.InternalServerError);
    }
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "billing" }));

app.MapGet("/api/assistant/product-hint", (string? code) =>
{
    var normalized = code?.Trim().ToUpperInvariant() ?? string.Empty;
    var suggestion = normalized.Contains("SERV")
        ? "Indício de serviço: verifique tributação e natureza da operação na NF."
        : normalized.Length is > 0 and < 3
            ? "Códigos muito curtos aumentam risco de colisão; prefira um padrão interno claro."
            : "Sugestão automática (regras): revise descrição e NCM/CFOP conforme seu processo fiscal.";

    return Results.Ok(new { suggestion });
});

app.Run();
