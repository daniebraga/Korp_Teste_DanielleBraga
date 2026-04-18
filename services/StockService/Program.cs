using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using StockService.Contracts;
using StockService.Data;
using StockService.Models;

var builder = WebApplication.CreateBuilder(args);

// Read and validate connection string early so we fail with a helpful message if missing.
var sistemaConnection = builder.Configuration.GetConnectionString("Sistema");
if (string.IsNullOrWhiteSpace(sistemaConnection))
{
    throw new InvalidOperationException(
        "Connection string 'Sistema' is not configured. Add it to services/StockService/appsettings.json or set the environment variable 'ConnectionStrings__Sistema'.");
}

builder.Services.AddDbContext<StockDbContext>(options =>
    options.UseSqlServer(sistemaConnection));

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Stock Service — Estoque",
        Version = "v1",
        Description = "Cadastro de produtos/saldos e commit de baixa para o faturamento."
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<StockDbContext>().Database.MigrateAsync();
}

app.UseCors();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Estoque v1");
    options.DocumentTitle = "Stock Service — Swagger";
});

app.UseRouting();

app.UseAuthorization();

app.MapControllers();

app.Run();
