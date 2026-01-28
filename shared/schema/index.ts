// Re-export legacy schema for backwards compatibility
export * from "./legacy.schema";

// Export new B2B schemas - companies (no conflict with legacy)
export * from "./companies.schema";
// Export new B2B schemas with b2b prefix to avoid conflicts
export {
  b2bUsers,
  insertB2bUserSchema,
  type B2bUser,
  type InsertB2bUser,
} from "./users.schema";

export {
  insertUserCompanySchema,
  userCompanies,
  type InsertUserCompany,
  type UserCompany,
} from "./userCompanies.schema";

export {
  b2bProducts,
  disponibilidadeEnum,
  insertB2bProductSchema,
  productStatusEnum,
  unidadeMedidaEnum,
  type B2bProduct,
  type InsertB2bProduct,
} from "./products.schema";

export {
  b2bOrders,
  insertB2bOrderSchema,
  orderChannelEnum,
  orderEtapaEnum,
  orderStatusEnum,
  type B2bOrder,
  type InsertB2bOrder,
} from "./orders.schema";

export {
  b2bOrderItems,
  insertB2bOrderItemSchema,
  type B2bOrderItem,
  type InsertB2bOrderItem,
} from "./orderItems.schema";

export {
  discountStatusEnum,
  insertOrderItemDiscountSchema,
  orderItemDiscounts,
  tipoDescontoEnum,
  type InsertOrderItemDiscount,
  type OrderItemDiscount,
} from "./orderItemDiscounts.schema";

// Export enums from companies schema
export { approvalStatusEnum, tipoClienteEnum } from "./companies.schema";

// Export payment schemas
export {
  feeTypeEnum,
  insertPaymentIntegrationSchema,
  insertPaymentTransactionSchema,
  insertPaymentTypeSchema,
  integrationStatusEnum,
  paymentIntegrations,
  paymentTransactions,
  paymentTypes,
  type InsertPaymentIntegration,
  type InsertPaymentTransaction,
  type InsertPaymentType,
  type PaymentIntegration,
  type PaymentTransaction,
  type PaymentType,
} from "./payments.schema";

// Export purchase/stock schemas
export {
  insertPurchaseOrderItemSchema,
  insertPurchaseOrderSchema,
  insertStockMovementSchema,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
  type InsertPurchaseOrder,
  type InsertPurchaseOrderItem,
  type InsertStockMovement,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type StockMovement,
} from "./purchases.schema";

// Export plans and subscriptions schemas
export {
  billingCycleEnum,
  insertPlanSchema,
  insertSubscriptionSchema,
  insertUsageMetricSchema,
  planLimitsSchema,
  plans,
  planStatusEnum,
  subscriptions,
  subscriptionStatusEnum,
  usageMetrics,
  type InsertPlan,
  type InsertSubscription,
  type InsertUsageMetric,
  type Plan,
  type PlanLimits,
  type Subscription,
  type UsageMetric,
} from "./plans.schema";
