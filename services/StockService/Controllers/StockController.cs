using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockService.Contracts;
using StockService.Data;
using StockService.Models;

namespace StockService.Controllers;

[ApiController]
public sealed class StockController : ControllerBase
{
    [HttpGet("api/products")]
    public async Task<IActionResult> GetProducts([FromServices] StockDbContext db, CancellationToken ct)
    {
        var items = await db.Products
            .AsNoTracking()
            .OrderBy(p => p.Code)
            .Select(p => new ProductResponse(p.Id, p.Code, p.Description, p.Balance))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet("api/products/{id:guid}")]
    public async Task<IActionResult> GetProduct(Guid id, [FromServices] StockDbContext db, CancellationToken ct)
    {
        var p = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return p is null
            ? NotFound()
            : Ok(new ProductResponse(p.Id, p.Code, p.Description, p.Balance));
    }

    [HttpPost("api/products")]
    public async Task<IActionResult> CreateProduct([FromBody] CreateProductRequest body, [FromServices] StockDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.Description))
        {
            return BadRequest(new { message = "Código e descrição são obrigatórios." });
        }

        if (body.Balance < 0)
        {
            return BadRequest(new { message = "Saldo não pode ser negativo." });
        }

        var normalizedCode = body.Code.Trim();
        var exists = await db.Products.AnyAsync(p => p.Code == normalizedCode, ct);
        if (exists)
        {
            return Conflict(new { message = "Já existe produto com este código." });
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

        return Created($"/api/products/{entity.Id}", new ProductResponse(entity.Id, entity.Code, entity.Description, entity.Balance));
    }

    [HttpPut("api/products/{id:guid}")]
    public async Task<IActionResult> UpdateProduct(Guid id, [FromBody] CreateProductRequest body, [FromServices] StockDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.Description))
        {
            return BadRequest(new { message = "Código e descrição são obrigatórios." });
        }

        var entity = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null) return NotFound();

        var normalizedCode = body.Code.Trim();
        if (await db.Products.AnyAsync(p => p.Code == normalizedCode && p.Id != id, ct))
        {
            return Conflict(new { message = "Já existe outro produto com este código." });
        }

        entity.Code = normalizedCode;
        entity.Description = body.Description.Trim();
        entity.Balance = body.Balance;

        try
        {
            await db.SaveChangesAsync(ct);
            return Ok(new ProductResponse(entity.Id, entity.Code, entity.Description, entity.Balance));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Conflito de concorrência ao atualizar o produto; tente novamente." });
        }
    }

    [HttpDelete("api/products/{id:guid}")]
    public async Task<IActionResult> DeleteProduct(Guid id, [FromServices] StockDbContext db, CancellationToken ct)
    {
        var entity = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null) return NotFound();

        db.Products.Remove(entity);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("api/inventory/commit")]
    public async Task<IActionResult> CommitInventory([FromBody] InventoryCommitRequest body, [FromServices] StockDbContext db, CancellationToken ct)
    {
        if (body.Lines.Count == 0)
        {
            return BadRequest(new { message = "A nota precisa ter ao menos um item." });
        }

        if (body.Lines.Any(l => l.Quantity <= 0))
        {
            return BadRequest(new { message = "Quantidades devem ser maiores que zero." });
        }

        var already = await db.ProcessedInvoiceCommits.AsNoTracking()
            .AnyAsync(x => x.InvoiceId == body.InvoiceId, ct);
        if (already)
        {
            return Ok(new { message = "Operação já processada (idempotente).", invoiceId = body.InvoiceId });
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
                    return BadRequest(new { message = $"Produto {productId} não encontrado no estoque." });
                }

                if (product.Balance < qty)
                {
                    await tx.RollbackAsync(ct);
                    return BadRequest(new
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
            return Ok(new { message = "Estoque atualizado." });
        }
        catch (DbUpdateConcurrencyException)
        {
            await tx.RollbackAsync(ct);
            return Conflict(new
            {
                message = "Conflito de concorrência ao atualizar saldo. Outra operação alterou o mesmo produto; tente novamente."
            });
        }
    }

    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "ok", service = "stock" });

    [HttpDelete("api/inventory/{invoiceId:guid}")]
    [HttpDelete("api/invoices/{invoiceId:guid}")]
    public async Task<IActionResult> DeleteInvoice(Guid invoiceId, [FromServices] StockDbContext db, CancellationToken ct)
    {
        // This removes the processed-invoice marker so the same invoice can be processed again.
        // It does NOT attempt to revert product balances because invoice line items are not stored here.
        var commit = await db.ProcessedInvoiceCommits.FirstOrDefaultAsync(x => x.InvoiceId == invoiceId, ct);
        if (commit is null) return NotFound();

        db.ProcessedInvoiceCommits.Remove(commit);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
