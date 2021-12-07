/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const UI_EXPERIMENTS_KEY = "gitpod-ui-experiments";

/**
 * This enables UI-experiments: Dashboard-local changes that we'd like to try out and get some feedback on/validate
 * our assumptions on via mixpanel before we roll them out to everyone. The motivation is to make UI development more
 * data-driven then the current approach.
 *
 * An experiment is supposed to:
 *  - only be applied to a subset of users, so we are guaranteed to always have a control group (configurable per experiment)
 *  - is dashboard/component local: it's not a mechnanism to cross the API boundary, mostly even component-local
 *  - is stable per session/client
 *  - is defined in code (see below): adding/deprecating experiments requires a deployment
 * It is NOT supposed to:
 *  - big a way to roll-out big, completly new features
 *  - have a lot of different experiments in parallel (too noisy)
 *
 * Questions:
 *  - multiple experiments per user/time
 */
const Experiments = {
    /**
     * Experiment "example" will be activate on login for 10% of all clients.
     */
    // "example": 0.1,
    "login-from-context-6826": 0.5, // https://github.com/gitpod-io/gitpod/issues/6826
};
const ExperimentsSet = new Set(Object.keys(Experiments)) as Set<Experiment>;
export type Experiment = keyof (typeof Experiments);

export namespace Experiment {
    export function seed(keepCurrent: boolean): Set<Experiment> {
        const current = keepCurrent ? get() : undefined;

        // add all current experiments to ensure stability
        const result = new Set<Experiment>([...(current || [])].filter(e => ExperimentsSet.has(e)));

        // identify all new experiments and add if random
        const newExperiment = new Set<Experiment>([...ExperimentsSet].filter(e => !result.has(e)));
        for (const e of newExperiment) {
            if (Math.random() < Experiments[e]) {
                result.add(e);
            }
        }

        return result;
    }

    export function set(set: Set<Experiment>): void {
        try {
            const arr = Array.from(set);
            window.localStorage.setItem(UI_EXPERIMENTS_KEY, JSON.stringify(arr));
        } catch (err) {
            console.error(`error setting ${UI_EXPERIMENTS_KEY}`, err);
        }
    }

    export function has(experiment: Experiment): boolean {
        const set = get();
        if (!set) {
            return false;
        }
        return set.has(experiment);
    }

    export function get(): Set<Experiment> | undefined {
        const arr = window.localStorage.getItem(UI_EXPERIMENTS_KEY);
        if (arr === null) {
            return undefined;
        }
        return new Set(JSON.parse(arr)) as Set<Experiment>;
    }

    export function getAsArray(): Experiment[] {
        const set = get();
        if (!set) {
            return [];
        }
        return Array.from(set);
    }
}