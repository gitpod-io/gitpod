# Scrubber Component

## Overview

The Scrubber component in Gitpod is a Go library that provides functionality for removing or masking sensitive information from data. It's designed to protect personally identifiable information (PII) and other sensitive data from being exposed in logs, error messages, and other outputs. The component offers various methods for scrubbing different types of data structures, including strings, key-value pairs, JSON, and Go structs.

## Purpose

The primary purposes of the Scrubber component are:
- Remove or mask personally identifiable information (PII) from data
- Protect sensitive information such as passwords, tokens, and secrets
- Provide consistent data sanitization across the Gitpod platform
- Support various data formats and structures
- Enable customizable scrubbing rules
- Reduce the risk of sensitive data exposure
- Comply with privacy regulations and best practices
- Facilitate safe logging and error reporting

## Architecture

The Scrubber component is structured as a Go library with several key parts:

1. **Core Scrubber Interface**: Defines the methods for scrubbing different types of data
2. **Scrubber Implementation**: Provides the actual scrubbing functionality
3. **Sanitization Functions**: Implements different sanitization strategies (redaction, hashing)
4. **Configuration**: Defines what fields and patterns should be scrubbed
5. **Struct Walking**: Uses reflection to traverse and scrub complex data structures

The component is designed to be used by other Gitpod components that need to sanitize data before logging, storing, or transmitting it.

## Key Features

### Scrubbing Methods

The Scrubber interface provides several methods for scrubbing different types of data:

1. **Value**: Scrubs a single string value using heuristics to detect sensitive data
2. **KeyValue**: Scrubs a key-value pair, using the key as a hint for how to sanitize the value
3. **JSON**: Scrubs a JSON structure, handling nested objects and arrays
4. **Struct**: Scrubs a Go struct in-place, respecting struct tags for customization
5. **DeepCopyStruct**: Creates a scrubbed deep copy of a Go struct

### Sanitization Strategies

The component implements different sanitization strategies:

1. **Redaction**: Replaces sensitive values with `[redacted]` or `[redacted:keyname]`
2. **Hashing**: Replaces sensitive values with an MD5 hash (`[redacted:md5:hash:keyname]`)
3. **URL Path Hashing**: Specially handles URLs by preserving the structure but hashing path segments

### Configuration

The scrubber is configured with several lists and patterns:

1. **RedactedFieldNames**: Field names whose values should be completely redacted
2. **HashedFieldNames**: Field names whose values should be hashed
3. **HashedURLPathsFieldNames**: Field names containing URLs whose paths should be hashed
4. **HashedValues**: Regular expressions that, when matched, cause values to be hashed
5. **RedactedValues**: Regular expressions that, when matched, cause values to be redacted

### Struct Tag Support

When scrubbing structs, the component respects the `scrub` struct tag:

- `scrub:"ignore"`: Skip scrubbing this field
- `scrub:"hash"`: Hash this field's value
- `scrub:"redact"`: Redact this field's value

### Trusted Values

The component supports a `TrustedValue` interface that allows marking specific values to be exempted from scrubbing:

```go
type TrustedValue interface {
    IsTrustedValue()
}
```

## Usage Patterns

### Basic Value Scrubbing
```go
// Scrub a single value
scrubbedValue := scrubber.Default.Value("user@example.com")
// Result: "[redacted:md5:hash]" or similar
```

### Key-Value Scrubbing
```go
// Scrub a value with key context
scrubbedValue := scrubber.Default.KeyValue("password", "secret123")
// Result: "[redacted]"
```

### JSON Scrubbing
```go
// Scrub a JSON structure
jsonData := []byte(`{"username": "johndoe", "email": "john@example.com"}`)
scrubbedJSON, err := scrubber.Default.JSON(jsonData)
// Result: {"username": "[redacted:md5:hash]", "email": "[redacted]"}
```

### Struct Scrubbing
```go
// Scrub a struct in-place
type User struct {
    Username string
    Email    string `scrub:"redact"`
    Password string
}
user := User{Username: "johndoe", Email: "john@example.com", Password: "secret123"}
err := scrubber.Default.Struct(&user)
// Result: user.Username is hashed, user.Email is redacted, user.Password is redacted
```

### Deep Copy Struct Scrubbing
```go
// Create a scrubbed copy of a struct
type User struct {
    Username string
    Email    string `scrub:"redact"`
    Password string
}
user := User{Username: "johndoe", Email: "john@example.com", Password: "secret123"}
scrubbedUser := scrubber.Default.DeepCopyStruct(user).(User)
// Original user is unchanged, scrubbedUser has sanitized values
```

## Integration Points

The Scrubber component integrates with:
1. **Logging Systems**: To sanitize log messages
2. **Error Handling**: To sanitize error messages
3. **API Responses**: To sanitize sensitive data in responses
4. **Monitoring Systems**: To sanitize metrics and traces
5. **Other Gitpod Components**: To provide consistent data sanitization

## Dependencies

### Internal Dependencies
None specified in the component's build configuration.

### External Dependencies
- `github.com/hashicorp/golang-lru`: For caching sanitization decisions
- `github.com/mitchellh/reflectwalk`: For traversing complex data structures

## Security Considerations

The component implements several security measures:

1. **Default Deny**: Fields are scrubbed by default if they match sensitive patterns
2. **Multiple Strategies**: Different sanitization strategies for different types of data
3. **Caching**: Caches sanitization decisions for performance
4. **Customization**: Allows customization of scrubbing rules
5. **Trusted Values**: Supports marking values as trusted to exempt them from scrubbing

## Related Components

- **Common-Go**: Uses the Scrubber for logging
- **Server**: Uses the Scrubber for API request/response sanitization
- **Workspace Services**: Use the Scrubber to protect workspace data
- **Monitoring Components**: Use the Scrubber to sanitize metrics and traces
