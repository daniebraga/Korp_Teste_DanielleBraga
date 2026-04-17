namespace BillingService.Integration;

public interface IStockClient
{
    Task<StockCommitResult> CommitInventoryAsync(StockInventoryCommitRequest request, CancellationToken cancellationToken);
}

public sealed record StockCommitResult(bool Success, int StatusCode, string? ErrorMessage, string? Body);
