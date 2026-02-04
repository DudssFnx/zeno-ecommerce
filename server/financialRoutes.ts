import type { InsertPaymentTerm } from "@shared/schema";
import { type Express, type Response } from "express";
import { db } from "./db";
import {
  cancelPayable,
  createPayableFromPurchaseOrder,
  getPayableDashboard,
  getPayableWithDetails,
  listPayables,
  recordPayablePayment,
  reopenPayable,
  updateOverduePayables,
} from "./services/payables.service";
import {
  createPaymentTerm,
  deletePaymentTerm,
  getPaymentTerm,
  listActivePaymentTerms,
  listPaymentTerms,
  updatePaymentTerm,
} from "./services/paymentTerms.service";
import {
  cancelReceivable,
  createReceivableFromOrder,
  getReceivableDashboard,
  getReceivableWithDetails,
  listReceivables,
  recordReceivablePayment,
  reopenReceivable,
  updateOverdueReceivables,
} from "./services/receivables.service";

/**
 * Registrar rotas financeiras
 */
export function registerFinancialRoutes(app: Express): void {
  // ==========================================
  // 💳 CONDIÇÕES DE PAGAMENTO
  // ==========================================

  /**
   * GET /api/payment-terms - Listar todas as condições de pagamento
   */
  app.get("/api/payment-terms", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const terms = await listPaymentTerms(companyId);

      res.json(terms);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * GET /api/payment-terms/active - Listar condições ativas
   */
  app.get("/api/payment-terms/active", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const terms = await listActivePaymentTerms(companyId);

      res.json(terms);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * GET /api/payment-terms/:id - Obter condição de pagamento
   */
  app.get("/api/payment-terms/:id", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const term = await getPaymentTerm(parseInt(id));

      if (!term)
        return res.status(404).json({ message: "Condição não encontrada" });

      res.json(term);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * POST /api/payment-terms - Criar condição de pagamento
   */
  app.post("/api/payment-terms", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const data: InsertPaymentTerm = {
        companyId,
        ...req.body,
      };

      const term = await createPaymentTerm(data);
      res.status(201).json(term);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * PUT /api/payment-terms/:id - Atualizar condição de pagamento
   */
  app.put("/api/payment-terms/:id", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const term = await updatePaymentTerm(parseInt(id), req.body);

      if (!term)
        return res.status(404).json({ message: "Condição não encontrada" });

      res.json(term);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * DELETE /api/payment-terms/:id - Deletar condição de pagamento
   */
  app.delete("/api/payment-terms/:id", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const term = await deletePaymentTerm(parseInt(id));

      if (!term)
        return res.status(404).json({ message: "Condição não encontrada" });

      res.json({ message: "Condição deletada com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // 📊 CONTAS A RECEBER
  // ==========================================

  /**
   * GET /api/receivables - Listar contas a receber
   */
  app.get("/api/receivables", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const { status, customerId, isOverdue } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (customerId) filters.customerId = customerId;
      if (isOverdue !== undefined) filters.isOverdue = isOverdue === "true";

      const receivables = await listReceivables(companyId, filters);
      res.json(receivables);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * GET /api/receivables/dashboard - Dashboard de contas a receber
   */
  app.get("/api/receivables/dashboard", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const dashboard = await getReceivableDashboard(companyId);

      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * GET /api/receivables/:id - Obter conta a receber com detalhes
   */
  app.get("/api/receivables/:id", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const receivable = await getReceivableWithDetails(parseInt(id));

      if (!receivable)
        return res.status(404).json({ message: "Conta não encontrada" });

      res.json(receivable);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * POST /api/receivables/from-order/:orderId - Criar conta a receber a partir de pedido
   */
  app.post(
    "/api/receivables/from-order/:orderId",
    async (req: any, res: Response) => {
      try {
        if (!req.isAuthenticated())
          return res.status(401).json({ message: "Não autenticado" });

        const companyId = req.user.company;
        const { orderId } = req.params;

        const receivable = await createReceivableFromOrder(
          parseInt(orderId),
          companyId,
        );

        if (!receivable)
          return res.status(400).json({
            message: "Pedido não é do tipo prazo ou não foi encontrado",
          });

        res.status(201).json(receivable);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  /**
   * POST /api/receivables/:id/payment - Registrar pagamento de receivable
   */
  app.post("/api/receivables/:id/payment", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const { id } = req.params;
      const paymentData = {
        ...req.body,
        receivedBy: req.user.firstName || req.user.id,
      };

      const payment = await recordReceivablePayment(
        parseInt(id),
        companyId,
        paymentData,
      );

      res.status(201).json(payment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * POST /api/receivables/:id/cancel - Cancelar conta a receber
   */
  app.post("/api/receivables/:id/cancel", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const { reason } = req.body;

      const cancelled = await cancelReceivable(
        parseInt(id),
        reason,
        req.user.firstName || req.user.id,
      );

      res.json(cancelled);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * POST /api/receivables/:id/reopen - Reabrir conta a receber
   */
  app.post("/api/receivables/:id/reopen", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const reopened = await reopenReceivable(parseInt(id));

      res.json(reopened);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // 📊 CONTAS A PAGAR
  // ==========================================

  /**
   * GET /api/payables - Listar contas a pagar
   */
  app.get("/api/payables", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const { status, supplierId, isOverdue } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (supplierId) filters.supplierId = supplierId;
      if (isOverdue !== undefined) filters.isOverdue = isOverdue === "true";

      const payables = await listPayables(companyId, filters);
      res.json(payables);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * GET /api/payables/dashboard - Dashboard de contas a pagar
   */
  app.get("/api/payables/dashboard", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const dashboard = await getPayableDashboard(companyId);

      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * GET /api/payables/:id - Obter conta a pagar com detalhes
   */
  app.get("/api/payables/:id", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const payable = await getPayableWithDetails(parseInt(id));

      if (!payable)
        return res.status(404).json({ message: "Conta não encontrada" });

      res.json(payable);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * POST /api/payables/from-purchase/:purchaseOrderId - Criar conta a pagar a partir de compra
   */
  app.post(
    "/api/payables/from-purchase/:purchaseOrderId",
    async (req: any, res: Response) => {
      try {
        if (!req.isAuthenticated())
          return res.status(401).json({ message: "Não autenticado" });

        const companyId = req.user.company;
        const { purchaseOrderId } = req.params;

        const payable = await createPayableFromPurchaseOrder(
          parseInt(purchaseOrderId),
          companyId,
        );

        if (!payable)
          return res.status(400).json({
            message: "Pedido não é do tipo prazo ou não foi encontrado",
          });

        res.status(201).json(payable);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  /**
   * POST /api/payables/:id/payment - Registrar pagamento de payable
   */
  app.post("/api/payables/:id/payment", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const companyId = req.user.company;
      const { id } = req.params;
      const paymentData = {
        ...req.body,
        paidBy: req.user.firstName || req.user.id,
      };

      const payment = await recordPayablePayment(
        parseInt(id),
        companyId,
        paymentData,
      );

      res.status(201).json(payment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * POST /api/payables/:id/cancel - Cancelar conta a pagar
   */
  app.post("/api/payables/:id/cancel", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const { reason } = req.body;

      const cancelled = await cancelPayable(
        parseInt(id),
        reason,
        req.user.firstName || req.user.id,
      );

      res.json(cancelled);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  /**
   * POST /api/payables/:id/reopen - Reabrir conta a pagar
   */
  app.post("/api/payables/:id/reopen", async (req: any, res: Response) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const { id } = req.params;
      const reopened = await reopenPayable(parseInt(id));

      res.json(reopened);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // 🔄 MANUTENÇÃO (Jobs)
  // ==========================================

  /**
   * POST /api/financial/update-overdue - Atualizar status de vencidas
   */
  app.post("/api/financial/update-overdue", async (req: any, res: Response) => {
    try {
      // Apenas admin pode executar
      const [user] = await db
        .select()
        .from((await import("@shared/schema")).users)
        .where((u) => u.id === (req.isAuthenticated() ? req.user?.id : null));

      if (!user || user.role !== "admin")
        return res.status(403).json({ message: "Acesso negado" });

      // Executar atualização
      await updateOverdueReceivables();
      await updateOverduePayables();

      res.json({ message: "Status de vencidas atualizado com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
