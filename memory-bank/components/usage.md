# Usage Component

## Overview

The Usage component in Gitpod is responsible for tracking, calculating, and managing workspace usage and billing. It provides services for monitoring workspace usage, calculating credit consumption, managing billing subscriptions, and integrating with payment providers like Stripe. This component is central to Gitpod's usage-based billing model and ensures accurate tracking of resource consumption.

## Purpose

The primary purposes of the Usage component are:
- Track workspace usage across the platform
- Calculate credit consumption based on workspace class and usage time
- Manage billing cycles and subscription periods
- Integrate with payment providers (primarily Stripe)
- Enforce usage limits and spending controls
- Provide usage reporting and analytics
- Reset usage counters at billing cycle boundaries
- Manage cost centers and team billing
- Support different pricing tiers and workspace classes

## Architecture

The Usage component is built as a Go service with several key components:

1. **Usage Service**: Tracks and calculates workspace usage
2. **Billing Service**: Manages billing subscriptions and payments
3. **Scheduler**: Runs periodic jobs for usage calculation and billing
4. **Stripe Integration**: Connects to Stripe for payment processing
5. **Pricer**: Calculates credit costs based on workspace class
6. **Cost Center Manager**: Manages spending limits and cost centers

The component uses a scheduler to periodically run jobs that calculate usage, update ledgers, and reset usage counters at billing cycle boundaries.

## Key Files and Structure

- `main.go`: Entry point for the application
- `cmd/root.go`: Command-line interface setup
- `cmd/run.go`: Main server run command
- `pkg/server/server.go`: Core server implementation
- `pkg/apiv1/usage.go`: Usage service implementation
- `pkg/apiv1/billing.go`: Billing service implementation
- `pkg/apiv1/pricer.go`: Credit pricing calculations
- `pkg/scheduler/`: Scheduling of periodic jobs
- `pkg/stripe/`: Stripe payment integration

## Scheduler Jobs

The Usage component runs several scheduled jobs:

1. **Ledger Trigger Job**: Periodically calculates usage and updates billing ledgers
2. **Reset Usage Job**: Resets usage counters at the end of billing cycles
3. **Billing Sync Job**: Synchronizes billing information with payment providers

These jobs are scheduled based on configuration and use distributed locks (via Redis) to ensure they only run on one instance at a time.

## Credit Calculation

The component calculates credit usage based on:

1. **Workspace Class**: Different workspace classes have different credit rates
2. **Usage Time**: Time spent in workspaces
3. **Billing Period**: Usage is tracked within billing periods
4. **Team Membership**: Usage may be attributed to teams or individuals

The pricer component handles the calculation of credits based on workspace class and usage time.

## Stripe Integration

The Usage component integrates with Stripe for payment processing:

1. **Subscription Management**: Creating and updating subscriptions
2. **Invoice Generation**: Generating invoices for usage
3. **Payment Processing**: Processing payments for usage
4. **Webhook Handling**: Processing Stripe webhook events
5. **Customer Management**: Creating and updating customer records

## Configuration

The Usage component is configured through a JSON configuration file:

```json
{
  "controllerSchedule": "1m",
  "resetUsageSchedule": "24h",
  "creditsPerMinuteByWorkspaceClass": {
    "default": 0.5,
    "large": 1.0
  },
  "stripeCredentialsFile": "/etc/gitpod/stripe/credentials.json",
  "server": {
    "port": 3000,
    "address": "0.0.0.0"
  },
  "defaultSpendingLimit": {
    "forTeams": 500,
    "forUsers": 100
  },
  "stripePrices": {
    "individualUsagePriceId": "price_1234",
    "teamUsagePriceId": "price_5678"
  },
  "redis": {
    "address": "redis:6379"
  },
  "serverAddress": "server:3000",
  "gitpodHost": "gitpod.io"
}
```

## Dependencies

### Internal Dependencies
- `components/common-go`: Common Go utilities
- `components/gitpod-db`: Database access
- `components/public-api`: Public API definitions
- `components/usage-api`: Usage API definitions

### External Dependencies
- Stripe API for payment processing
- Redis for distributed locking and caching
- GORM for database access
- gRPC for API communication

## Integration Points

The Usage component integrates with:
1. **Database**: For storing usage and billing information
2. **Redis**: For distributed locking and job scheduling
3. **Stripe**: For payment processing
4. **Server**: For user and team information
5. **Workspace Manager**: For workspace usage information

## Security Considerations

The component implements several security measures:

1. **Encryption**: Sensitive payment information is encrypted
2. **Access Control**: Usage information is only accessible to authorized users
3. **Audit Logging**: Changes to billing and usage are logged
4. **Webhook Verification**: Stripe webhooks are verified for authenticity
5. **Rate Limiting**: API endpoints are rate-limited to prevent abuse

## Metrics

The component exposes various metrics:

- Usage calculation durations
- Billing operation counts
- Stripe API call latencies
- Job execution times
- Error counts

## Common Usage Patterns

The Usage component is typically used to:
1. Track workspace usage for billing purposes
2. Calculate credit consumption for users and teams
3. Process payments through Stripe
4. Enforce usage limits and spending controls
5. Generate usage reports and analytics
6. Reset usage counters at billing cycle boundaries

## Related Components

- **Server**: Provides user and team information
- **Database**: Stores usage and billing information
- **Workspace Manager**: Provides workspace usage information
- **Public API Server**: Exposes usage and billing APIs
