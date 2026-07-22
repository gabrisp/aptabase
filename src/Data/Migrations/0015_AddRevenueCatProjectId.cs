using FluentMigrator;

namespace Aptabase.Data.Migrations;

[Migration(0015)]
public class AddRevenueCatProjectId : Migration
{
    public override void Up()
    {
        Alter.Table("apps")
            .AddColumn("revenuecat_project_id").AsString(50).Nullable();
    }

    public override void Down()
    {
        Delete.Column("revenuecat_project_id").FromTable("apps");
    }
}
