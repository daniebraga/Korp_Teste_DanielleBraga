using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using StockService.Contracts;
using StockService.Data;
using StockService.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<StockDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Stock")));

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
        Title = "Stock Service — Estoque",
        Version = "v1",
        Description = "Cadastro de produtos/saldos e commit de baixa para o faturamento."
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<StockDbContext>().Database.EnsureCreatedAsync();
}

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Estoque v1");
    options.DocumentTitle = "Stock Service — Swagger";
});

app.MapGet("/api/products", async (StockDbContext db, CancellationToken ct) =>
{
    var items = await db.Products
        .AsNoTracking()
        .OrderBy(p => p.Code)
        .Select(p => new ProductResponse(p.Id, p.Code, p.Description, p.Balance))
        .ToListAsync(ct);
    return Results.Ok(items);
});

app.MapGet("/api/products/{id:guid}", async (Guid id, StockDbContext db, CancellationToken ct) =>
{
    var p = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
    return p is null
        ? Results.NotFound()
        : Results.Ok(new ProductResponse(p.Id, p.Code, p.Description, p.Balance));
});

app.MapPost("/api/products", async (CreateProductRequest body, StockDbContext db, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.Description))
    {
        return Results.BadRequest(new { message = "Código e descrição são obrigatórios." });
    }

    if (body.Balance < 0)
    {
        return Results.BadRequest(new { message = "Saldo não pode ser negativo." });
    }

    var normalizedCode = body.Code.Trim();
    var exists = await db.Products.AnyAsync(p => p.Code == normalizedCode, ct);
    if (exists)
    {
        return Results.Conflict(new { message = "Já existe produto com este código." });
    }

    var entity = new Product
    {
        Id = Guid.NewGuid(),
        Code = normalizedCode,
        Description = body.Description.Trim(),
        Balance = body.Balance
    };

    db.Products.Add(entity);
    await db.SaveChangesAsync(ct);

    return Results.Created($"/api/products/{entity.Id}",
        new ProductResponse(entity.Id, entity.Code, entity.Description, entity.Balance));
});

app.MapPost("/api/inventory/commit", async (InventoryCommitRequest body, StockDbContext db, CancellationToken ct) =>
{
    if (body.Lines.Count == 0)
    {
        return Results.BadRequest(new { message = "A nota precisa ter ao menos um item." });
    }

    if (body.Lines.Any(l => l.Quantity <= 0))
    {
        return Results.BadRequest(new { message = "Quantidades devem ser maiores que zero." });
    }

    var already = await db.ProcessedInvoiceCommits.AsNoTracking()
        .AnyAsync(x => x.InvoiceId == body.InvoiceId, ct);
    if (already)
    {
        return Results.Ok(new { message = "Operação já processada (idempotente).", invoiceId = body.InvoiceId });
    }

    await using var tx = await db.Database.BeginTransactionAsync(ct);

    try
    {
        var requiredByProduct = body.Lines
            .GroupBy(l => l.ProductId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

        var productIds = requiredByProduct.Keys.ToList();
        var products = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var (productId, qty) in requiredByProduct)
        {
            if (!products.TryGetValue(productId, out var product))
            {
                await tx.RollbackAsync(ct);
                return Results.BadRequest(new { message = $"Produto {productId} não encontrado no estoque." });
            }

            if (product.Balance < qty)
            {
                await tx.RollbackAsync(ct);
                return Results.BadRequest(new
                {
                    message = $"Saldo insuficiente para o produto {product.Code}. Disponível: {product.Balance}, solicitado: {qty}."
                });
            }
        }

        foreach (var line in body.Lines)
        {
            products[line.ProductId].Balance -= line.Quantity;
        }

        db.ProcessedInvoiceCommits.Add(new ProcessedInvoiceCommit
        {
            Id = Guid.NewGuid(),
            InvoiceId = body.InvoiceId,
            ProcessedAt = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(new { message = "Estoque atualizado." });
    }
    catch (DbUpdateConcurrencyException)
    {
        await tx.RollbackAsync(ct);
        return Results.Conflict(new
        {
            message = "Conflito de concorrência ao atualizar saldo. Outra operação alterou o mesmo produto; tente novamente."
        });
    }
});

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "stock" }));

app.Run();
