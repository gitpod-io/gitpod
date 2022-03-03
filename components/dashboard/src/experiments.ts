/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const UI_EXPERIMENTS_KEY = 'gitpod-ui-experiments';

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
    example: 0.1,
};
type Experiments = Partial<{ [e in Experiment]: boolean }>;
export type Experiment = keyof typeof Experiments;

export namespace Experiment {
    /**
     * Randomly decides what the set of Experiments is the user participates in
     * @param keepCurrent
     * @returns Experiments
     */
    export function seed(keepCurrent: boolean): Experiments {
        const result = keepCurrent ? get() || {} : {};

        for (const experiment of Object.keys(Experiments) as Experiment[]) {
            if (!(experiment in result)) {
                result[experiment] = Math.random() < Experiments[experiment];
            }
        }

        return result;
    }

    export function set(set: Experiments): void {
        try {
            window.localStorage.setItem(UI_EXPERIMENTS_KEY, JSON.stringify(set));
        } catch (err) {
            console.warn(`error setting ${UI_EXPERIMENTS_KEY}`, err);
        }
    }

    export function has(experiment: Experiment): boolean {
        try {
            const set = get();
            if (!set) {
                return false;
            }
            return set[experiment] === true;
        } catch (err) {
            console.warn(`error checking experiment '${experiment}'`, err);
            return false;
        }
    }

    /** Retrieves all currently valid Experiments from localStorage */
    export function get(): Experiments | undefined {
        try {
            const objStr = window.localStorage.getItem(UI_EXPERIMENTS_KEY);
            if (objStr === null) {
                return undefined;
            }

            const obj = JSON.parse(objStr) as Experiments;
            // trim to contain only known keys so we're type-safe
            for (const e of Object.keys(obj)) {
                if (!(e in Experiments)) {
                    delete (obj as any)[e];
                }
            }
            return obj;
        } catch (err) {
            // we definitely don't want to break anybody because of weird errors
            console.warn(`error getting ${UI_EXPERIMENTS_KEY}`, err);
            return undefined;
        }
    }
}
