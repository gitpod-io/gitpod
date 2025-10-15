# Stripe Subscription Cancellation Scripts

Two Go scripts for bulk cancellation of Stripe subscriptions:

1. **extract-active-subscriptions.go** - Extracts active subscription IDs from database
2. **cancel-subscriptions.go** - Cancels subscriptions and finalizes invoices

## Prerequisites

- Go 1.19 or later
- Access to Gitpod database
- Stripe secret key with write permissions

## Installation

Install required dependencies:

```bash
cd scripts
go mod init stripe-scripts
go get github.com/stripe/stripe-go/v72
go get gorm.io/gorm
go get gorm.io/driver/mysql
```

## Script 1: Extract Active Subscriptions

Queries the database for Stripe customers and extracts their active subscription IDs.

### Usage

```bash
go run extract-active-subscriptions.go \
  --db-dsn "user:password@tcp(host:3306)/gitpod" \
  --stripe-key "sk_live_..." \
  --exclude-orgs "org-id-1,org-id-2" \
  --output "active-subscriptions.txt"
```

### Parameters

- `--db-dsn` (required): MySQL database connection string
  - Format: `user:password@tcp(host:port)/database`
  - Example: `gitpod:password@tcp(db.example.com:3306)/gitpod`

- `--stripe-key` (required): Stripe secret key
  - Format: `sk_live_...` or `sk_test_...`

- `--exclude-orgs` (optional): Comma-separated organization IDs to exclude
  - Example: `a7dcf253-f05e-4dcf-9a47-cf8fccc74717,b8edf364-g16f-5edg-0b58-dg9gddd85828`

- `--output` (optional): Output file path (default: `active-subscriptions.txt`)

### Output

Creates a text file with one subscription ID per line:

```
sub_1MlPf9LkdIwHu7ixB6VIYRyX
sub_2NqRg0MldJxIv8jyC7WJZSaY
sub_3OrSh1NmeKyJw9kzD8XKaTbZ
```

### Example Output

```
Excluding 2 organization(s)
Found 150 Stripe customers in database

Extraction complete!
Summary:
- Total customers processed: 150
- Excluded (by organization): 5
- Active subscriptions found: 145
- Errors: 0
- Output written to: active-subscriptions.txt
```

## Script 2: Cancel Subscriptions

Reads subscription IDs from file and cancels them in Stripe.

### Usage

```bash
# Dry run (recommended first)
go run cancel-subscriptions.go \
  --stripe-key "sk_live_..." \
  --input "active-subscriptions.txt" \
  --dry-run

# Actual cancellation
go run cancel-subscriptions.go \
  --stripe-key "sk_live_..." \
  --input "active-subscriptions.txt"
```

### Parameters

- `--stripe-key` (required): Stripe secret key
  - Format: `sk_live_...` or `sk_test_...`

- `--input` (optional): Input file with subscription IDs (default: `active-subscriptions.txt`)

- `--dry-run` (optional): Preview actions without making changes

### Behavior

For each subscription:
1. Retrieves subscription from Stripe
2. If already canceled → skips silently
3. If active:
   - Finalizes any draft invoice for current period
   - Cancels subscription immediately
4. Continues on errors

### Example Output

```
=== DRY RUN MODE ===
Processing 145 subscription(s)...

[1/145] Processing sub_1MlPf9LkdIwHu7ixB6VIYRyX... would finalize invoice in_1MlPf9LkdIwHu7ixEo6hdgCw, would cancel subscription
[2/145] Processing sub_2NqRg0MldJxIv8jyC7WJZSaY... already canceled (skipped)
[3/145] Processing sub_3OrSh1NmeKyJw9kzD8XKaTbZ... would cancel subscription
...

=== DRY RUN SUMMARY ===
Total processed: 145
Cancelled: 142
Already cancelled (skipped): 3
Errors: 0
```

## Recommended Workflow

1. **Extract subscriptions** with exclusions:
   ```bash
   go run extract-active-subscriptions.go \
     --db-dsn "user:pass@tcp(host:3306)/gitpod" \
     --stripe-key "sk_live_..." \
     --exclude-orgs "org-to-keep-1,org-to-keep-2"
   ```

2. **Review the output file** (`active-subscriptions.txt`)

3. **Dry run** to preview changes:
   ```bash
   go run cancel-subscriptions.go \
     --stripe-key "sk_live_..." \
     --dry-run
   ```

4. **Execute cancellation**:
   ```bash
   go run cancel-subscriptions.go \
     --stripe-key "sk_live_..."
   ```

## Safety Features

- **Dry run mode**: Preview all actions before execution
- **No database writes**: Scripts never modify the Gitpod database
- **Error resilience**: Continues processing on errors
- **Silent skip**: Already-canceled subscriptions are skipped without logging
- **Summary reporting**: Clear counts of success/skip/error

## Notes

- Subscriptions are canceled **immediately** (not at period end)
- Draft invoices are finalized before cancellation to capture current usage
- The scripts do NOT update Gitpod's cost center or billing strategy
- Organization IDs are extracted from attribution IDs (format: `team:<org-id>`)

## Troubleshooting

### Database Connection Issues

Ensure your DSN includes all required parameters:
```
user:password@tcp(host:port)/database?parseTime=true&loc=UTC
```

### Stripe API Errors

- Verify your API key has write permissions
- Check rate limits if processing many subscriptions
- Use test mode (`sk_test_...`) for testing

### Empty Output File

- Verify database contains Stripe customers
- Check that customers have active subscriptions
- Ensure excluded organizations aren't filtering all results
