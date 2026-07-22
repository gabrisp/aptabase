using FluentMigrator;

namespace Aptabase.Data.Migrations;

[Migration(0013)]
public class AddAppUsers : Migration
{
    public override void Up()
    {
        // app_id may contain the "_DEBUG" suffix for events coming from debug builds,
        // so it's intentionally not a foreign key to apps(id)
        Create.Table("app_users")
            .WithColumn("app_id").AsString(30).NotNullable()
            .WithColumn("user_id").AsString(100).NotNullable()
            .WithColumn("name").AsString(200).Nullable()
            .WithColumn("props").AsCustom("jsonb").NotNullable().WithDefaultValue("{}")
            .WithColumn("first_seen").AsDateTime().NotNullable()
            .WithColumn("last_seen").AsDateTime().NotNullable()
            .WithColumn("last_event_name").AsString(60).NotNullable().WithDefaultValue("");

        Create.PrimaryKey("pk_app_users")
            .OnTable("app_users")
            .Columns("app_id", "user_id");

        Create.Index("idx_app_users_app_id_last_seen")
            .OnTable("app_users")
            .OnColumn("app_id").Ascending()
            .OnColumn("last_seen").Descending();
    }

    public override void Down()
    {
        Delete.Table("app_users");
    }
}
