using BillingService.Models;

namespace BillingService.Contracts;

public sealed record InvoiceLineRequest(Guid ProductId, string ProductCode, string ProductDescription, int Quantity);

public sealed record CreateInvoiceRequest(IReadOnlyList<InvoiceLineRequest> Lines);

public sealed record InvoiceLineResponse(
    Guid Id,
    Guid ProductId,
    string ProductCode,
    string ProductDescription,
    int Quantity);

public sealed record InvoiceResponse(
    Guid Id,
    int SequentialNumber,
    string Status,
    IReadOnlyList<InvoiceLineResponse> Lines);

public static class InvoiceMapper
{
    public static InvoiceResponse ToResponse(Invoice invoice) =>
        new(
            invoice.Id,
            invoice.SequentialNumber,
            invoice.Status == InvoiceStatus.Aberta ? "Aberta" : "Fechada",
            invoice.Lines
                .OrderBy(l => l.ProductCode)
                .Select(l => new InvoiceLineResponse(l.Id, l.ProductId, l.ProductCode, l.ProductDescription, l.Quantity))
                .ToList());
}
