/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { useEffect, useRef, useState } from "react";
import { countries } from 'countries-list';
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getGitpodService } from "../service/service";
import AlertBox from "../components/AlertBox";
import Modal from "../components/Modal";
import { AssigneeIdentifier, TeamSubscription, TeamSubscriptionSlotResolved } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { Currency, Plan, Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { ChargebeeClient } from "../chargebee/chargebee-client";
import copy from '../images/copy.svg';
import exclamation from '../images/exclamation.svg';
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { poll, PollOptions } from "../utils";
import settingsMenu from "./settings-menu";
import { Disposable } from "@gitpod/gitpod-protocol";

export default function Teams() {

    return (<div>
        <PageWithSubMenu subMenu={settingsMenu} title='Teams' subtitle='View and manage subscriptions for your team with one centralized billing.'>
            <AllTeams />
        </PageWithSubMenu>
    </div>);
}

interface Slot extends TeamSubscriptionSlotResolved {
    loading?: boolean;
    errorMsg?: string;
}

function AllTeams() {

    const [defaultCurrency, setDefaultCurrency] = useState<string>("USD");

    const [slots, setSlots] = useState<Slot[]>([]);
    const [showPaymentUI, setShowPaymentUI] = useState<boolean>(false);
    const [isChargebeeCustomer, setIsChargebeeCustomer] = useState<boolean>(false);
    const [isStudent, setIsStudent] = useState<boolean>(false);
    const [teamSubscriptions, setTeamSubscriptions] = useState<TeamSubscription[]>([]);

    const [createTeamModal, setCreateTeamModal] = useState<{ types: string[], defaultCurrency: string } | undefined>(undefined);
    const [manageTeamModal, setManageTeamModal] = useState<{ sub: TeamSubscription } | undefined>(undefined);
    const [inviteMembersModal, setInviteMembersModal] = useState<{ sub: TeamSubscription } | undefined>(undefined);
    const [addMembersModal, setAddMembersModal] = useState<{ sub: TeamSubscription } | undefined>(undefined);

    const restorePendingPlanPurchase = () => {
        const pendingState = restorePendingState("pendingPlanPurchase") as { planId: string } | undefined;
        return pendingState;
    }

    const restorePendingSlotsPurchase = () => {
        const pendingState = restorePendingState("pendingSlotsPurchase") as { tsId: string } | undefined;
        return pendingState;
    }

    const restorePendingState = (key: string) => {
        const obj = getLocalStorageObject(key);
        if (typeof obj === "object" && typeof obj.expirationDate === "string") {
            const now = new Date().toISOString();
            if (obj.expirationDate >= now) {
                return obj;
            } else {
                removeLocalStorageObject(key);
            }
        }
    }
    const storePendingState = (key: string, obj: any) => {
        const expirationDate = new Date(Date.now() + 5 * 60 * 1000).toISOString()
        setLocalStorageObject(key, { ...obj, expirationDate });
    }

    const [pendingPlanPurchase, setPendingPlanPurchase] = useState<{ planId: string } | undefined>(restorePendingPlanPurchase());
    const [pendingSlotsPurchase, setPendingSlotsPurchase] = useState<{ tsId: string } | undefined>(restorePendingSlotsPurchase());

    const pendingPlanPurchasePoller = useRef<Disposable>();
    const pendingSlotsPurchasePoller = useRef<Disposable>();

    const cancelPollers = () => {
        pendingPlanPurchasePoller.current?.dispose();
        pendingSlotsPurchasePoller.current?.dispose();
    }

    useEffect(() => {
        if (pendingPlanPurchase) {
            storePendingState("pendingPlanPurchase", pendingPlanPurchase);
            pollForPlanPurchased(Plans.getAvailableTeamPlans().filter(p => p.chargebeeId === pendingPlanPurchase.planId)[0])
        } else {
            pendingPlanPurchasePoller.current?.dispose();
            removeLocalStorageObject("pendingPlanPurchase");
        }
    }, [pendingPlanPurchase]);

    useEffect(() => {
        if (pendingSlotsPurchase) {
            storePendingState("pendingSlotsPurchase", pendingSlotsPurchase);
            pollForAdditionalSlotsBought();
        } else {
            pendingSlotsPurchasePoller.current?.dispose();
            removeLocalStorageObject("pendingSlotsPurchase");
        }
    }, [pendingSlotsPurchase]);

    useEffect(() => {
        queryState();

        return function cleanup() {
            cancelPollers();
        }
    }, []);

    const queryState = async () => {
        try {
            const [slots, showPaymentUI, teamSubscriptions, clientRegion, isStudent] = await Promise.all([
                getGitpodService().server.tsGetSlots(),
                getGitpodService().server.getShowPaymentUI(),
                getGitpodService().server.tsGet(),
                getGitpodService().server.getClientRegion(),
                getGitpodService().server.isStudent(),
            ]);

            setDefaultCurrency((clientRegion && (countries as any)[clientRegion]?.currency === 'EUR') ? 'EUR' : 'USD');
            setIsStudent(isStudent);

            setSlots(slots);
            setShowPaymentUI(showPaymentUI);
            setTeamSubscriptions(teamSubscriptions);
        } catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        if (!isChargebeeCustomer) {
            (async () => {
                try {
                    setIsChargebeeCustomer(await getGitpodService().server.isChargebeeCustomer());
                } catch (error) {
                    console.log(error);
                }
            })()
        }
        if (pendingPlanPurchase) {
            if (teamSubscriptions.some(ts => ts.planId === pendingPlanPurchase.planId)) {
                setPendingPlanPurchase(undefined);
            }
        }
    }, [teamSubscriptions]);

    useEffect(() => {
        if (pendingSlotsPurchase) {
            if (slots.some(s => s.teamSubscription.id === pendingSlotsPurchase.tsId)) {
                setPendingSlotsPurchase(undefined);
            }
        }
    }, [slots]);

    const getSubscriptionTypes = () => isStudent ? ['professional', 'professional-new', 'student'] : ['professional', 'professional-new'];

    const getActiveSubs = () => {
        const now = new Date().toISOString();
        const activeSubs = (teamSubscriptions || []).filter(ts => TeamSubscription.isActive(ts, now));
        return activeSubs;
    }

    const getAvailableSubTypes = () => {
        const usedTypes = getActiveSubs().map(sub => getPlan(sub)?.type as string);
        const types = getSubscriptionTypes().filter(t => !usedTypes.includes(t));
        return types;
    }

    const getSlotsForSub = (sub: TeamSubscription) => {
        const result: Slot[] = [];
        const plan = getPlan(sub);
        slots.forEach(s => {
            if (s.teamSubscription.planId === plan.chargebeeId) {
                result.push(s);
            }
        })
        return result;
    }

    const onBuy = (plan: Plan, quantity: number, sub?: TeamSubscription) => {
        inputHandler(sub).buySlots(plan, quantity);
        setCreateTeamModal(undefined);
        setAddMembersModal(undefined);
    }

    const slotDoPoll = (slot: TeamSubscriptionSlotResolved) => () => pollForSlotUpdate(slot);

    const pollForSlotUpdate = (slot: TeamSubscriptionSlotResolved) => {
        const opts: PollOptions<TeamSubscriptionSlotResolved> = {
            backoffFactor: 1.4,
            retryUntilSeconds: 2400,
            success: (result) => {
                if (result) {
                    updateSlot(slot, (s) => {
                        return { ...result, loading: false }
                    })
                }
            },
            stop: () => {
                updateSlot(slot, (s) => ({ ...s, loading: false }))
            },

        };
        poll<TeamSubscriptionSlotResolved>(1, async () => {
            const freshSlots = await getGitpodService().server.tsGetSlots();
            const freshSlot = freshSlots.find(s => s.id === slot.id);
            if (!freshSlot) {
                // Our slot is not included any more: looks like an update, better fetch complete state
                queryState();
                return { done: true };
            }

            return {
                done: freshSlot.state !== slot.state || freshSlot.assigneeId !== slot.assigneeId,
                result: freshSlot
            };
            // tslint:disable-next-line:align
        }, opts);
    }

    const updateSlot = (slot: TeamSubscriptionSlotResolved, update: (s: Slot) => Slot) => {
        setSlots((prevState) => {
            const next = [...prevState]
            const i = next.findIndex(s => s.id === slot.id);
            if (i >= 0) {
                next[i] = update(next[i]);
            }
            return next;
        })
    }

    const slotSetErrorMessage = (slot: TeamSubscriptionSlotResolved) => (err: any) => {
        updateSlot(slot, (s) => {
            const result = { ...s }
            result.errorMsg = err && ((err.data && err.data.msg) || err.message || String(err));
            result.loading = false;
            return result;
        });
    };

    const slotInputHandler = {
        assign: (slot: TeamSubscriptionSlotResolved, assigneeIdentifier: string) => {
            updateSlot(slot, (s) => ({ ...s, loading: true }));
            getGitpodService().server.tsAssignSlot(slot.teamSubscription.id, slot.id, assigneeIdentifier)
                .then(slotDoPoll(slot))
                .catch(slotSetErrorMessage(slot));
        },
        reassign: (slot: TeamSubscriptionSlotResolved, newAssigneeIdentifier: string) => {
            updateSlot(slot, (s) => ({ ...s, loading: true }));
            getGitpodService().server.tsReassignSlot(slot.teamSubscription.id, slot.id, newAssigneeIdentifier)
                .then(slotDoPoll(slot))
                .catch(slotSetErrorMessage(slot));
        },
        deactivate: (slot: TeamSubscriptionSlotResolved) => {
            updateSlot(slot, (s) => ({ ...s, loading: true }));
            getGitpodService().server.tsDeactivateSlot(slot.teamSubscription.id, slot.id)
                .then(slotDoPoll(slot))
                .catch(slotSetErrorMessage(slot));
        },
        reactivate: (slot: TeamSubscriptionSlotResolved) => {
            updateSlot(slot, (s) => ({ ...s, loading: true }));
            getGitpodService().server.tsReactivateSlot(slot.teamSubscription.id, slot.id)
                .then(slotDoPoll(slot))
                .catch(slotSetErrorMessage(slot));
        }
    };

    const inputHandler = (ts: TeamSubscription | undefined) => {
        return {
            buySlots: async (plan: Plan, quantity: number) => {
                if (ts) {
                    // Buy new slots for existing subscription
                    if (ts.planId !== plan.chargebeeId) {
                        console.log("Plan IDs do not match!");
                        return;
                    }


                    getGitpodService().server.tsAddSlots(ts.id, quantity).then(() => {
                        setPendingSlotsPurchase({ tsId: ts.id });

                        pollForAdditionalSlotsBought();
                    })
                        .catch((err) => {
                            setPendingSlotsPurchase(undefined);

                            if (err.code === ErrorCodes.PAYMENT_ERROR) {
                                alert(`Payment error: ${err.message}`);
                            }
                        });
                } else {
                    // Buy new subscription + initial slots

                    let successful = false;
                    (await ChargebeeClient.getOrCreate()).checkout(async (server) => {
                        setPendingPlanPurchase({ planId: plan.chargebeeId });

                        return server.checkout(plan.chargebeeId, quantity)
                    }, {
                        success: () => {
                            successful = true;
                            pollForPlanPurchased(plan);
                        },
                        close: () => {
                            if (!successful) {
                                // Close gets triggered after success, too: Only close if necessary
                                setPendingPlanPurchase(undefined);
                            }
                        }
                    });
                }
            }
        };
    };
    const pollForPlanPurchased = (plan: Plan) => {
        let token: { cancelled?: boolean } = {};
        pendingPlanPurchasePoller.current?.dispose();
        pendingPlanPurchasePoller.current = Disposable.create(() => { token.cancelled = true });

        const opts: PollOptions<TeamSubscription[]> = {
            token,
            backoffFactor: 1.4,
            retryUntilSeconds: 240,
            success: async (result) => {
                const slotsResolved = await getGitpodService().server.tsGetSlots();

                setSlots(slotsResolved);
                setTeamSubscriptions(result || []);

                setPendingPlanPurchase(undefined);
            }
        };
        poll<TeamSubscription[]>(2, async () => {
            const now = new Date().toISOString();
            const teamSubscriptions = await getGitpodService().server.tsGet();
            // Has active subscription with given plan?
            if (teamSubscriptions.some(t => TeamSubscription.isActive(t, now) && t.planId === plan.chargebeeId)) {
                return { done: true, result: teamSubscriptions };
            } else {
                return { done: false };
            }
        }, opts);
    }
    const pollForAdditionalSlotsBought = () => {
        let token: { cancelled?: boolean } = {};
        pendingSlotsPurchasePoller.current?.dispose();
        pendingSlotsPurchasePoller.current = Disposable.create(() => { token.cancelled = true });

        const opts: PollOptions<TeamSubscriptionSlotResolved[]> = {
            token,
            backoffFactor: 1.4,
            retryUntilSeconds: 240,
            success: (result) => {
                setSlots(result || []);

                setPendingSlotsPurchase(undefined);
            },
            stop: () => {
            }
        };
        poll<TeamSubscriptionSlotResolved[]>(2, async () => {
            const freshSlots = await getGitpodService().server.tsGetSlots();
            if (freshSlots.length > slots.length) {
                return { done: true, result: freshSlots };
            }
            return { done: false };
        }, opts);
    }

    const getPlan = (sub: TeamSubscription) => {
        return Plans.getAvailableTeamPlans().filter(p => p.chargebeeId === sub.planId)[0];
    }

    const subscriptionMenu = (sub: TeamSubscription) => {
        const result: ContextMenuEntry[] = [];
        result.push({
            title: 'Manage Members',
            onClick: () => manageMembers(sub)
        })
        result.push({
            title: 'Add Members',
            onClick: () => addMembers(sub)
        })
        result.push({
            title: 'Invite Members',
            onClick: () => inviteMembers(sub)
        })
        return result;
    };

    const showCreateTeamModal = () => {
        const types = getAvailableSubTypes();
        if (types && types.length > 0) {
            setCreateTeamModal({ types, defaultCurrency })
        }
    }

    const manageMembers = (sub: TeamSubscription) => {
        setManageTeamModal({ sub });
    }

    const addMembers = (sub: TeamSubscription) => {
        setAddMembersModal({ sub });
    }

    const inviteMembers = (sub: TeamSubscription) => {
        setInviteMembersModal({ sub });
    }

    const showBilling = async () => {
        (await ChargebeeClient.getOrCreate()).openPortal();
    }

    const isPaymentInProgress = (ts: TeamSubscription) => {
        return pendingSlotsPurchase && pendingSlotsPurchase.tsId === ts.id
    }

    const renderTeams = () => (<React.Fragment>
        <div className="flex flex-row">
            <div className="flex-grow ">
                <h3 className="self-center">All Teams</h3>
                <h2>Manage teams and team members.</h2>
            </div>
            <div className="flex flex-end space-x-3">
                {isChargebeeCustomer && (
                    <button className="self-end my-auto secondary" onClick={() => showBilling()}>Billing</button>
                )}
                {getActiveSubs().length > 0 && (
                    <button className="self-end my-auto" disabled={!!pendingPlanPurchase || getAvailableSubTypes().length === 0} onClick={() => showCreateTeamModal()}>Create Team</button>
                )}
            </div>
        </div>

        {createTeamModal && (
            <NewTeamModal onClose={() => setCreateTeamModal(undefined)} onBuy={onBuy} {...createTeamModal} />
        )}

        {manageTeamModal && (
            <ManageTeamModal onClose={() => { queryState(); setManageTeamModal(undefined) }} slotInputHandler={slotInputHandler} slots={getSlotsForSub(manageTeamModal.sub)} />
        )}

        {inviteMembersModal && (
            <InviteMembersModal onClose={() => setInviteMembersModal(undefined)} {...inviteMembersModal} />
        )}

        {addMembersModal && (
            <AddMembersModal onClose={() => setAddMembersModal(undefined)} onBuy={onBuy} {...addMembersModal} />
        )}

        {(getActiveSubs().length === 0 && !pendingPlanPurchase) && (
            <div className="w-full flex h-80 mt-2 rounded-xl bg-gray-100 dark:bg-gray-900">
                <div className="m-auto text-center">
                    <h3 className="self-center text-gray-500 dark:text-gray-400 mb-4">No Active Teams</h3>
                    <div className="text-gray-500 mb-6">Get started by creating a team<br /> and adding team members. <a href="https://www.gitpod.io/docs/teams/" target="_blank" rel="noopener" className="gp-link">Learn more</a></div>
                    <button className="self-center" onClick={() => showCreateTeamModal()}>Create Team</button>
                </div>
            </div>
        )}

        {(getActiveSubs().length > 0 || !!pendingPlanPurchase) && (
            <div className="flex flex-col pt-6 space-y-2">
                {pendingPlanPurchase && (
                    <div key={"team-sub-" + pendingPlanPurchase.planId} className="flex-grow flex flex-row hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl h-16 w-full group">
                        <div className="px-4 self-center w-1/12">
                            <div className={"rounded-full w-3 h-3 text-sm align-middle bg-gitpod-kumquat"}>
                                &nbsp;
                        </div>
                        </div>
                        <div className="p-0 my-auto flex flex-col w-6/12">
                            <span className="my-auto font-medium truncate overflow-ellipsis">{Plans.getAvailableTeamPlans().filter(p => p.chargebeeId === pendingPlanPurchase.planId)[0]?.name}</span>
                            <span className="text-sm my-auto text-gray-400 truncate overflow-ellipsis">Purchased on {formatDate(new Date().toString())}</span>
                        </div>
                        <div className="p-0 my-auto flex w-4/12">
                            <div className="ml-auto self-center rounded-xl bg-orange-300 font-medium text-sm text-orange-700 py-1 px-2 animate-pulse">
                                Payment in Progress
                            </div>
                        </div>
                        <div className="my-auto flex w-1/12 opacity-0 group-hover:opacity-100 justify-end">
                        </div>
                    </div>
                )}
                {getActiveSubs().map((sub, index) => (
                    <div key={"team-sub-" + sub.id} className="flex-grow flex flex-row hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl h-16 w-full group">
                        <div className="px-4 self-center w-1/12">
                            <div className={"rounded-full w-3 h-3 text-sm align-middle " + (isPaymentInProgress(sub) ? "bg-gitpod-kumquat" : "bg-green-500")}>
                                &nbsp;
                        </div>
                        </div>
                        <div className="p-0 my-auto flex flex-col w-4/12">
                            <span className="my-auto font-medium truncate overflow-ellipsis">{getPlan(sub)?.name}</span>
                            <span className="text-sm my-auto text-gray-400 truncate overflow-ellipsis">Purchased on {formatDate(sub?.startDate)}</span>
                        </div>
                        <div className="p-0 my-auto flex flex-col w-2/12">
                            <span className="my-auto truncate text-gray-500 overflow-ellipsis">{slots.filter(s => s.state !== 'cancelled' && s.teamSubscription.id === sub.id).length || "–"}</span>
                            <span className="text-sm my-auto text-gray-400">Members</span>
                        </div>
                        <div className="p-0 my-auto flex w-4/12">
                            {isPaymentInProgress(sub) && (
                                <div className="ml-auto self-center rounded-xl bg-orange-300 font-medium text-sm text-orange-700 py-1 px-2 animate-pulse">
                                    Payment in Progress
                                </div>
                            )}
                        </div>
                        <div className="my-auto flex w-1/12 mr-4 opacity-0 group-hover:opacity-100 justify-end">
                            <div className="self-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md cursor-pointer w-8">
                                <ContextMenu menuEntries={subscriptionMenu(sub)} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </React.Fragment>);

    return (<div>
        {showPaymentUI ? renderTeams() : (
            <div className="flex flex-row">
                <div className="flex-grow ">
                    <h3 className="self-center">All Teams</h3>
                    <h2>Manage teams and team members.</h2>
                </div>
            </div>
        )}
    </div>);
}

function InviteMembersModal(props: {
    sub: TeamSubscription,
    onClose: () => void
}) {

    const [copied, setCopied] = useState<boolean>(false);

    const getInviteURL = () => {
        const link = new URL(window.location.href);
        link.pathname = '/plans'
        link.search = '?teamid=' + props.sub.id;
        return link.href;
    }

    const copyToClipboard = (text: string) => {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (<Modal visible={true} onClose={props.onClose}>
        <h3 className="pb-2">Invite Members</h3>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-4 space-y-2">
            <p className="pb-2 text-gray-500 text-base">Invite members to the team using the URL below.</p>

            <div className="flex flex-col space-y-2">
                <label htmlFor="inviteUrl" className="font-medium">Invite URL</label>
                <div className="w-full relative">
                    <input name="inviteUrl" disabled={true} readOnly={true} type="text" value={getInviteURL()} className="rounded-md w-full truncate pr-8" />
                    <div className="cursor-pointer" onClick={() => copyToClipboard(getInviteURL())}>
                        <img src={copy} title="Copy Invite URL" className="absolute top-1/3 right-3" />
                    </div>
                </div>
                <p className="pb-4 text-gray-500 text-sm">{copied ? "Copied to clipboard!" : "Use this URL to join this team."}</p>
            </div>

        </div>
        <div className="flex justify-end mt-6">
            <button className={"ml-2 secondary"} onClick={() => props.onClose()}>Close</button>
        </div>
    </Modal>);
}

const quantities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function AddMembersModal(props: {
    sub: TeamSubscription,
    onBuy: (plan: Plan, quantity: number, sub: TeamSubscription) => void,
    onClose: () => void
}) {

    const [quantity, setQuantity] = useState<number>(5);

    const [expectedPrice, setExpectedPrice] = useState<string>("");

    useEffect(() => {
        const plan = getPlan();
        const expectedPrice = quantity * plan.pricePerMonth;
        setExpectedPrice(`${Currency.getSymbol(plan.currency)}${expectedPrice}`);
    }, [quantity])

    const getPlan = () => {
        return Plans.getAvailableTeamPlans().filter(p => p.chargebeeId === props.sub.planId)[0];
    }

    return (<Modal visible={true} onClose={props.onClose}>
        <h3 className="pb-2">Add Members</h3>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-4">
            <p className="pb-4 text-gray-500 text-base">Add members to the team.</p>

            <div className="flex flex-col space-y-2 pb-4">
                <label htmlFor="quantity" className="font-medium">Members</label>
                <select name="quantity" value={quantity} className="rounded-md w-full"
                    onChange={(e) => setQuantity(parseInt(e.target.value || '1', 10))}>
                    {quantities.map(n => (
                        <option key={`quantity-${n}`} value={n}>{n}</option>
                    ))}
                </select>
            </div>

            <AlertBox>Total: {expectedPrice} per month</AlertBox>

        </div>
        <div className="flex justify-end mt-6">
            <button className={"ml-2"} onClick={() => props.onBuy(getPlan(), quantity, props.sub)}>Continue to Billing</button>
        </div>
    </Modal>);
}

function NewTeamModal(props: {
    types: string[],
    defaultCurrency: string;
    onBuy: (plan: Plan, quantity: number) => void,
    onClose: () => void,
}) {

    const getPlan = (type: string, currency: string) => {
        return Plans.getAvailableTeamPlans().filter(p => p.type === type && p.currency === currency)[0];
    }

    const [currency, setCurrency] = useState<string>(props.defaultCurrency);
    const [type, setType] = useState<string>(props.types[0]);
    const [plan, setPlan] = useState<Plan>(getPlan(props.types[0], props.defaultCurrency));
    const [quantity, setQuantity] = useState<number>(5);

    const [expectedPrice, setExpectedPrice] = useState<string>("");

    useEffect(() => {
        const newPlan = getPlan(type, currency);
        if (newPlan.chargebeeId !== plan.chargebeeId) {
            setPlan(newPlan);
        }
        const expectedPrice = quantity * newPlan.pricePerMonth;
        setExpectedPrice(`${Currency.getSymbol(newPlan.currency)}${expectedPrice}`);
    }, [currency, type, quantity])

    const teamTypeLabel = (type: string) => {
        return getPlan(type, currency)?.name;
    }

    return (<Modal visible={true} onClose={props.onClose}>
        <h3 className="pb-2">New Team</h3>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-4 space-y-2">
            <p className="pb-4 text-gray-500 text-base">Create a team and add team members.</p>

            <div className="flex flex-col space-y-2">
                <label htmlFor="type" className="font-medium">Team</label>
                <select name="type" value={type} className="rounded-md w-full"
                    onChange={(e) => setType(e.target.value)}>
                    {props.types.map(type => (
                        <option key={`type-option-${type}`} value={type}>{teamTypeLabel(type)}</option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col space-y-2">
                <label htmlFor="quantity" className="font-medium">Members</label>
                <select name="quantity" value={quantity} className="rounded-md w-full"
                    onChange={(e) => setQuantity(parseInt(e.target.value || '1', 10))}>
                    {quantities.map(n => (
                        <option key={`quantity-${n}`} value={n}>{n}</option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col space-y-2">
                <label htmlFor="currency" className="font-medium">Currency</label>
                <select name="currency" value={currency} className="rounded-md w-full"
                    onChange={(e) => setCurrency(e.target.value as any)}>
                    {Currency.getAll().map(c => (
                        <option key={`currency-${c}`} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            <AlertBox className="mt-2">Total: {expectedPrice} per month</AlertBox>

        </div>
        <div className="flex justify-end mt-6">
            <button className={"ml-2"} onClick={() => props.onBuy(plan, quantity)}>Continue to Billing</button>
        </div>
    </Modal>);
}

function ManageTeamModal(props: {
    slots: Slot[],
    slotInputHandler: SlotInputHandler,
    onClose: () => void,
}) {

    const [slots, setSlots] = useState<Slot[]>([]);

    useEffect(() => {
        const activeSlots = props.slots.filter(s => s.state !== 'cancelled');
        setSlots(activeSlots);
    }, [props.slots])

    return (<Modal visible={true} onClose={props.onClose}>
        <h3 className="pb-2">Manage Team</h3>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 py-4 space-y-2">
            <p className="pb-4 text-gray-500 text-base">Add members using their username prefixed by the Git Provider's host.</p>

            <div className="overscroll-contain max-h-96 overflow-y-auto">
                {slots.map((slot, index) => {
                    return (
                        <SlotInput key={slot.id} slot={slot} inputHandler={props.slotInputHandler} />
                    )
                })}
            </div>
        </div>
        <div className="flex justify-end mt-6">
            <button className={"ml-2 secondary"} onClick={() => props.onClose()}>Close</button>
        </div>
    </Modal>);
}

interface SlotInputHandler {
    assign: (slot: TeamSubscriptionSlotResolved, assigneeIdentifier: string) => void;
    reassign: (slot: TeamSubscriptionSlotResolved, newAssigneeIdentifier: string) => void;
    deactivate: (slot: TeamSubscriptionSlotResolved) => void;
    reactivate: (slot: TeamSubscriptionSlotResolved) => void;
}

function SlotInput(props: {
    slot: Slot,
    inputHandler: SlotInputHandler;
}) {

    const [slot, setSlot] = useState<Slot>(props.slot);
    const [editMode, setEditMode] = useState<boolean>(false);
    const [assigneeIdentifier, setAssigneeIdentifier] = useState<string | undefined>();
    const [errorMsg, setErrorMsg] = useState<string | undefined>();

    useEffect(() => {
        setEditMode((prev) => {
            const newEditMode = (prev && !!props.slot.loading) || !!props.slot.errorMsg;
            return newEditMode;
        })

        setSlot(props.slot)
    }, [props.slot])

    useEffect(() => {
        setErrorMsg(slot.errorMsg);
    }, [slot])

    const key = `assignee-${props.slot.id}`;

    const renderIdentifier = (assigneeIdentifier: AssigneeIdentifier | undefined) => {
        if (assigneeIdentifier) {
            return `${assigneeIdentifier.identity.authHost}/${assigneeIdentifier.identity.authName}`;
        }
    };

    const handleAssignment = () => {
        if (slot.state === 'assigned') {
            props.inputHandler.reassign(slot, assigneeIdentifier || '');
        } else {
            props.inputHandler.assign(slot, assigneeIdentifier || '');
        }
    };

    const handleCancel = () => {
        setEditMode(false);
        setErrorMsg(undefined);
        setAssigneeIdentifier(undefined);
    };

    const handleEdit = () => {
        setEditMode(true);
        setErrorMsg(undefined);
        setAssigneeIdentifier('');
    };

    const handleDeactivation = () => {
        props.inputHandler.deactivate(slot);
    }

    const handleReactivation = () => {
        props.inputHandler.reactivate(slot);
    }


    const getActions = (slot: Slot) => {
        const actions: JSX.Element[] = [];

        if (editMode) {
            actions.push((<button key={`slot-action-ok-${slot.id}`} className={"ml-2 disabled:opacity-50"} disabled={slot.loading} onClick={() => handleAssignment()}>OK</button>));
            actions.push((<button key={`slot-action-cancel-${slot.id}`} className={"ml-2 disabled:opacity-50 secondary"} disabled={slot.loading} onClick={() => handleCancel()}>Cancel</button>));
        } else {
            switch (slot.state) {
                case 'unassigned':
                case 'assigned':
                    actions.push(<button key={`slot-action-deactivate-${slot.id}`} className={"ml-2 disabled:opacity-50 danger secondary"} disabled={slot.loading} onClick={() => handleDeactivation()}>Deactivate</button>);
                    break;

                case 'deactivated':
                    actions.push(<button key={`slot-action-reactivate-${slot.id}`} className={"ml-2 disabled:opacity-50"} disabled={slot.loading} onClick={() => handleReactivation()}>Reactivate</button>);
                    break;
            }
        }
        return actions;
    }

    return (
        <div key={key} className="flex flex-col space-y-2 pt-2">
            {/* <label htmlFor={key} className="font-medium">Username</label> */}
            <div className="flex flex-grow flex-row space-x-2">
                <input name={key} value={editMode ? (assigneeIdentifier || "") : (renderIdentifier(slot.assigneeIdentifier) || "")} className="rounded-md w-full pl-2 bg-gray-200 focus:bg-white dark:bg-gray-700 dark:focus:bg-gray-800 "
                    readOnly={!editMode}
                    placeholder={!editMode && (renderIdentifier(slot.assigneeIdentifier) || "e.g. github.com/username") || undefined}
                    onChange={(e) => editMode && setAssigneeIdentifier(e.target.value)}
                    onClick={() => !editMode && handleEdit()}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            handleAssignment()
                        }
                        if (e.key === "Escape") {
                            e.preventDefault()
                            handleCancel()
                        }
                    }}
                />
                {getActions(slot)}
            </div>
            {slot.state === 'deactivated' && (
                <p className="pb-4 text-gray-500 text-sm">You will no longer be billed for this seat starting {formatDate(slot.cancellationDate)}.</p>
            )}
            {errorMsg && (
                <div className="flex rounded-md bg-red-600 p-3">
                    <img className="w-4 h-4 mx-2 my-auto filter-brightness-10" src={exclamation} />
                    <span className="text-white text-sm">{errorMsg}</span>
                </div>
            )}
        </div>
    )

}

function formatDate(date?: string) {
    try {
        if (date) {
            return new Date(Date.parse(date)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        }
    } catch {
    }
    return ""
}

function getLocalStorageObject(key: string) {
    try {
        const string = window.localStorage.getItem(key);
        if (!string) {
            return;
        }
        return JSON.parse(string);
    } catch {
    }
}

function removeLocalStorageObject(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch {
    }
}

function setLocalStorageObject(key: string, object: Object): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(object));
    } catch {
    }
}
