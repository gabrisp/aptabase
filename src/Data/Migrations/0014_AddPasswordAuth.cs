using FluentMigrator;

namespace Aptabase.Data.Migrations;

[Migration(0014)]
public class AddPasswordAuth : Migration
{
    public override void Up()
    {
        Alter.Table("users")
            .AddColumn("password_hash").AsString(500).Nullable();
    }

    public override void Down()
    {
        Delete.Column("password_hash").FromTable("users");
    }
}
