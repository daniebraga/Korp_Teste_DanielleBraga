using System.Net.Http.Json;
using System.Text.Json;

namespace BillingService.Integration;

public sealed class StockHttpClient(HttpClient http, ILogger<StockHttpClient> log) : IStockClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<StockCommitResult> CommitInventoryAsync(
        StockInventoryCommitRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            using var response = await http.PostAsJsonAsync("/api/inventory/commit", request, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return new StockCommitResult(true, (int)response.StatusCode, null, body);
            }

            var message = TryReadMessage(body) ?? response.ReasonPhrase ?? "Falha ao comunicar com o serviço de estoque.";
            log.LogWarning("Estoque retornou {Status}: {Message}", response.StatusCode, message);
            return new StockCommitResult(false, (int)response.StatusCode, message, body);
        }
        catch (HttpRequestException ex)
        {
            log.LogError(ex, "Serviço de estoque indisponível (rede/HTTP).");
            return new StockCommitResult(false, StatusCodes.Status503ServiceUnavailable,
                "Serviço de estoque indisponível. Verifique se o microsserviço de estoque está em execução e tente novamente.",
                null);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            log.LogError(ex, "Timeout ao chamar o serviço de estoque.");
            return new StockCommitResult(false, StatusCodes.Status503ServiceUnavailable,
                "Tempo esgotado ao contatar o estoque. Tente novamente.",
                null);
        }
    }

    private static string? TryReadMessage(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("message", out var m))
            {
                return m.GetString();
            }
        }
        catch
        {
            // ignore
        }

        return null;
    }
}
