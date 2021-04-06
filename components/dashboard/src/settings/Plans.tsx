/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { useState, useEffect, useContext } from "react";
import { countries } from 'countries-list';
import { AccountStatement, Subscription, UserPaidSubscription, AssignedTeamSubscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { PlanCoupon, GithubUpgradeURL } from "@gitpod/gitpod-protocol/lib/payment-protocol";
import { Plans, Plan, Currency, PlanType } from "@gitpod/gitpod-protocol/lib/plans";
import { ChargebeeClient } from "../chargebee/chargebee-client";
import Modal from "../components/Modal";
import SelectableCard from "../components/SelectableCard";
import info from '../images/info.svg';
import exclamation from '../images/exclamation.svg';
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import settingsMenu from "./settings-menu";

type PlanWithOriginalPrice = Plan & { originalPrice?: number };
type PendingPlan = PlanWithOriginalPrice & { pendingSince: number };

type TeamClaimModal = {
    errorText: string;
    mode: "error";
} | {
    text: string;
    teamId: string;
    slotId: string;
    mode: "confirmation";
}

export default function () {
    const { user } = useContext(UserContext);
    const { server } = getGitpodService();
    const [ accountStatement, setAccountStatement ] = useState<AccountStatement>();
    const [ isChargebeeCustomer, setIsChargebeeCustomer ] = useState<boolean>();
    const [ isStudent, setIsStudent ] = useState<boolean>();
    const [ currency, setCurrency ] = useState<Currency>('USD');
    const [ availableCoupons, setAvailableCoupons ] = useState<PlanCoupon[]>();
    const [ appliedCoupons, setAppliedCoupons ] = useState<PlanCoupon[]>();
    const [ gitHubUpgradeUrls, setGitHubUpgradeUrls ] = useState<GithubUpgradeURL[]>();
    const [ privateRepoTrialEndDate, setPrivateRepoTrialEndDate ] = useState<string>();

    const [ teamClaimModal, setTeamClaimModal ] = useState<TeamClaimModal | undefined>(undefined);

    let pollAccountStatementTimeout: NodeJS.Timeout | undefined;

    useEffect(() => {
        Promise.all([
            server.getAccountStatement({}).then(v => () => setAccountStatement(v)),
            server.isChargebeeCustomer().then(v => () => setIsChargebeeCustomer(v)),
            server.isStudent().then(v => () => setIsStudent(v)),
            server.getClientRegion().then(v => () => {
                // @ts-ignore
                setCurrency(countries[v]?.currency === 'EUR' ? 'EUR' : 'USD');
            }),
            server.getAvailableCoupons().then(v => () => setAvailableCoupons(v)),
            server.getAppliedCoupons().then(v => () => setAppliedCoupons(v)),
            server.getGithubUpgradeUrls().then(v => () => setGitHubUpgradeUrls(v)),
            server.getPrivateRepoTrialEndDate().then(v => () => setPrivateRepoTrialEndDate(v)),
        ]).then(setters => setters.forEach(s => s()))
          .then(() => {
              handleTeamClaim();
          });
        
        
        return function cleanup() {
            clearTimeout(pollAccountStatementTimeout!);
        }
    }, []);

    const handleTeamClaim = async () => {
        const teamId = new URL(window.location.href).searchParams.get('teamid');
        if (!teamId) {
            return;
        }
        const currentlyActiveSubscriptions = (accountStatement?.subscriptions || []).filter(s => Subscription.isActive(s, new Date().toISOString()));
        const assignedSubscriptions = currentlyActiveSubscriptions.filter(s => AssignedTeamSubscription.is(s));
        if (assignedSubscriptions.some(s => !!s.teamSubscriptionSlotId)) {
            return;
        }

        const freeSlot = await getGitpodService().server.tsGetUnassignedSlot(teamId);
        if (!freeSlot) {
            setTeamClaimModal({
                mode: "error",
                errorText: "This invitation is no longer valid. Please contact the team owner.",
            });
            return;
        }

        setTeamClaimModal({
            mode: "confirmation",
            teamId,
            slotId: freeSlot.id,
            text: "You are about to claim a seat in a team.",
        })

    };

    console.log('privateRepoTrialEndDate', privateRepoTrialEndDate);

    const activeSubscriptions = (accountStatement?.subscriptions || []).filter(s => Subscription.isActive(s, new Date().toISOString()));
    const freeSubscription =
        activeSubscriptions.find(s => s.planId === Plans.FREE_OPEN_SOURCE.chargebeeId) // Prefer Pro Open Source plan
        || activeSubscriptions.find(s => Plans.isFreePlan(s.planId)); // Any active free plan
    const freePlan = freeSubscription && Plans.getById(freeSubscription.planId) || Plans.getFreePlan(user?.creationDate || new Date().toISOString());
    const paidSubscription = activeSubscriptions.find(s => UserPaidSubscription.is(s));
    const paidPlan = paidSubscription && Plans.getById(paidSubscription.planId);

    const assignedTeamSubscriptions = activeSubscriptions.filter(s => AssignedTeamSubscription.is(s));
    console.log('assignedTeamSubscriptions', assignedTeamSubscriptions);
    const getAssignedTs = (type: PlanType) => assignedTeamSubscriptions.find(s => {
        const p = Plans.getById(s.planId);
        return !!p && p.type === type
    });
    const assignedUnleashedTs = getAssignedTs('professional');
    const assignedProfessionalTs = getAssignedTs('professional-new');
    const assignedStudentUnleashedTs = getAssignedTs('student');
    const assignedTs = assignedUnleashedTs || assignedProfessionalTs || assignedStudentUnleashedTs;

    const [ pendingUpgradePlan, setPendingUpgradePlan ] = useState<PendingPlan | undefined>(getLocalStorageObject('pendingUpgradePlan'));
    const setPendingUpgrade = (to: PendingPlan) => {
        clearTimeout(pollAccountStatementTimeout!);
        setLocalStorageObject('pendingUpgradePlan', to);
        setPendingUpgradePlan(to);
    };
    const removePendingUpgrade = () => {
        clearTimeout(pollAccountStatementTimeout!);
        removeLocalStorageObject('pendingUpgradePlan');
        setPendingUpgradePlan(undefined);
    }
    if (!!pendingUpgradePlan) {
        if (paidPlan?.chargebeeId === pendingUpgradePlan.chargebeeId) {
            // The upgrade already worked
            removePendingUpgrade();
        } else if ((pendingUpgradePlan.pendingSince + 1000 * 60 * 5) < Date.now()) {
            // Pending upgrades expire after 5 minutes
            removePendingUpgrade();
        } else if (!pollAccountStatementTimeout) {
            // Refresh account statement in 10 seconds in order to poll for upgrade confirmed
            pollAccountStatementTimeout = setTimeout(async () => {
                const statement = await server.getAccountStatement({});
                setAccountStatement(statement);
            }, 10000);
        }
    }

    // Optimistically select a new paid plan even if the transaction is still in progress (i.e. waiting for Chargebee callback)
    const currentPlan = pendingUpgradePlan || paidPlan || Plans.getById(assignedTs?.planId) || freePlan;

    // If the user has a paid plan with a different currency, force that currency.
    if (currency !== currentPlan.currency && !Plans.isFreePlan(currentPlan.chargebeeId)) {
        setCurrency(currentPlan.currency);
    }

    const personalPlan = Plans.getPersonalPlan(currency);
    const professionalPlan = Plans.getNewProPlan(currency);
    const unleashedPlan = Plans.getProPlan(currency);
    const studentUnleashedPlan = Plans.getStudentProPlan(currency);

    const scheduledDowngradePlanId = !!(paidSubscription?.paymentData?.downgradeDate)
        ? paidSubscription.paymentData.newPlan || personalPlan.chargebeeId
        : undefined;

    const [ pendingDowngradePlan, setPendingDowngradePlan ] = useState<PendingPlan | undefined>(getLocalStorageObject('pendingDowngradePlan'));
    const setPendingDowngrade = (to: PendingPlan) => {
        clearTimeout(pollAccountStatementTimeout!);
        setLocalStorageObject('pendingDowngradePlan', to);
        setPendingDowngradePlan(to);
    };
    const removePendingDowngrade = () => {
        clearTimeout(pollAccountStatementTimeout!);
        removeLocalStorageObject('pendingDowngradePlan');
        setPendingDowngradePlan(undefined);
    }
    if (!!pendingDowngradePlan) {
        if (!!accountStatement && (paidPlan || freePlan).chargebeeId === pendingDowngradePlan.chargebeeId) {
            // The Downgrade already worked
            removePendingDowngrade();
        } else if (scheduledDowngradePlanId === pendingDowngradePlan.chargebeeId) {
            // The Downgrade is already scheduled
            removePendingDowngrade();
        } else if ((pendingDowngradePlan.pendingSince + 1000 * 60 * 5) < Date.now()) {
            // Pending downgrades expire after 5 minutes
            removePendingDowngrade();
        } else if (!pollAccountStatementTimeout) {
            // Refresh account statement in 10 seconds in orer to poll for downgrade confirmed/scheduled
            pollAccountStatementTimeout = setTimeout(async () => {
                const statement = await server.getAccountStatement({});
                setAccountStatement(statement);
            }, 10000);
        }
    }

    const [ confirmUpgradeToPlan, setConfirmUpgradeToPlan ] = useState<Plan>();
    const [ confirmDowngradeToPlan, setConfirmDowngradeToPlan ] = useState<Plan>();
    const confirmUpgrade = (to: Plan) => {
        if (pendingUpgradePlan || pendingDowngradePlan) {
            // Don't upgrade if we're still waiting for a Chargebee callback
            return;
        }
        if ((paidSubscription?.paymentReference || '').startsWith("github:")) {
            const url = (gitHubUpgradeUrls || []).find(u => u.planID == to.githubId);
            if (url) {
                window.location.href = url.url;
            }
            return;
        }
        setConfirmUpgradeToPlan(to);
    }
    const doUpgrade = async (event: React.MouseEvent) => {
        if (!confirmUpgradeToPlan) {
            return;
        }
        try {
            (event.target as HTMLButtonElement).disabled = true;
            if (!paidSubscription) {
                await new Promise((resolve, reject) => {
                    ChargebeeClient.getOrCreate().then(chargebeeClient => {
                        chargebeeClient.checkout(paymentServer => paymentServer.checkout(confirmUpgradeToPlan.chargebeeId), {
                            success: resolve,
                            error: reject,
                        });
                    }).catch(reject);
                });
            } else {
                await server.subscriptionUpgradeTo(paidSubscription.uid, confirmUpgradeToPlan.chargebeeId);
            }
            setPendingUpgrade({
              ... confirmUpgradeToPlan,
              pendingSince: Date.now(),
            });
        } catch (error) {
            console.error('Upgrade Error', error);
        } finally {
            setConfirmUpgradeToPlan(undefined);
        }
    }
    const confirmDowngrade = (to: Plan) => {
        if (pendingUpgradePlan || pendingDowngradePlan) {
            // Don't downgrade if we're still waiting for a Chargebee callback
            return;
        }
        if (scheduledDowngradePlanId) {
            // Don't downgrade if another downgrade is already scheduled (first that one should happen or be be cancelled)
            return;
        }
        if ((paidSubscription?.paymentReference || '').startsWith("github:")) {
            const url = (gitHubUpgradeUrls || []).find(u => u.planID == to.githubId);
            if (!url) {
                return;
            }
            window.location.href = url.url;
            return;
        }
        setConfirmDowngradeToPlan(to);
    }
    const doDowngrade = async (event: React.MouseEvent) => {
        if (!confirmDowngradeToPlan || !paidSubscription) {
            return;
        }
        try {
            (event.target as HTMLButtonElement).disabled = true;
            if (Plans.isFreePlan(confirmDowngradeToPlan.chargebeeId)) {
                await server.subscriptionCancel(paidSubscription.uid);
            } else {
                await server.subscriptionDowngradeTo(paidSubscription.uid, confirmDowngradeToPlan.chargebeeId);
            }
            setPendingDowngrade({
              ... confirmDowngradeToPlan,
              pendingSince: Date.now(),
            });
        } catch (error) {
            console.error('Downgrade Error', error);
        } finally {
            setConfirmDowngradeToPlan(undefined);
        }
    }

    const planCards = [];

    // Plan card: Free a.k.a. Open Source (or Professional Open Source)
    const openSourceFeatures = <>
        <p className="truncate" title="Public Repositories">✓ Public Repositories</p>
        <p className="truncate" title="4 Parallel Workspaces">✓ 4 Parallel Workspaces</p>
        <p className="truncate" title="30 min Timeout">✓ 30 min Timeout</p>
    </>;
    if (currentPlan.chargebeeId === freePlan.chargebeeId) {
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={freePlan} isCurrent={!!accountStatement}>{openSourceFeatures}</PlanCard>);
    } else {
        const targetPlan = freePlan;
        let bottomLabel;
        if (scheduledDowngradePlanId === targetPlan.chargebeeId) {
            bottomLabel = <p className="text-green-600">Downgrade scheduled<br/><a className="text-blue-light leading-6" href="javascript:void(0)">Cancel</a></p>;
        } else if (pendingDowngradePlan?.chargebeeId === targetPlan.chargebeeId) {
            bottomLabel = <p className="text-green-600 animate-pulse">Downgrade scheduled</p>;
        }
        let onDowngrade;
        switch (Plans.subscriptionChange(currentPlan.type, targetPlan.type)) {
            case 'downgrade': onDowngrade = () => confirmDowngrade(targetPlan); break;
        }
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={targetPlan} isCurrent={false} onDowngrade={onDowngrade} bottomLabel={bottomLabel}>{openSourceFeatures}</PlanCard>);
    }

    // Plan card: Personal
    const personalFeatures = <>
        <p className="truncate" title={'Everything in ' + freePlan.name}>← Everything in {freePlan.name}</p>
        <p className="truncate" title="Private Repositories">✓ Private Repositories</p>
    </>;
    if (currentPlan.chargebeeId === personalPlan.chargebeeId) {
        const bottomLabel = ('pendingSince' in currentPlan) ? <p className="text-green-600 animate-pulse">Upgrade in progress</p> : undefined;
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={applyCoupons(personalPlan, appliedCoupons)} isCurrent={true} bottomLabel={bottomLabel}>{personalFeatures}</PlanCard>);
    } else {
        const targetPlan = applyCoupons(personalPlan, availableCoupons);
        let bottomLabel;
        if (scheduledDowngradePlanId === targetPlan.chargebeeId) {
            bottomLabel = <p className="text-green-600">Downgrade scheduled<br/><a className="text-blue-light leading-6" href="javascript:void(0)">Cancel</a></p>;
        } else if (pendingDowngradePlan?.chargebeeId === targetPlan.chargebeeId) {
            bottomLabel = <p className="text-green-600">Downgrade scheduled</p>;
        }
        let onUpgrade, onDowngrade;
        switch (Plans.subscriptionChange(currentPlan.type, targetPlan.type)) {
            case 'upgrade': onUpgrade = () => confirmUpgrade(targetPlan); break;
            case 'downgrade': onDowngrade = () => confirmDowngrade(targetPlan); break;
        }
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={targetPlan} isCurrent={false} onUpgrade={onUpgrade} onDowngrade={onDowngrade} bottomLabel={bottomLabel}>{personalFeatures}</PlanCard>);
    }

    // Plan card: Professional
    const professionalFeatures = <>
        <p className="truncate" title={'Everything in ' + personalPlan.name}>← Everything in {personalPlan.name}</p>
        <p className="truncate" title="8 Parallel Workspaces">✓ 8 Parallel Workspaces</p>
        <p className="truncate" title="Teams">✓ Teams</p>
    </>;

    if (currentPlan.chargebeeId === professionalPlan.chargebeeId) {
        const bottomLabel = ('pendingSince' in currentPlan) ? <p className="text-green-600 animate-pulse">Upgrade in progress</p> : undefined;
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={applyCoupons(professionalPlan, appliedCoupons)} isCurrent={true} bottomLabel={bottomLabel}>{professionalFeatures}</PlanCard>);
    } else {
        const targetPlan = applyCoupons(professionalPlan, availableCoupons);
        let bottomLabel;
        if (scheduledDowngradePlanId === targetPlan.chargebeeId) {
            bottomLabel = <p className="text-green-600">Downgrade scheduled<br/><a className="text-blue-light leading-6" href="javascript:void(0)">Cancel</a></p>;
        } else if (pendingDowngradePlan?.chargebeeId === targetPlan.chargebeeId) {
            bottomLabel = <p className="text-green-600">Downgrade scheduled</p>;
        }
        let onUpgrade, onDowngrade;
        switch (Plans.subscriptionChange(currentPlan.type, targetPlan.type)) {
            case 'upgrade': onUpgrade = () => confirmUpgrade(targetPlan); break;
            case 'downgrade': onDowngrade = () => confirmDowngrade(targetPlan); break;
        }
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={targetPlan} isCurrent={!!assignedProfessionalTs} onUpgrade={onUpgrade} onDowngrade={onDowngrade} bottomLabel={bottomLabel} isTsAssigned={!!assignedProfessionalTs}>{professionalFeatures}</PlanCard>);
    }

    // Plan card: Unleashed (or Student Unleashed)
    const unleashedFeatures = <>
        <p className="truncate" title={'Everything in ' + professionalPlan.name}>← Everything in {professionalPlan.name}</p>
        <p className="truncate" title="16 Parallel Workspaces">✓ 16 Parallel Workspaces</p>
        <p className="truncate" title="1h Timeout">✓ 1h Timeout</p>
        <p className="truncate" title="3h Timeout Boost">✓ 3h Timeout Boost</p>
    </>;
    const isUnleashedTsAssigned = !!assignedStudentUnleashedTs || !!assignedUnleashedTs;
    if (currentPlan.chargebeeId === studentUnleashedPlan.chargebeeId) {
        const bottomLabel = ('pendingSince' in currentPlan) ? <p className="text-green-600 animate-pulse">Upgrade in progress</p> : undefined;
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={applyCoupons(studentUnleashedPlan, appliedCoupons)} isCurrent={true} bottomLabel={bottomLabel} isTsAssigned={isUnleashedTsAssigned}>{unleashedFeatures}</PlanCard>);
    } else if (currentPlan.chargebeeId === unleashedPlan.chargebeeId) {
        const bottomLabel = ('pendingSince' in currentPlan) ? <p className="text-green-600 animate-pulse">Upgrade in progress</p> : undefined;
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={applyCoupons(unleashedPlan, appliedCoupons)} isCurrent={true} bottomLabel={bottomLabel} isTsAssigned={isUnleashedTsAssigned}>{unleashedFeatures}</PlanCard>);
    } else {
        const targetPlan = applyCoupons(isStudent ? studentUnleashedPlan : unleashedPlan, availableCoupons);
        let onUpgrade;
        switch (Plans.subscriptionChange(currentPlan.type, targetPlan.type)) {
            case 'upgrade': onUpgrade = () => confirmUpgrade(targetPlan); break;
        }
        planCards.push(<PlanCard isDisabled={!!assignedTs} plan={targetPlan} isCurrent={!!isUnleashedTsAssigned} onUpgrade={onUpgrade} isTsAssigned={isUnleashedTsAssigned}>{unleashedFeatures}</PlanCard>);
    }

    return <div>
        <PageWithSubMenu subMenu={settingsMenu}  title='Plans' subtitle='Manage account usage and billing.'>
            <div className="w-full text-center">
                <p className="text-xl text-gray-500">You are currently using the <span className="font-bold">{Plans.getById(assignedTs?.planId)?.name || currentPlan.name}</span> plan.</p>
                {!assignedTs && (
                    <p className="text-base w-96 m-auto">Upgrade your plan to get access to private repositories or more parallel workspaces.</p>
                )}
                <p className="mt-2 font-semibold text-gray-500">Remaining hours: {typeof(accountStatement?.remainingHours) === 'number'
                    ? Math.floor(accountStatement.remainingHours * 10) / 10
                    : accountStatement?.remainingHours}</p>
                {(typeof(accountStatement?.remainingHours) === 'number' && typeof(currentPlan.hoursPerMonth) === 'number')
                    ? <progress value={currentPlan.hoursPerMonth - accountStatement.remainingHours} max={currentPlan.hoursPerMonth} />
                    : <progress value="0" max="100" />}
                <p className="text-sm">
                    <a className={`text-blue-light hover:underline" ${isChargebeeCustomer ? '' : 'invisible'}`} href="javascript:void(0)" onClick={() => { ChargebeeClient.getOrCreate().then(chargebeeClient => chargebeeClient.openPortal()); }}>Billing</a>
                    {!!accountStatement && Plans.isFreePlan(currentPlan.chargebeeId) && <span className="pl-6">{currency === 'EUR'
                        ? <>€ / <a className="text-blue-light hover:underline" href="javascript:void(0)" onClick={() => setCurrency('USD')}>$</a></>
                        : <><a className="text-blue-light hover:underline" href="javascript:void(0)" onClick={() => setCurrency('EUR')}>€</a> / $</>}
                    </span>}
                </p>
            </div>
            <div className="mt-4 flex justify-center space-x-3 2xl:space-x-7">{planCards}</div>
            <div className="flex rounded-md w-2/3 bg-gray-200 p-4 mt-14 mx-auto">
                <img className="w-4 h-4 m-1 ml-2 mr-4" src={info} />
                <span>If you are interested in purchasing a plan for a team, purchase a Team plan with one centralized billing. <a className="underline" href="https://www.gitpod.io/docs/teams/" target="_blank">Learn more</a></span>
            </div>
            {!!confirmUpgradeToPlan && <Modal visible={true} onClose={() => setConfirmUpgradeToPlan(undefined)}>
                <h3>Upgrade to {confirmUpgradeToPlan.name}</h3>
                <div className="border-t border-b border-gray-200 mt-4 -mx-6 px-6 py-2">
                    <p className="mt-1 mb-4 text-base">You are about to upgrade to {confirmUpgradeToPlan.name}.</p>
                    {!Plans.isFreePlan(currentPlan.chargebeeId) && <div className="flex rounded-md bg-gray-200 p-4 mb-4">
                        <img className="w-4 h-4 m-1 ml-2 mr-4" src={info} />
                        <span>For this billing cycle you will be charged only the total difference ({(confirmUpgradeToPlan.currency === 'EUR' ? '€' : '$') + (confirmUpgradeToPlan.pricePerMonth - applyCoupons(currentPlan, appliedCoupons).pricePerMonth)}). The new total will be effective from the next billing cycle.</span>
                    </div>}
                    <div className="flex rounded-md bg-gitpod-kumquat-light p-4 mb-4">
                        <img className="w-4 h-4 m-1 ml-2 mr-4" src={exclamation} />
                        <span className="text-red-700">Total: {(confirmUpgradeToPlan.currency === 'EUR' ? '€' : '$') + confirmUpgradeToPlan.pricePerMonth} per month</span>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button onClick={doUpgrade}>Upgrade Plan</button>
                </div>
            </Modal>}
            {!!confirmDowngradeToPlan && <Modal visible={true} onClose={() => setConfirmDowngradeToPlan(undefined)}>
                <h3>Downgrade to {confirmDowngradeToPlan.name}</h3>
                <div className="border-t border-b border-gray-200 mt-4 -mx-6 px-6 py-2">
                    <p className="mt-1 mb-4 text-base">You are about to downgrade to {confirmDowngradeToPlan.name}.</p>
                    <div className="flex rounded-md bg-gray-200 p-4 mb-4">
                        <img className="w-4 h-4 m-1 ml-2 mr-4" src={info} />
                        {!Plans.isFreePlan(confirmDowngradeToPlan.chargebeeId)
                            ? <span>Your account will downgrade to {confirmDowngradeToPlan.name} on the next billing cycle.</span>
                            : <span>Your account will downgrade to {confirmDowngradeToPlan.name}. The remaining hours in your current plan will be available to use until the next billing cycle.</span>}
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button className="bg-red-600 border-red-800" onClick={doDowngrade}>Downgrade Plan</button>
                </div>
            </Modal>}
            {!!teamClaimModal && (<Modal visible={true} onClose={() => setTeamClaimModal(undefined)}>
                <h3 className="pb-2">Team Invitation</h3>
                <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-4">
                    <p className="pb-4 text-gray-500 text-base">{teamClaimModal.mode === "error" ? teamClaimModal.errorText : teamClaimModal.text}</p>
                </div>
                <div className="flex justify-end mt-6">
                    {teamClaimModal.mode === "confirmation" && (
                        <React.Fragment>
                            <button className="secondary" onClick={() => setTeamClaimModal(undefined)}>Cancel</button>
                            <button className={"ml-2"} onClick={async () => {
                                try {
                                    await getGitpodService().server.tsAssignSlot(teamClaimModal.teamId, teamClaimModal.slotId, undefined);
                                    window.history.replaceState({}, window.document.title, window.location.href.replace(window.location.search, ''));

                                    setTeamClaimModal(undefined);

                                    const statement = await server.getAccountStatement({});
                                    setAccountStatement(statement);
                                } catch (error) {
                                    setTeamClaimModal({
                                        mode: "error",
                                        errorText: `Error: ${error.message}`,
                                    })   
                                }
                            }}>Accept Invitation</button>
                        </React.Fragment>
                    )}
                    {teamClaimModal.mode === "error" && (
                        <button className="secondary" onClick={() => setTeamClaimModal(undefined)}>Close</button>
                    )}
                </div>
            </Modal>)}
        </PageWithSubMenu>
    </div>;
}

