/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

export namespace Chargebee {
  // https://apidocs.chargebee.com/docs/api?lang=node#error_handling
  export interface ApiError {
    // A descriptive information about the error. This is for developer(/merchant) consumption and should not be used for showing errors to your customers.
    message: string;

    /**
     * An optional attribute which groups errors based on the error handling routine that is required. The types are payment, invalid_request and operation_failed. The client libraries throw a corresponding exception for easy error handling.
     * see: https://apidocs.chargebee.com/docs/api?lang=node#error_codes_list
     */
    type?: 'payment' | 'invalid_request' | 'operation_failed' | 'io_error' | 'client_error';

    // A more specific code allowing you to handle the specific errors.
    api_error_code: string;

    /**
     * An optional attribute which is filled if the error was due to a specific parameter. The parameter name format that is sent is based on the underlying Chargebee's REST api format which can be referred in cURL api documentation.
     * For example, in create subscription for a customer API call if the plan referred in the plan_id parameter is not present in the site, then param value set as plan_id. For 'multivalued' parameters , the index is part of the parameter name. For the same API, if the second addon id is wrongly passed then the param value is set as addons[id][2].
     * Note: For the same API customer id is part of the url. If the given customer is not present, then resource_not_found error is thrown without the param attribute.
     */
    param?: string;
  }
  export namespace ApiError {
    export const is = (e: any): e is ApiError => {
      return `message` in e && `api_error_code` in e;
    };
  }

  // APIs and params
  export interface HostedPageAPI {
    checkout_new(params: CheckoutNewParams): Requestable<HostedPage>;
    checkout_gift(params: CheckoutGiftParams): Requestable<any>;
    claim_gift(params: ClaimGiftParams): Requestable<any>;
    checkout_existing(params: CheckoutExistingParams): Requestable<any>;
  }

  export interface HostedPage {}

  export interface CheckoutGiftParams {
    redirect_url: string;
    gifter: {
      customer_id: string;
      locale?: string;
    };
    subscription: {
      plan_id: string;
      plan_quantity?: number;
      coupon?: string;
    };
    addons: {
      id?: string;
      quantity?: number;
    }[];
  }

  export interface ClaimGiftParams {
    redirect_url: string;
    gift: {
      id: string;
    };
    customer: {
      locale?: string;
    };
  }

  // https://apidocs.chargebee.com/docs/api/hosted_pages?lang=node#checkout_new_subscription
  export interface CheckoutNewParams {
    customer: {
      id?: string;
      email?: string;
    };
    subscription: {
      plan_id: string;
      plan_quantity?: number;
      coupon?: string;
    };
  }

  // https://apidocs.chargebee.com/docs/api/hosted_pages#checkout_existing_subscription
  export interface CheckoutExistingParams {
    subscription: {
      id: string;
      plan_id?: string;
      plan_quantity?: string;
    };
  }

  export interface SubscriptionUpdateParams {
    plan_id?: string;
    plan_quantity?: number;
    prorate?: boolean;
    end_of_term?: boolean;
  }

  export interface SubscriptionCancelParams {
    end_of_term?: boolean;
  }

  export interface SubscriptionAddChargeAtTermEndParams {
    /** in cents, min=1 */
    amount: number;
    description: string;
  }

  export interface SubscriptionRetrieveResult {
    subscription: Subscription;
    customer: Customer;
    card?: Card;
  }

  export interface InvoiceChargeParams {
    customer_id: string;
    subscription_id: string;
    currency_code: string;
    /** in cents, min=1 */
    amount: number;
    description?: string;
    coupon?: string;
    po_number?: string;
    payment_source_id?: string;
  }

  export interface PortalSessionAPI {
    create(params: object): Requestable<any>;
  }

  export interface Requestable<T> {
    request(callback: (error: ApiError | undefined, result: T | undefined) => void): void;
  }

  export interface SubscriptionAPI {
    list(params: {}): Requestable<ListSubscriptionResponse>;
    update(subscriptionId: string, params: SubscriptionUpdateParams): Requestable<any>;
    // https://apidocs.chargebee.com/docs/api/subscriptions#add_charge_at_term_end
    add_charge_at_term_end(subscriptionId: string, params: SubscriptionAddChargeAtTermEndParams): Requestable<any>;
    // https://apidocs.chargebee.com/docs/api/subscriptions#cancel_a_subscription
    cancel(subscriptionId: string, params: SubscriptionCancelParams): Requestable<any>;
    remove_scheduled_changes(subscriptionId: string): Requestable<{ subscription: Subscription; customer: Customer }>;
    retrieve(subscriptionId: string): Requestable<SubscriptionRetrieveResult>;
  }

