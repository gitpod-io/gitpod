# TypeORM DB Migrations

To create a new migration file, run this command in the `gitpod-db` component directory:

```
yarn typeorm migrations:create -n NameOfYourMigration
leeway run components:update-license-header
```

Then, simply populate the `up` and `down` methods in the generated migration file.
(Hint: You can look at other migration files for inspiration.)
