# Gitpod Stable API
This package contains definitions for Stable APIs as per our [definition of the package structure](../../README.md).

## Adding or extending APIs (internally)
Changes to the stable APIs require an API User Experience review. If you're looking to extend the API, discuss it first in #feature-public-api.

## Conventions and Style
We’re building a functional, imperative API which acts on resources (as compared to e.g. a declarative resource API like the Kubernetes one). We align services with resources, e.g. have a `WorkspaceService` for working with workspace resources, or an `EnvironmentVariableService`.

We follow this set of conventions to provide a consistent experience:

- Services have a `Service` suffix, i.e. it’s `WorkspaceService` not `Workspace`
    - service names using singular nouns, e.g. `WorkspaceService` not `WorkspacesService`
- Even if operations on services are already contextualised by the service they’re contained in, we do not normalise here. E.g.
    - `WorkspaceService.StartWorkspace` not `WorkspaceService.Start`
- Service and method names follow `CaptialisedCamelCase`
- Fields in messages follow `lowerCamelCase`
- Repeated fields (cardinality > 1) are pluralised. E.g.
    - `repeated string urls = 1` not `repeated string url = 1`
- Listing resources
    - returns a collection of items referred to as `items` in the response message
    - when explicitly listing resources the resource noun is pluralised correctly, e.g.
        - `ListWorkspaces` instead of `ListWorkspace`
        - `ListPeople` instead of `ListPeoples` (because people pluralises to people)
