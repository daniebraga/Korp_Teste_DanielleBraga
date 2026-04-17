namespace StockService.Contracts;

public sealed record CreateProductRequest(string Code, string Description, int Balance);

public sealed record ProductResponse(Guid Id, string Code, string Description, int Balance);

public sealed record InventoryCommitRequest(Guid InvoiceId, IReadOnlyList<InventoryLineRequest> Lines);

public sealed record InventoryLineRequest(Guid ProductId, int Quantity);