  export interface GiftAPI {
    list(params: object): Requestable<any>;
  }

  export interface InvoiceAPI {
    // https://apidocs.chargebee.com/docs/api/invoices#close_a_pending_invoice
    close(invoiceId: string): Requestable<any>;
    // https://apidocs.chargebee.com/docs/api/invoices#create_invoice_for_charge
    charge(params: InvoiceChargeParams): Requestable<{ invoice: Invoice }>;

    list(params: object): Requestable<any>;
  }

  export interface CustomerAPI {
    retrieve(id: string): Requestable<{ customer: Customer; card?: Card }>;
  }

  export interface PaymentSourceAPI {
    // https://apidocs.chargebee.com/docs/api/payment_sources#list_payment_sources
    list(params: {}): Requestable<ListPaymentSourceResponse>;
  }

  // Entities
  // https://apidocs.chargebee.com/docs/api/subscriptions#subscription_attributes
  export interface Subscription {
    id: string;
    customer_id: string;
    plan_id: string;
    plan_quantity: number;
    plan_unit_price: number;
    setup_fee?: number;
    plan_amount?: number;
    /** billing frequency, corresponds to the billing_period_unit */
    billing_period?: number;
    billing_period_unit?: BillingPeriodUnit;
    plan_free_quantity?: number;
    status: SubscriptionStatus;
    started_at?: number;
    start_date?: number;
    trial_start?: number;
    trial_end?: number;
    updated_at: number;
    cancelled_at?: number;
    current_term_start?: number;
    current_term_end?: number;
    next_billing_at?: number;
    remaining_billing_cycles?: number;
    po_number?: string;
    created_at?: number;
    activated_at?: number;
    gift_id?: string;
    override_relationship?: boolean;
    pause_date?: number;
    resume_date?: number;
    cancel_reason?: CancelReason;
    affiliate_token?: string;
    created_from_ip?: string;
    resource_version: number;
    has_scheduled_changes?: boolean;
    payment_source_id?: string;
    auto_collection: AutoCollection;
    due_invoices_count?: number;
    due_since?: number;
    total_dues?: number;
    mrr?: number;
    exchange_rate?: number;
    base_currency_code?: string;
    invoice_notes?: string;
    meta_data: JsonObject;
    deleted: boolean;
    addons?: Addon[];
    event_based_addons?: EventBasedAddon[];
    charged_event_based_addons?: EventBasedAddon[];
    coupons?: CouponData[];
  }
  export type BillingPeriodUnit = 'day' | 'week' | 'month' | 'year';
  export type SubscriptionStatus = 'future' | 'in_trial' | 'active' | 'non_renewing' | 'paused' | 'cancelled';
  export type CancelReason =
    | 'not_paid'
    | 'no_card'
    | 'fraud_review_failed'
    | 'non_compliant_eu_customer'
    | 'tax_calculation_failed'
    | 'currency_incompatible_with_gateway'
    | 'non_compliant_customer';

  export interface Addon {
    // ...
  }
  export interface EventBasedAddon {
    // ...
  }
  export interface CouponData {
    /*
     * Used to uniquely identify the coupon. string, max chars=50
     */
    coupon_id: string;
    /**
     * The date till the coupon is to be applied. Applicable for "limited months" coupons.
     * optional, timestamp(UTC) in seconds
     */
    apply_till?: number;

    /*
     * Number of times this coupon has been applied for this subscription.
     */
    applied_count: number;

    /*
     * The coupon code used to redeem the coupon.
     * Will be present only when associated code for a coupon is used.
     */
    coupon_code?: string;
  }

  export namespace Invoice {
    export type Status =
      | 'paid' // Indicates a paid invoice.
      | 'posted' // Indicates the payment is not yet collected and will be in this state till the due date to indicate the due period.
      | 'payment_due' // Indicates the payment is not yet collected and is being retried as per retry settings.
      | 'not_paid' // Indicates the payment is not made and all attempts to collect is failed.
      | 'voided' // Indicates a voided invoice.
      | 'pending'; // Indicates the invoice is not closed yet. New line items can be added when the invoice is in this state.
  }

