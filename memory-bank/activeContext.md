# Active Context: Gitpod

## Current Work Focus
Building a comprehensive knowledge base of the Gitpod codebase and architecture for effective development, troubleshooting, and enhancement.

| Focus Area | Description |
|------------|-------------|
| System Architecture | Component relationships and service interactions |
| Component Documentation | Detailed documentation for each component |
| Development Workflow | Effective development and testing processes |
| Documentation | Comprehensive memory bank maintenance |
| Standardized Workflows | Established development procedures |

## Recent Changes

- Established memory bank structure with core files
- Created standardized PRD workflow for feature development
- Documented 33 service components and 11 API components
- Enhanced API component documentation with code generation information
- Implemented server readiness probe with database, SpiceDB, and Redis connectivity checks
- **Improved `registry-facade` resilience by implementing a comprehensive retry mechanism for blob retrieval, addressing transient network errors.**
- **Implemented redirect for non-signed-in Gitpod Classic PAYG users from `gitpod.io/#` to `app.ona.com/#`. Added redirect logic to both `QueryErrorBoundary.tsx` (primary path for authentication errors) and kept it in `App.tsx` (secondary path for defense in depth). This provides comprehensive coverage across different execution paths.**

## Next Steps

1. **Monitor `registry-facade`:** Observe the component's behavior with the new retry logic to ensure it correctly handles the previously identified network issues.
2. **Component Interactions**: Understand inter-component communication
3. **Development Environment**: Configure local development setup
3. **Build System**: Gain experience with in-tree and Leeway builds
4. **Component Builds**: Practice building different component types
5. **Initial Tasks**: Identify specific improvement areas
6. **Testing Approach**: Define validation methodology
7. **Memory Bank Updates**: Continue documentation expansion

## Active Decisions

| Category | Considerations |
|----------|----------------|
| **Architecture** | • Component boundaries<br>• API contracts<br>• Performance impacts |
| **Development** | • Testing strategies<br>• Documentation standards<br>• Collaboration model |
| **Technical** | • Backward compatibility<br>• Security implications<br>• Scalability impacts |

## Current Questions

1. How do components interact in specific scenarios?
2. What are the current performance bottlenecks?
3. What's the most effective testing approach for different components?
4. What is the process for production deployment?
5. Which features/improvements are currently prioritized?

## Active Experiments
No active experiments currently in progress.

## Recent Learnings

| Area | Insights |
|------|----------|
| **Architecture** | • Microservices with loosely coupled services<br>• Go (backend) and TypeScript/React (frontend)<br>• Kubernetes-native components<br>• gRPC for service communication |
| **Component Patterns** | • Go services with cmd/ directory structure<br>• TypeScript with Reac<br>• Clear API/implementation separation |
| **Build System** | • In-tree: Language tools (yarn, go) for local dev<br>• Out-of-tree: Leeway for CI/CD and dependency management |
| **Server Architecture** | • Dependency injection (Inversify)<br>• Component registration in container-module.ts<br>• HTTP endpoints in registerRoutes method<br>• Health checks: liveness (event loop) and readiness (dependencies) |
| **Critical Dependencies** | • Database (TypeORM)<br>• SpiceDB (authorization)<br>• Redis (caching, pub/sub, locking) |
