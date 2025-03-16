# Error Handling System

This module provides a robust error handling system for the application, including error categorization, context enrichment, and automatic retry mechanisms for transient errors.

## Features

- **Error Categorization**: Errors are categorized by type (network, API, validation, etc.)
- **Context Enrichment**: Errors include additional context like source, operation, and timestamp
- **Automatic Retries**: Built-in retry mechanism with exponential backoff for transient errors
- **Centralized Logging**: All errors are logged with consistent formatting and context
- **Dependency Injection**: Integrated with the application's DI system

## Usage

### Basic Error Handling

```typescript
import { ErrorHandler, AppError, ErrorType } from '../services/error/ErrorHandler';

// Get the error handler from the container
const errorHandler = container.resolve<ErrorHandler>('ErrorHandler');

try {
  // Your code that might throw an error
} catch (error) {
  // The error handler will normalize any error to an AppError
  errorHandler.handleError(error, {
    source: 'myComponent',
    operation: 'myOperation'
  });
}
```

### Creating Specific Error Types

```typescript
// Create a validation error
throw new AppError(
  'Invalid input data',
  ErrorType.VALIDATION,
  {
    source: 'userService',
    operation: 'createUser',
    data: { field: 'email', value: 'invalid-email' }
  }
);

// Using factory methods
throw AppError.api(
  'API rate limit exceeded',
  {
    source: 'dataService',
    operation: 'fetchData',
    endpoint: '/api/data'
  },
  originalError, // Optional original error
  true // This error is retryable
);
```

### Using the Retry Mechanism

```typescript
const result = await errorHandler.withRetry(
  async () => {
    // Your code that might fail transiently
    return await fetchData();
  },
  {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffFactor: 2,
    retryableErrorTypes: [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.RATE_LIMIT
    ]
  }
);
```

## Error Types

The system defines the following error types:

- `NETWORK`: Network connectivity issues
- `API`: API-related errors (rate limits, server errors)
- `VALIDATION`: Input validation errors
- `AUTHENTICATION`: Authentication failures
- `AUTHORIZATION`: Permission/access issues
- `NOT_FOUND`: Resource not found
- `TIMEOUT`: Operation timed out
- `RATE_LIMIT`: Rate limit exceeded
- `INTERNAL`: Internal application errors
- `UNKNOWN`: Unclassified errors

## Retry Options

The retry mechanism accepts the following options:

- `maxRetries`: Maximum number of retry attempts (default: 3)
- `initialDelay`: Initial delay in milliseconds (default: 1000)
- `maxDelay`: Maximum delay in milliseconds (default: 30000)
- `backoffFactor`: Exponential backoff multiplier (default: 2)
- `retryableErrorTypes`: Array of error types that should be retried

## Integration with Logging

All errors handled by the system are automatically logged with the appropriate log level and context information. The system uses the application's centralized logging service. 