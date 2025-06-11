# Claude Context for Gitpod

This file provides essential context for AI assistants working on the Gitpod codebase.

## Project Overview

Gitpod is a cloud development environment platform that provides automated, ready-to-code development environments for any Git repository. The platform consists of multiple interconnected services and components that work together to deliver seamless developer experiences.

## Memory Bank Structure

This repository maintains comprehensive documentation in the `memory-bank/` directory:

### Core Documentation
- **[Project Brief](memory-bank/projectbrief.md)** - Foundation document defining core requirements and goals
- **[Product Context](memory-bank/productContext.md)** - Why this project exists and problems it solves
- **[System Patterns](memory-bank/systemPatterns.md)** - System architecture and key technical decisions
- **[Tech Context](memory-bank/techContext.md)** - Technologies used and development setup
- **[Active Context](memory-bank/activeContext.md)** - Current work focus and recent changes
- **[Progress](memory-bank/progress.md)** - What works, what's left to build, and current status

### Component Documentation
The `memory-bank/components/` directory contains detailed documentation for each service and component in the Gitpod platform. Start with **[components.md](memory-bank/components.md)** for an overview.

## Working with This Codebase

1. **Start by reading the memory bank** - Always begin by reviewing the core documentation files above to understand the current state and context
2. **Component-specific work** - Refer to the relevant component documentation in `memory-bank/components/`
3. **Architecture decisions** - Check `memory-bank/systemPatterns.md` for established patterns and conventions
4. **Current focus** - Review `memory-bank/activeContext.md` for ongoing work and priorities

## Key Characteristics

- **Multi-service architecture** - Gitpod consists of dozens of interconnected services
- **Kubernetes-native** - Designed to run on Kubernetes with cloud-native patterns
- **Developer experience focus** - Every decision prioritizes developer productivity and experience
- **Workspace lifecycle management** - Complex orchestration of development environments
- **Security and isolation** - Strong emphasis on secure, isolated development environments

## Important Notes

- This is a production system serving thousands of developers
- Changes should be thoroughly tested and follow established patterns
- Security considerations are paramount given the multi-tenant nature
- Performance and scalability are critical concerns
- The codebase spans multiple languages (Go, TypeScript, Java) and technologies

Always refer to the memory bank documentation for the most current and detailed information about any aspect of the system.
