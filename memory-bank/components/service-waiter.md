# Service-Waiter Component

## Overview

The Service-Waiter component in Gitpod is a utility service that waits for other services to become available before proceeding. It's designed to be used in initialization and deployment scenarios where services have dependencies on other services being ready. The component can wait for different types of services, including databases, Redis instances, and Kubernetes components, ensuring that a service doesn't start until its dependencies are fully operational.

## Purpose

The primary purposes of the Service-Waiter component are:
- Ensure services start in the correct order during deployment
- Prevent services from starting before their dependencies are ready
- Provide a consistent way to wait for different types of services
- Handle timeouts and failure scenarios gracefully
- Support different types of service readiness checks
- Enable orchestration of complex multi-service deployments
- Improve reliability of service startup sequences
- Provide clear logging and error reporting for troubleshooting

## Architecture

The Service-Waiter component is structured as a command-line tool with several subcommands for different types of services:

1. **Database Waiter**: Waits for a MySQL database to become available
2. **Redis Waiter**: Waits for a Redis instance to become reachable
3. **Component Waiter**: Waits for a Kubernetes component to be ready with the correct image

The component is designed to be run as a Kubernetes init container or as part of a deployment script, blocking until the target service is ready or a timeout is reached.

## Key Features

### Database Waiting

The database waiter:
- Connects to a MySQL database using provided credentials
- Checks if the database is reachable and responsive
- Optionally verifies that the latest migration has been applied
- Supports TLS connections with custom CA certificates
- Retries connections with backoff until success or timeout

### Redis Waiting

The Redis waiter:
- Connects to a Redis instance at the specified host and port
- Verifies connectivity by sending a PING command
- Retries connections until success or timeout
- Provides detailed logging of connection attempts

### Component Waiting

The component waiter:
- Checks if Kubernetes pods with specific labels are running
- Verifies that pods are using the expected container image
- Ensures that pods are in the Ready state
- Monitors pod status until all pods are ready or timeout
- Supports namespace-specific checks

## Configuration

The Service-Waiter component can be configured through command-line flags or environment variables:

### Global Configuration
- `--timeout`, `-t`: Maximum time to wait (default: 5m or `SERVICE_WAITER_TIMEOUT` env var)
- `--verbose`, `-v`: Enable verbose logging
- `--json-log`, `-j`: Produce JSON log output

### Database Waiter Configuration
- `--host`, `-H`: Database host (from `DB_HOST` env var)
- `--port`, `-p`: Database port (from `DB_PORT` env var, default: 3306)
- `--username`, `-u`: Database username (from `DB_USERNAME` env var, default: gitpod)
- `--password`, `-P`: Database password (from `DB_PASSWORD` env var)
- `--caCert`: Custom CA certificate (from `DB_CA_CERT` env var)
- `--migration-check`: Enable checking if the latest migration has been applied

### Redis Waiter Configuration
- `--host`, `-H`: Redis host (default: redis)
- `--port`, `-p`: Redis port (default: 6379)

### Component Waiter Configuration
- `--image`: The latest image of current installer build
- `--namespace`: The namespace of deployment
- `--component`: Component name of deployment
- `--labels`: Labels of deployment

## Usage Patterns

### Waiting for a Database
```bash
service-waiter database --host mysql.example.com --port 3306 --username gitpod --password secret
```

### Waiting for Redis
```bash
service-waiter redis --host redis.example.com --port 6379
```

### Waiting for a Kubernetes Component
```bash
service-waiter component --namespace default --component server --labels "app=gitpod,component=server" --image gitpod/server:latest
```

### Using as an Init Container
```yaml
initContainers:
- name: wait-for-db
  image: gitpod/service-waiter:latest
  command: ["service-waiter", "database"]
  env:
  - name: DB_HOST
    value: mysql
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: mysql-secrets
        key: password
```

## Integration Points

The Service-Waiter component integrates with:
1. **MySQL Databases**: For database readiness checks
2. **Redis Instances**: For Redis readiness checks
3. **Kubernetes API**: For component readiness checks
4. **Deployment Systems**: As part of deployment scripts or init containers
5. **Logging Systems**: For reporting readiness status

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities
- `components/gitpod-db`: For database migration information

### External Dependencies
- MySQL client for database connections
- Redis client for Redis connections
- Kubernetes client for component checks
- Cobra for command-line interface
- Viper for configuration management

## Security Considerations

The component implements several security measures:

1. **TLS Support**: For secure database connections
2. **Password Masking**: Passwords are masked in logs
3. **Minimal Permissions**: Only requires read access to check service status
4. **Timeout Handling**: Prevents indefinite hanging
5. **Error Handling**: Proper handling of connection errors

## Related Components

- **Database**: The service-waiter checks database availability
- **Redis**: The service-waiter checks Redis availability
- **Kubernetes Components**: The service-waiter checks component readiness
- **Deployment Systems**: Use service-waiter to orchestrate deployments
