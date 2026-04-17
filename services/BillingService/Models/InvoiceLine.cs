namespace BillingService.Models;

public sealed class InvoiceLine
{
    public Guid Id { get; set; }
    public Guid InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }
    public Guid ProductId { get; set; }
    public required string ProductCode { get; set; }
    public required string ProductDescription { get; set; }
    public int Quantity { get; set; }
}
