# Usage API

## Overview
The Usage API defines the gRPC interfaces for the Usage service, which is responsible for tracking, calculating, and managing workspace usage, billing, and credits within the Gitpod platform. This API enables the management of cost centers, usage tracking, and integration with payment providers like Stripe.

## Purpose
This API provides a standardized interface for:
- Tracking workspace usage and associated credits
- Managing cost centers and spending limits
- Reconciling usage data for billing purposes
- Integrating with payment providers (primarily Stripe)
- Managing customer subscriptions and payment methods
- Handling billing-related operations like invoices and disputes

## Architecture
The Usage API is implemented as a set of gRPC services defined in Protocol Buffer files. These definitions are used to generate client and server code in Go and TypeScript for use by the usage service and other components in the system.

## Key Services

### UsageService
Provides methods for managing usage and credits:

- `GetCostCenter`: Retrieves the active cost center for a given attribution ID
- `SetCostCenter`: Stores a cost center configuration
- `ReconcileUsage`: Triggers reconciliation of usage data
- `ResetUsage`: Resets usage for cost centers that have expired or will expire soon
- `ListUsage`: Retrieves all usage for a specified attribution ID and time range
- `GetBalance`: Returns the current credits balance for a given attribution ID
- `AddUsageCreditNote`: Adds a usage credit note to a cost center

### BillingService
Provides methods for managing billing and payment integration:

- `ReconcileInvoices`: Retrieves current credit balance and reflects it in the billing system
- `FinalizeInvoice`: Marks sessions as having been invoiced
- `CancelSubscription`: Cancels a Stripe subscription
- `GetStripeCustomer`: Retrieves a Stripe customer
- `CreateStripeCustomer`: Creates a new Stripe customer
- `CreateHoldPaymentIntent`: Creates a payment intent to verify a payment method
- `CreateStripeSubscription`: Creates a new Stripe subscription
- `UpdateCustomerSubscriptionsTaxState`: Updates tax state for customer subscriptions
- `GetPriceInformation`: Returns price information for a given attribution ID
- `OnChargeDispute`: Handles charge disputes with the payment provider

## Key Data Structures

### CostCenter
Represents a cost center configuration:
- Attribution ID
- Spending limit
- Billing strategy (Stripe or Other)
- Next billing time
- Billing cycle start

### Usage
Represents a usage entry:
- ID
- Attribution ID
- Description
- Credits
- Effective time
- Kind (Workspace Instance or Invoice)
- Workspace instance ID
- Draft status
- Metadata

### StripeCustomer
Represents a Stripe customer:
- ID
- Currency
- Billing address validity

### StripeSubscription
Represents a Stripe subscription:
- ID

## Communication Patterns
- The API uses gRPC for efficient, typed communication
- Requests include attribution IDs to identify the relevant account
- Pagination is supported for listing operations
- Time ranges are used to specify periods for usage data

## Dependencies
- Integrated with Stripe for payment processing
- Used by the server component for user billing management
- Used by the workspace manager to track workspace usage
- Used by administrative tools for billing management

## Usage Examples
- Workspace creation process uses this API to check credit availability
- Billing system uses this API to generate invoices
- Administrative interfaces use this API to manage user credits
- Reporting tools use this API to analyze usage patterns

## Version Compatibility
The API uses Protocol Buffers version 3 (proto3) syntax, which provides forward and backward compatibility features. The service is designed to allow for the addition of new billing options and features without breaking existing clients.

## Code Generation and Building

### Regenerating Code from Protobuf Definitions
The Usage API uses Protocol Buffers and gRPC for defining interfaces. When changes are made to the `.proto` files, the corresponding code in Go and TypeScript needs to be regenerated.

To regenerate the code:

1. Navigate to the usage-api directory:
   ```bash
   cd components/usage-api
   ```

2. Run the generate script:
   ```bash
   ./generate.sh
   ```

This script performs the following actions:
- Installs necessary dependencies (protoc plugins)
- Lints the proto files using buf
- Generates Go and TypeScript code using buf
- Updates license headers

### Implementation Details
The `generate.sh` script uses functions from the shared script at `scripts/protoc-generator.sh`:

- `install_dependencies`: Installs required protoc plugins
- `lint`: Lints the proto files using buf
- `protoc_buf_generate`: Generates code using buf based on the configuration in `buf.gen.yaml`
- `update_license`: Updates license headers in generated files

The `buf.gen.yaml` file configures the code generation:
- Generates Go code with appropriate module paths
- Generates TypeScript code using ts_proto with specific options for nice-grpc compatibility

### Building After Code Generation
After regenerating the code, you may need to rebuild components that depend on the Usage API. This typically involves:

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

3. Using Leeway (for CI/CD):
   ```bash
   leeway build -D components/<component-name>:app
   ```

The Usage API is primarily used by the usage component, which manages workspace usage tracking, billing, and credits within the Gitpod platform. It plays a critical role in the business operations of the platform by enabling usage-based billing and credit management.
