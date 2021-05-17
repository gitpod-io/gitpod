# TypeORM DB Migrations

To create a new migration file, run this command in the `gitpod-db` component directory:

```
yarn typeorm migrations:create -n NameOfYourMigration
```

## Naming the migration file
Use appropriate prefix for your file. The migration file name template is `<string-prefix>-NameOfYourMigration.ts`. Replace the `NameOfYourMigration` with the following naming convention when the operation is being performed only on a single table:
```sh
<MigrationNature><SchemaName>
```
where `MigrationNature` can be `Update`, `Alter`, `Create` etc. If you are performing more than one operation e.g. table alteration and value update, you can entirely skip the `MigrationNature` prefix. You are free to choose any other name if the convention doesn't make sense in your case.

e.g. `1621244652650-AlterWorkspaceCluster`.

Then, simply populate the `up` and `down` methods in the generated migration file.
(Hint: You can look at other migration files for inspiration.)
