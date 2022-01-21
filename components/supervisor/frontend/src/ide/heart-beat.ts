/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

let lastActivity = 0;
const updateLastActivitiy = () => {
  lastActivity = new Date().getTime();
};
export const track = (w: Window) => {
  w.document.addEventListener('mousemove', updateLastActivitiy, { capture: true });
  w.document.addEventListener('keydown', updateLastActivitiy, { capture: true });
};

let intervalHandle: NodeJS.Timer | undefined;
export function schedule(instanceId: string): void {
  if (intervalHandle !== undefined) {
    return;
  }
  const sendHeartBeat = async (wasClosed?: true) => {
    try {
      await window.gitpod.service.server.sendHeartBeat({ instanceId, wasClosed });
    } catch (err) {
      console.error('Failed to send hearbeat:', err);
    }
  };
  sendHeartBeat();
  window.addEventListener(
    'beforeunload',
    () => {
      sendHeartBeat(true);
    },
    { once: true },
  );

  let activityInterval = 30000;
  intervalHandle = setInterval(() => {
    // add an additional random value between 5 and 15 seconds
    const randomInterval = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
    if (lastActivity + activityInterval + randomInterval < new Date().getTime()) {
      // no activity, no heartbeat
      return;
    }
    sendHeartBeat();
  }, activityInterval);
}

export const cancel = () => {
  if (intervalHandle !== undefined) {
    clearInterval(intervalHandle);
    intervalHandle = undefined;
  }
};
