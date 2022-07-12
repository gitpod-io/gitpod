## Gitpod-db

Contains all the database related functionality, implemented using [typeorm](https://typeorm.io/).

### Working on gitpod-protocol component
When you are making changes to gitpod-protocol component, make sure to run `yarn build` in gitpod-protocol folder to make sure your changes will be rebuild. Also consider running `yarn watch` so that any changes are rebuilt in realtime.

### Adding a new table
1. Create a [migration](./src/typeorm/migration/README.md) - use the [baseline](./src/typeorm/migration/1592203031938-Baseline.ts) as an exemplar
2. Create a new entity that implements the requisite interface or extend an existing entity as required - see [db-user.ts](./src/typeorm/entity/db-user.ts)
3. If it is a new table, create the matching injectable ORM implementation and interface (if required) - see [user-db-impl.ts](./src/typeorm/user-db-impl.ts) and [user-db.ts](./src/user-db.ts). Otherwise extend the existing interface and implementation as required.
4. Add the injectable implementation to the [DB container module](./src/container-module.ts), binding the interface and implementation as appropriate, otherwise it will not be instantiated correctly e.g.
```
    bind(TypeORMUserDBImpl).toSelf().inSingletonScope();
    bind(UserDB).toService(TypeORMUserDBImpl);
```
5. Add the new ORM as an injected component where required e.g. in [user-controller.ts](./src/user/user-controller.ts)
```
    @inject(UserDB) protected readonly userDb: UserDB;
```
