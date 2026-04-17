using Microsoft.EntityFrameworkCore;
using BillingService.Models;

namespace BillingService.Data;

public sealed class BillingDbContext(DbContextOptions<BillingDbContext> options) : DbContext(options)
{
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.Property(i => i.SequentialNumber).IsRequired();
            entity.HasIndex(i => i.SequentialNumber).IsUnique();
            entity.Property(i => i.Status).HasConversion<int>();
        });

        modelBuilder.Entity<InvoiceLine>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.Property(l => l.ProductCode).IsRequired().HasMaxLength(64);
            entity.Property(l => l.ProductDescription).IsRequired().HasMaxLength(256);
            entity.HasOne(l => l.Invoice)
                .WithMany(i => i.Lines)
                .HasForeignKey(l => l.InvoiceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
