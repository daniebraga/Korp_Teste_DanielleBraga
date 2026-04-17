namespace BillingService.Models;

public sealed class Invoice
{
    public Guid Id { get; set; }
    public int SequentialNumber { get; set; }
    public InvoiceStatus Status { get; set; }
    public List<InvoiceLine> Lines { get; set; } = new();
}
