namespace StockService.Models;

/// <summary>Idempotência: mesma nota não debita estoque duas vezes.</summary>
public sealed class ProcessedInvoiceCommit
{
    public Guid Id { get; set; }
    public Guid InvoiceId { get; set; }
    public DateTimeOffset ProcessedAt { get; set; }
}
