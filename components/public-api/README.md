# Public-API

This component contains the Gitpod (Public) API.

:warning: This API is currently in development and may change frequently before it reaches General Availability

## API Structure
The API is structured into two packages:
* stable
* experimenetal

For each package, we provide different guarantees on compatiblity and evolution of the APIs.

### Stable
APIs defined in the **stable** package provide the following guarantees:
* Services, calls, types and fields are not removed without following a deprecation policy (TBD).
* Services, calls, types fields are not renamed.
* Non succesfull responses are described exhaustively.

### Experimental
APIs in defined in the **experimental** package provide no guarantees. You should not rely on them for any functionality.
