// Re-export legacy schema for backwards compatibility
export * from "./legacy.schema";

// Export new B2B schemas - companies (no conflict with legacy)
export * from "./companies.schema";

// Export new B2B schemas with b2b prefix to avoid conflicts
export { 
  b2bUsers, 
  insertB2bUserSchema,
  type InsertB2bUser,
  type B2bUser 
} from "./users.schema";

export { userCompanies, insertUserCompanySchema, type InsertUserCompany, type UserCompany } from "./userCompanies.schema";

export {
  b2bProducts,
  insertB2bProductSchema,
  type InsertB2bProduct,
  type B2bProduct,
  unidadeMedidaEnum,
  productStatusEnum,
  disponibilidadeEnum
} from "./products.schema";

export {
  b2bOrders,
  insertB2bOrderSchema,
  type InsertB2bOrder,
  type B2bOrder,
  orderChannelEnum,
  orderStatusEnum,
  orderEtapaEnum
} from "./orders.schema";

export {
  b2bOrderItems,
  insertB2bOrderItemSchema,
  type InsertB2bOrderItem,
  type B2bOrderItem
} from "./orderItems.schema";

export {
  orderItemDiscounts,
  insertOrderItemDiscountSchema,
  type InsertOrderItemDiscount,
  type OrderItemDiscount,
  tipoDescontoEnum,
  discountStatusEnum
} from "./orderItemDiscounts.schema";

// Export enums from companies schema
export { tipoClienteEnum, approvalStatusEnum } from "./companies.schema";

// Export payment schemas
export {
  paymentTypes,
  insertPaymentTypeSchema,
  type InsertPaymentType,
  type PaymentType,
  paymentIntegrations,
  insertPaymentIntegrationSchema,
  type InsertPaymentIntegration,
  type PaymentIntegration,
  paymentTransactions,
  insertPaymentTransactionSchema,
  type InsertPaymentTransaction,
  type PaymentTransaction,
  feeTypeEnum,
  integrationStatusEnum
} from "./payments.schema";

// Export purchase/stock schemas
export {
  purchaseOrders,
  insertPurchaseOrderSchema,
  type InsertPurchaseOrder,
  type PurchaseOrder,
  purchaseOrderItems,
  insertPurchaseOrderItemSchema,
  type InsertPurchaseOrderItem,
  type PurchaseOrderItem,
  stockMovements,
  insertStockMovementSchema,
  type InsertStockMovement,
  type StockMovement
} from "./purchases.schema";

// Export plans and subscriptions schemas
export {
  plans,
  insertPlanSchema,
  type InsertPlan,
  type Plan,
  subscriptions,
  insertSubscriptionSchema,
  type InsertSubscription,
  type Subscription,
  usageMetrics,
  insertUsageMetricSchema,
  type InsertUsageMetric,
  type UsageMetric,
  planStatusEnum,
  subscriptionStatusEnum,
  billingCycleEnum,
  planLimitsSchema,
  type PlanLimits
} from "./plans.schema";