  // https://apidocs.chargebee.com/docs/api/invoices#invoice_attributes
  export interface Invoice {
    is_gifted: boolean;
    id: string; // The invoice number. Acts as a identifier for invoice and typically generated sequentially. string, max chars=50
    po_number?: string; // Purchase Order Number for this invoice. optional, string, max chars=100
    customer_id: string; // The identifier of the customer this invoice belongs to. string, max chars=50
    subscription_id?: string; // The identifier of the subscription this invoice belongs to. Note: If consolidated invoicing is enabled, to know the subscriptions attached with this invoice you have to refer line_item's subscription_id. This attribute should not be used (which will be null if this invoice has charges from multiple subscriptions). optional, string, max chars=50
    recurring: boolean; // Boolean indicating whether this invoice belongs to a subscription. boolean, default=true
    status: Invoice.Status;
    date: number;
    total: number;
  }

  // https://apidocs.chargebee.com/docs/api/customers#customer_attributes
  export interface Customer {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company?: string;
    vat_number?: string;
    auto_collection?: AutoCollection;
    /** The number of days within which the customer has to make payment for the invoice. */
    net_term_days: number;
    vat_number_validated_time?: number;
    vat_number_status?: VatNumberStatus;
    allow_direct_debit: boolean;
    is_location_valid?: boolean;
    created_at: number;
    created_from_ip?: string;
    exemption_details?: string;
    taxability?: Taxability;
    // see https://apidocs.chargebee.com/docs/api/customers#customer_entity_code for possible values
    entity_code?: string;
    exempt_number?: string;
    resource_version?: number;
    updated_at?: number;
    locale?: string;
    consolidated_invoicing?: boolean;
    billing_date?: number;
    billing_date_mode?: 'using_defaults' | 'manually_set';
    billing_day_of_week?: BillingDayOfWeek;
    billing_day_of_week_mode?: 'using_defaults' | 'manually_set';
    pii_cleared?: PiiCleared;
    fraud_flag?: FraudFlag;
    primary_payment_source_id?: string;
    backup_payment_source_id?: string;
    invoice_notes?: string;
    preferred_currency_code?: string;
    promotional_credits: number;
    unbilled_charges: number;
    refundable_credits: number;
    excess_payments: number;
    meta_data?: JsonObject;
    deleted: boolean;
    registered_for_gst?: boolean;
    business_customer_without_vat_number?: boolean;
    customer_type?: CustomerType;
    client_profile_id?: string;
    billing_address?: BillingAddress;
    referral_urls?: ReferralUrls[];
    contacts?: Contact[];
    payment_method?: PaymentMethod;
    balances?: CustomerBalance[];
    relationship?: Relationship;
    /**
     * This field is contained in all shapes from chargebee but is not documented on chargebee yet (created support ticket)
     */
    card_status: 'no_card' | 'valid'; // more values possible.
  }
  export type AutoCollection = 'on' | 'off';
  export type VatNumberStatus = 'valid' | 'invalid' | 'not_validated' | 'undetermined';
  export type Taxability = 'taxable' | 'excempt';
  export type BillingDayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  export type PiiCleared = 'active' | 'scheduled_for_clear' | 'cleared';
  export type FraudFlag = 'safe' | 'suspicious' | 'fraudulent';
  export type CustomerType = 'residential' | 'business' | 'senior_citizen' | 'industrial';
  export type JsonObject = {};

  export interface CustomerBalance {
    // ...
  }
  export interface Relationship {
    // ...
  }
  export interface BillingAddress {
    // ...
  }
  export interface ReferralUrls {
    // ...
  }
  export interface Contact {
    // ...
  }
  export type PaymentMethod = Pick<
    PaymentSource,
    'type' | 'gateway' | 'gateway_account_id' | 'status' | 'reference_id'
  >;

  export interface ListSubscriptionResponse {
    list: ListSubscriptionEntry[];

    /**
     * Contains a _string_ that is a JSONified list of page-start indeces: '[\"1517468958000\",\"175000001089\"]'
     */
    next_offset?: string;
  }
  export interface ListSubscriptionEntry {
    customer: Customer;
    subscription: Subscription;
    card?: Card;
  }