interface PlanCardProps {
  plan: PlanWithOriginalPrice;
  isCurrent: boolean;
  children: React.ReactNode;
  onUpgrade?: () => void;
  onDowngrade?: () => void;
  bottomLabel?: React.ReactNode;
  isDisabled?: boolean;
  isTsAssigned?: boolean;
}

function PlanCard(p: PlanCardProps) {
    return <SelectableCard className="w-44 2xl:w-56" title={p.plan.name.toUpperCase()} selected={p.isCurrent} onClick={() => {}}>
        <div className="mt-5 mb-5 flex flex-col items-center justify-center">
            <p className="text-3xl text-gray-500 font-bold">{p.plan.hoursPerMonth}</p>
            <p className="text-base text-gray-500 font-bold">hours</p>
        </div>
        <div className="flex-grow flex flex-col space-y-2">{p.children}</div>
        <div>
        <p className="text-center text-gray-500 font-semibold mb-2 mt-4">{p.plan.pricePerMonth <= 0.001
            ? 'FREE'
            : (p.plan.currency === 'EUR' ? '€' : '$') + p.plan.pricePerMonth + ' per month'
        }</p>
        {p.isCurrent
            ? <button className="w-full" disabled={true}>Current Plan</button>
            : ((p.onUpgrade && <button disabled={p.isDisabled} className="w-full secondary group-hover:bg-green-600 group-hover:text-gray-100" onClick={p.onUpgrade}>Upgrade</button>)
                || (p.onDowngrade && <button disabled={p.isDisabled} className="w-full secondary group-hover:bg-green-600 group-hover:text-gray-100" onClick={p.onDowngrade}>Downgrade</button>)
                || <button className="w-full secondary" disabled={true}>&nbsp;</button>)}
        </div>
        <div className="relative w-full">
            {p.isTsAssigned && (
                <div className="absolute w-full mt-5 text-center font-semibold">Team seat assigned</div>    
            )}
            <div className="absolute w-full mt-5 text-center font-semibold">{p.bottomLabel}</div>
        </div>
    </SelectableCard>;
}

function getLocalStorageObject(key: string): PendingPlan | undefined {
    try {
        const string = window.localStorage.getItem(key);
        if (!string) {
            return;
        }
        return JSON.parse(string);
    } catch (error) {
        return;
    }
}

function removeLocalStorageObject(key: string): void {
    window.localStorage.removeItem(key);
}

function setLocalStorageObject(key: string, object: Object): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(object));
    } catch (error) {
        console.error('Setting localstorage item failed', key, object, error);
    }
}

function applyCoupons(plan: Plan, coupons: PlanCoupon[] | undefined): PlanWithOriginalPrice {
    let coupon = (coupons || []).find(c => c.chargebeePlanID == plan.chargebeeId);
    if (!coupon) {
        return plan;
    }
    return {
        ...plan,
        pricePerMonth: coupon.newPrice || 0,
        originalPrice: plan.pricePerMonth
    }
}
