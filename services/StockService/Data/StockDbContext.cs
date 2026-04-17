using Microsoft.EntityFrameworkCore;
using StockService.Models;

namespace StockService.Data;

public sealed class StockDbContext(DbContextOptions<StockDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProcessedInvoiceCommit> ProcessedInvoiceCommits => Set<ProcessedInvoiceCommit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Code).IsRequired().HasMaxLength(64);
            entity.HasIndex(p => p.Code).IsUnique();
            entity.Property(p => p.Description).IsRequired().HasMaxLength(256);
            entity.Property(p => p.Balance).IsRequired();
            entity.Property(p => p.RowVersion).IsRowVersion();
        });

        modelBuilder.Entity<ProcessedInvoiceCommit>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.InvoiceId).IsUnique();
        });
    }
}
