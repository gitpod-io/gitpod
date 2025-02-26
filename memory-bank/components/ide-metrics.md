# IDE Metrics Component

## Overview

The IDE Metrics component is a service in Gitpod that collects, processes, and exposes metrics and error reports from various IDE components. It provides a centralized way to gather performance data, usage statistics, and error information from IDE-related components such as the supervisor, VS Code extensions, and web workbenches.

## Purpose

The primary purposes of the IDE Metrics component are:
- Collect metrics from IDE components
- Process and validate metric data
- Expose metrics in Prometheus format
- Handle error reporting from IDE components
- Provide a gRPC and REST API for metrics submission
- Support aggregated histogram metrics for efficient data collection
- Implement security measures through label allowlists
- Enable monitoring of IDE performance and usage

## Architecture

The IDE Metrics component is built as a Go service with several key components:

1. **Metrics Server**: Core server that handles gRPC and HTTP requests
2. **Metrics Registry**: Manages Prometheus metrics
3. **Error Reporter**: Processes and forwards error reports
4. **Label Validator**: Validates metric labels against allowlists
5. **Aggregated Histograms**: Efficiently handles histogram data

The component exposes both gRPC and HTTP endpoints for metrics submission and provides a Prometheus-compatible endpoint for metrics scraping.

## Key Files and Structure

- `main.go`: Entry point for the application
- `cmd/root.go`: Command-line interface setup
- `cmd/run.go`: Main server run command
- `pkg/server/server.go`: Core server implementation
- `pkg/metrics/`: Metrics handling utilities
- `pkg/errorreporter/`: Error reporting functionality
- `config-example.json`: Example configuration

## Metrics Types

The IDE Metrics component supports several types of metrics:

### Counter Metrics
Simple counters that can be incremented or added to, used for tracking occurrences of events.

### Histogram Metrics
Record observations in buckets, used for measuring durations or sizes.

### Aggregated Histogram Metrics
Efficiently handle pre-aggregated histogram data, reducing the number of individual metric submissions.

## Error Reporting

The component includes an error reporting system that:
- Validates error reports against an allowlist of components
- Structures error data with contextual information
- Forwards errors to an error reporting service
- Includes workspace and user context with errors

## Security Measures

The IDE Metrics component implements several security measures:

### Label Allowlists
- Validates metric labels against configured allowlists
- Replaces invalid labels with default or "unknown" values
- Logs unexpected label names or values
- Prevents metric explosion from arbitrary labels

### Component Allowlists
- Validates error reporting components against an allowlist
- Prevents unauthorized components from submitting errors
- Logs attempts from unexpected components

## Configuration

The IDE Metrics component is configured through a JSON configuration file:

```json
{
  "server": {
    "port": 9500,
    "counterMetrics": [
      {
        "name": "example_counter",
        "help": "Example counter metric",
        "labels": [
          {
            "name": "label1",
            "allowValues": ["value1", "value2"],
            "defaultValue": "unknown"
          }
        ]
      }
    ],
    "histogramMetrics": [...],
    "aggregatedHistogramMetrics": [...],
    "errorReporting": {
      "allowComponents": ["supervisor", "vscode-web"]
    }
  },
  "prometheus": {
    "addr": "localhost:9500"
  }
}
```

## API Endpoints

The IDE Metrics component exposes several API endpoints:

- `/metrics-api/`: Base path for all API requests
- `/metrics`: Prometheus metrics endpoint

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities
- `components/ide-metrics-api`: API definitions

### External Dependencies
- Prometheus client for metrics
- gRPC for API communication
- gRPC-web for browser compatibility
- cmux for multiplexing connections

## Integration Points

The IDE Metrics component integrates with:
1. **Supervisor**: Submits metrics and error reports
2. **VS Code Extensions**: Submit metrics and error reports
3. **Web Workbench**: Submits metrics and error reports
4. **Prometheus**: Scrapes exposed metrics
5. **Error Reporting Service**: Receives error reports

## Common Usage Patterns

The IDE Metrics component is typically used to:
1. Track IDE performance metrics
2. Monitor feature usage
3. Collect error reports from IDE components
4. Generate dashboards for IDE health and usage
5. Identify performance bottlenecks

## Related Components

- **IDE Service**: Configures and manages IDEs
- **IDE Proxy**: Proxies requests to IDE Metrics
- **Supervisor**: Submits metrics and error reports
- **Dashboard**: May display metrics data