  export interface Card {
    // Cardholder's first name.
    first_name?: string;
    // Cardholder's last name.
    last_name?: string;
    // The Issuer Identification Number, i.e. the first six digits of the card number.
    iin: string;
    // Last four digits of the card number.
    last4: string;
    brand: CardBrand;
    funding_type: FundingType;
    // integer, min=1, max=12
    expiry_month: number;
    // integer
    expiry_year: number;
    billing_addr1?: string;
    billing_addr2?: string;
    billing_city?: string;
    // The ISO 3166-2 state/province code without the country prefix. Currently supported for USA, Canada and India
    billing_state_code?: string;
    billing_state?: string;
    // 2-letter ISO 3166 alpha-2 country code.
    billing_country?: string;
    billing_zip?: string;
    // Masked credit card number that is safe to show.
    masked_number?: string;
  }
  export type CardBrand = 'visa' | 'mastercard' | 'american_express' | 'discover' | 'jcb' | 'diners_club' | 'other';
  export type FundingType = 'credit' | 'debit' | 'prepaid' | 'not_known';

  export interface ListPaymentSourceResponse {
    list: { payment_source: PaymentSource }[];

    /**
     * Contains a _string_ that is a JSONified list of page-start indeces: '[\"1517468958000\",\"175000001089\"]'
     */
    next_offset?: string;
  }

  // https://apidocs.chargebee.com/docs/api/payment_sources#payment_source_id
  export interface PaymentSource {
    id: string;
    /** This is the unix timestamp (milliseconds resolution) */
    resource_version?: number;
    updated_at?: number;
    created_at: number;
    customer_id: string;
    type: PaymentSourceType;
    // value depens on PaymentSourceType
    reference_id: string;
    status: PaymentSourceStatus;
    gateway: Gateway;
    gateway_account_id?: string;
    ip_address?: string;
    issuing_country?: string;
    deleted: boolean;
    card?: Card;
    bank_account?: BankAccount;
    amazon_payment?: AmazonPayment;
    paypal?: Paypal;
  }

  export type PaymentSourceType =
    | 'card'
    | 'paypal_express_checkout'
    | 'amazon_payments'
    | 'direct_debit'
    | 'generic'
    | 'alipay'
    | 'unionpay'
    | 'apple_pay'
    | 'wechat_pay'
    | 'google_pay';
  export type PaymentSourceStatus = 'valid' | 'expiring' | 'expired' | 'invalid' | 'pending_verification';
  /** // There are a gazillion other types not listed here for brevity: https://apidocs.chargebee.com/docs/api/payment_sources#payment_source_gateway */
  export type Gateway = 'chargebee' | 'stripe';

  export interface BankAccount {
    // not relevant yet
  }
  export interface AmazonPayment {
    // not relevant yet
  }
  export interface Paypal {
    // not relevant yet
  }

  // Events
  // https://apidocs.chargebee.com/docs/api/events#event_types
  export type EventType =
    | 'subscription_created'
    | 'subscription_changed'
    | 'subscription_cancelled'
    | 'subscription_reactivated'
    | 'subscription_changes_scheduled'
    | 'subscription_scheduled_changes_removed'
    | 'payment_source_added'
    | 'payment_source_updated'
    | 'payment_source_deleted';

  export interface Event<T> {
    id: string;
    event_type: EventType;
    /** [s] */
    occurred_at: number;
    content: T;
  }

  export interface SubscriptionEventV2 {
    subscription: Subscription;
    customer: Customer;
    card: Card;
    invoice: Invoice;
  }

  export interface CardEventV2 {
    customer: Customer;
    card: Card;
  }

  export interface PaymentSourceEventV2 {
    payment_source: PaymentSource;
  }

  export interface InvoiceEventV2 {
    invoice: Invoice;
  }

  export interface CouponAPI {
    retrieve(id: string): Requestable<{ coupon: Coupon }>;
  }

  // https://apidocs.chargebee.com/docs/api/coupons
  export interface Coupon {
    addon_constraint: 'none' | 'all' | 'specific' | 'not_applicable';
    addon_ids?: string[];
    apply_discount_on: string;
    apply_on: 'invoice_amount' | 'each_specified_item';
    archived_at?: number;
    created_at: number;
    currency_code?: string;
    discount_amount?: number;
    discount_type: 'fixed_amount' | 'percentage';
    discount_percentage?: number;
    duration_type: 'one_time' | 'forever' | 'limited_period';
    duration_month?: number;
    id: string;
    invoice_name?: string;
    invoice_notes?: string;
    max_redemptions?: number;
    meta_data?: JsonObject;
    name: string;
    object: string;
    plan_constraint: 'none' | 'all' | 'specific' | 'not_applicable';
    plan_ids?: string[];
    redemptions?: number;
    resource_version?: number;
    status: 'active' | 'expired' | 'archived' | 'deleted';
    updated_at?: number;
    valid_till?: number;
  }
}
