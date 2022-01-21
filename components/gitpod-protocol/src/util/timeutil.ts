/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * Returns the <code>day</code>th of the next month from <code>formDate</code>.
 * If the next month does not have a <code>day</code>th, the last day of that
 * month is taken.
 * The time is copied from <code>fromDate</code>.
 *
 * @param fromDate
 * @param day
 */
export function oneMonthLater(fromDate: string, day?: number): string {
  const later = new Date(fromDate);
  day = day || later.getDate();
  const fromMonth = later.getMonth();
  later.setDate(day);
  later.setMonth(later.getMonth() + 1);
  if (later.getMonth() - fromMonth > 1) {
    later.setDate(0);
  }
  return later.toISOString();
}
export const yearsLater = (fromDate: string, years: number): string =>
  liftDate1(fromDate, (d) => {
    d.setUTCFullYear(d.getUTCFullYear() + years);
    return d.toISOString();
  });

// tslint:disable-next-line:no-shadowed-variable
export const addMillis = (d1: string, millis: number) =>
  liftDate1(d1, (d1) => new Date(d1.getTime() + millis).toISOString());
export const durationInHours = (d1: string, d2: string) =>
  liftDate(d1, d2, (d1, d2) => millisecondsToHours(d1.getTime() - d2.getTime()));
export const durationInMillis = (d1: string, d2: string) => liftDate(d1, d2, (d1, d2) => d1.getTime() - d2.getTime());
// tslint:disable-next-line:no-shadowed-variable
export const isDateGreaterOrEqual = (d1: string, d2: string): boolean =>
  liftDate(d1, d2, (d1, d2) => d1.getTime() >= d2.getTime());
export const isDateSmallerOrEqual = (d1: string, d2: string | undefined) => !d2 || d1 <= d2;
export const isDateSmaller = (d1: string, d2: string | undefined) => !d2 || d1 < d2;
export const oldest = (d1: string, d2: string): string => (d1 > d2 ? d1 : d2);
export const earliest = (d1: string, d2: string): string => (d1 < d2 ? d1 : d2);
export const orderAsc = (d1: string, d2: string): number => liftDate(d1, d2, (d1, d2) => d1.getTime() - d2.getTime());
export const liftDate1 = <T>(d1: string, f: (d1: Date) => T): T => f(new Date(d1));
export const liftDate = <T>(d1: string, d2: string, f: (d1: Date, d2: Date) => T): T => f(new Date(d1), new Date(d2));

export function hoursLater(date: string, hours: number): string {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result.toISOString();
}

export function secondsBefore(date: string, seconds: number): string {
  return new Date(new Date(date).getTime() - seconds * 1000).toISOString();
}

export function rightAfter(date: string): string {
  return new Date(new Date(date).getTime() + 1).toISOString();
}

export function rightBefore(date: string): string {
  return new Date(new Date(date).getTime() - 1).toISOString();
}

export function millisecondsToHours(milliseconds: number): number {
  return milliseconds / 1000 / 60 / 60;
}

export function hoursToMilliseconds(hours: number): number {
  return hours * 60 * 60 * 1000;
}
