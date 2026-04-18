using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace StockService.Migrations
{
    [DbContext(typeof(StockService.Data.StockDbContext))]
    partial class StockDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
            modelBuilder
                .HasAnnotation("Relational:MaxIdentifierLength", 128)
                .HasAnnotation("ProductVersion", "8.0.0");

            modelBuilder.Entity("StockService.Models.Product", b =>
            {
                b.Property<Guid>("Id")
                    .ValueGeneratedNever()
                    .HasColumnType("uniqueidentifier");

                b.Property<string>("Code")
                    .IsRequired()
                    .HasMaxLength(64)
                    .HasColumnType("nvarchar(64)");

                b.Property<string>("Description")
                    .IsRequired()
                    .HasMaxLength(256)
                    .HasColumnType("nvarchar(256)");

                b.Property<int>("Balance")
                    .HasColumnType("int");

                b.Property<byte[]>("RowVersion")
                    .IsRowVersion()
                    .HasColumnType("rowversion");

                b.HasKey("Id");

                b.HasIndex("Code")
                    .IsUnique();

                b.ToTable("Products");
            });

            modelBuilder.Entity("StockService.Models.ProcessedInvoiceCommit", b =>
            {
                b.Property<Guid>("Id")
                    .ValueGeneratedNever()
                    .HasColumnType("uniqueidentifier");

                b.Property<Guid>("InvoiceId")
                    .HasColumnType("uniqueidentifier");

                b.Property<DateTimeOffset>("ProcessedAt")
                    .HasColumnType("datetimeoffset");

                b.HasKey("Id");

                b.HasIndex("InvoiceId")
                    .IsUnique();

                b.ToTable("ProcessedInvoiceCommits");
            });
        }
    }
}
