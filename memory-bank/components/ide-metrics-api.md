# IDE Metrics API

## Overview
The IDE Metrics API defines the gRPC interfaces for collecting metrics and error reports from IDE components within the Gitpod platform. It provides a standardized way for IDE instances to report performance data and errors to a central metrics service.

## Purpose
This API enables:
- Collection of performance metrics from IDE instances
- Reporting of errors encountered in IDE components
- Aggregation of metrics for monitoring and analysis
- Standardized error reporting for debugging and issue resolution

## Architecture
The IDE Metrics API is implemented as a gRPC service defined in Protocol Buffer files. These definitions are used to generate client and server code in various languages (Go, TypeScript, Java) for use by IDE components and the metrics collection service.

## Key Services

### MetricsService
Provides methods for reporting metrics and errors:

- `AddCounter`: Increments a counter metric with specified labels
- `ObserveHistogram`: Records an observation in a histogram metric
- `AddHistogram`: Adds pre-aggregated histogram data
- `reportError`: Reports an error with detailed context information

## Key Data Structures

### Metric Types
The API supports two primary metric types:
- **Counters**: Simple incrementing counters for tracking occurrences
- **Histograms**: Distribution metrics for measuring values that can be aggregated

### Error Reports
Error reports include:
- Error stack trace
- Component and version information
- User, workspace, and instance identifiers
- Custom properties for additional context

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- HTTP REST endpoints are also exposed for the same operations (via Google API annotations)
- Metrics are reported asynchronously without waiting for responses
- Error reports include comprehensive context for effective debugging

## Dependencies
- Used by IDE components (VS Code, JetBrains) to report metrics and errors
- Integrated with monitoring and alerting systems
- May feed into analytics dashboards for performance monitoring

## Usage Examples
- VS Code extensions report performance metrics for editor operations
- JetBrains IDE plugins report error conditions
- Supervisor monitors IDE health and reports metrics
- Dashboard displays aggregated metrics for system health monitoring

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new metric types and error reporting fields without breaking existing clients.

## Security Considerations
- Error reports may contain sensitive information and should be handled accordingly
- User identifiers in metrics should be anonymized or aggregated for privacy
- Access to raw metrics and error reports should be restricted to authorized personnel

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The IDE Metrics API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in various languages needs to be regenerated.

To regenerate the code:

1. Navigate to the ide-metrics-api directory:
   ```bash
   cd components/ide-metrics-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Generates Go code using `protoc-gen-go` and `protoc-gen-go-grpc`
- Generates gRPC Gateway code for REST API endpoints
- Generates Java code
- Updates license headers

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh` and defines some custom functions:

- `install_dependencies`: Installs required protoc plugins
- `local_go_protoc`: Generates Go code with specific include paths
- `go_protoc_gateway`: Generates gRPC Gateway code for REST endpoints
- `local_java_protoc`: Generates Java code
- `update_license`: Updates license headers in generated files

The IDE Metrics API is unique in that it generates both gRPC and REST API endpoints using the gRPC Gateway, and it also generates Java code for use in JetBrains IDE plugins.

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the IDE Metrics API. This typically involves:

1. For Go components:
   ```bash
   cd <component-directory>
   go build ./...
   ```

2. For TypeScript components:
   ```bash
   cd <component-directory>
   yarn install
   yarn build
   ```

3. For Java components:
   ```bash
   cd <component-directory>/java
   ./gradlew build
   ```

4. Using Leeway (for CI/CD):
   ```bash
   leeway build -D components/<component-name>:app
   ```
