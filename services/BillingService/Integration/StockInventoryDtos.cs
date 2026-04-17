namespace BillingService.Integration;

public sealed record StockInventoryCommitRequest(Guid InvoiceId, IReadOnlyList<StockInventoryLine> Lines);

public sealed record StockInventoryLine(Guid ProductId, int Quantity);
