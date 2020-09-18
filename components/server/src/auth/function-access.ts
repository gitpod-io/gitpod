import { injectable } from "inversify";

export interface FunctionAccessGuard {
    canAccess(name: string): boolean;
}

export interface WithFunctionAccessGuard {
    functionGuard?: FunctionAccessGuard;
}

@injectable()
export class AllAccessFunctionGuard {
    canAccess(name: string): boolean {
        return true;
    }
}

export class ExplicitFunctionAccessGuard {
    constructor(protected readonly allowedCalls: string[]) {}

    canAccess(name: string): boolean {
        return this.allowedCalls.some(c => c === name);
    }
}
