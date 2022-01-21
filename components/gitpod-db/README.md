## Gitpod-db

Contains all the database related functionality, implemented using [typeorm](https://typeorm.io/).

### Adding a new table

1. Create a [migration](./src/typeorm/migration/README.md) - use the [baseline](./src/typeorm/migration/1592203031938-Baseline.ts) as an exemplar
1. Create a new entity that implements the requisite interface or extend an existing entity as required - see [db-user.ts](./src/typeorm/entity/db-user.ts)
1. If it is a new table, create the matching injectable ORM implementation and interface (if required) - see [user-db-impl.ts](./src/typeorm/user-db-impl.ts) and [user-db.ts](./src/user-db.ts). Otherwise extend the existing interface and implementation as required.
1. Add the injectable implementation to the [DB container module](./src/container-module.ts), binding the interface and implementation as appropriate, otherwise it will not be instantiated correctly e.g.

```
    bind(TypeORMUserDBImpl).toSelf().inSingletonScope();
    bind(UserDB).toService(TypeORMUserDBImpl);
```

1. Add the new ORM as an injected component where required e.g. in [user-controller.ts](./src/user/user-controller.ts)

```
    @inject(UserDB) protected readonly userDb: UserDB;
```
