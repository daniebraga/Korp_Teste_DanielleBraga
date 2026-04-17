namespace StockService.Models;

public sealed class Product
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Description { get; set; }
    public int Balance { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}
