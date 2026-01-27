import {
  b2bProducts,
  b2bUsers,
  b2bOrders,
  b2bOrderItems,
  categories,
  siteSettings,
  type B2bProduct,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "./db";

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export interface IStorage {
  getUser(id: string): Promise<any | undefined>;
  getUserByEmail(email: string): Promise<any | undefined>;
  getUsers(): Promise<any[]>;
  createUser(insert: any): Promise<any>;
  updateUser(id: string, update: any): Promise<any>;
  deleteUser(id: string): Promise<void>;
  
  getProducts(f?: any): Promise<any>;
  createProduct(insert: any): Promise<B2bProduct>;
  checkDuplicate(sku: string, name: string, excludeId?: number): Promise<boolean>;
  
  getCategories(): Promise<any[]>;
  getSiteSetting(key: string): Promise<any>;

  getOrders(): Promise<any[]>;
  createOrder(data: any): Promise<any>;
  getOrder(id: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // --- USUÁRIOS ---
  async getUser(id: string): Promise<any | undefined> {
    const [user] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<any | undefined> {
    const [user] = await db.select().from(b2bUsers).where(eq(b2bUsers.email, email.toLowerCase()));
    return user;
  }

  async getUsers(): Promise<any[]> {
    const users = await db.select().from(b2bUsers).orderBy(desc(b2bUsers.createdAt));
    return users.map((u) => ({
      ...u,
      company: u.razaoSocial,
      tradingName: u.nomeFantasia,
      firstName: u.nome,
      address: u.endereco,
      razaoSocial: u.razaoSocial,
      nomeFantasia: u.nomeFantasia,
    }));
  }

  async createUser(insertUser: any): Promise<any> {
    const hashedPassword = await hashPassword(insertUser.password || "123456");
    const [user] = await db.insert(b2bUsers).values({
        nome: insertUser.firstName || insertUser.username || insertUser.email,
        email: insertUser.username || insertUser.email,
        senhaHash: hashedPassword,
        role: insertUser.role || "customer",
        telefone: insertUser.phone,
        ativo: true,
        razaoSocial: insertUser.company,
        nomeFantasia: insertUser.tradingName,
        cnpj: insertUser.cnpj,
        cpf: insertUser.cpf,
        inscricaoEstadual: insertUser.stateRegistration,
        tipoPessoa: insertUser.personType,
        cep: insertUser.cep,
        endereco: insertUser.address,
        numero: insertUser.addressNumber,
        complemento: insertUser.complement,
        bairro: insertUser.neighborhood,
        cidade: insertUser.city,
        estado: insertUser.state,
        approved: false,
        customerType: "varejo",
      }).returning();
    return user;
  }

  async updateUser(id: string, update: any): Promise<any> {
    const dataToUpdate: any = {};
    const has = (key: string) => update[key] !== undefined;

    // Dados básicos
    if (has("company")) dataToUpdate.razaoSocial = update.company;
    if (has("razaoSocial")) dataToUpdate.razaoSocial = update.razaoSocial;
    if (has("firstName")) dataToUpdate.nome = update.firstName;
    if (has("nome")) dataToUpdate.nome = update.nome;
    if (has("email")) dataToUpdate.email = update.email;
    if (has("phone")) dataToUpdate.telefone = update.phone;
    if (has("telefone")) dataToUpdate.telefone = update.telefone;
    
    // Dados fiscais
    if (has("cnpj")) dataToUpdate.cnpj = update.cnpj;
    if (has("cpf")) dataToUpdate.cpf = update.cpf;
    
    // Controle
    if (has("approved")) dataToUpdate.approved = update.approved;
    if (has("role")) dataToUpdate.role = update.role;
    if (has("customerType")) dataToUpdate.customerType = update.customerType;
    if (has("modules")) dataToUpdate.modules = update.modules;

    // --- LÓGICA DE SENHA (NOVO) ---
    if (has("password") && update.password && update.password.trim() !== "") {
        // Importante: hashPassword já deve estar importada ou definida no topo deste arquivo
        dataToUpdate.senhaHash = await hashPassword(update.password);
    }

    if (Object.keys(dataToUpdate).length === 0) return await this.getUser(id);

    const [updated] = await db.update(b2bUsers).set(dataToUpdate).where(eq(b2bUsers.id, id)).returning();
    return updated;
  }

  // --- CORREÇÃO AQUI: Delete Robusto ---
  async deleteUser(id: string): Promise<void> {
    console.log(`[STORAGE] Tentando deletar usuário ${id} e suas dependências...`);
    
    // Tenta limpar tabelas vinculadas conhecidas via SQL puro para evitar erros de Constraint
    try {
        // Remove vínculos com empresas (se a tabela existir)
        await db.execute(sql`DELETE FROM user_companies WHERE user_id = ${id}`);
        // Remove pedidos criados pelo usuário
        await db.execute(sql`DELETE FROM b2b_orders WHERE user_id = ${id}`);
        // Remove descontos solicitados (se houver)
        await db.execute(sql`DELETE FROM order_item_discounts WHERE solicitado_por_user_id = ${id}`);
    } catch (error) {
        console.warn("[STORAGE] Aviso ao limpar dependências (pode ser ignorado se tabela não existir):", error);
    }

    // Finalmente deleta o usuário
    await db.delete(b2bUsers).where(eq(b2bUsers.id, id));
    console.log(`[STORAGE] Usuário ${id} deletado.`);
  }

  // --- PRODUTOS ---
  async getProducts(f?: any): Promise<any> {
    try {
      const page = f?.page ? parseInt(f.page) : 1;
      const limit = f?.limit ? parseInt(f.limit) : 50;
      const offset = (page - 1) * limit;

      const activeFilter = or(isNull(b2bProducts.status), ne(b2bProducts.status, "INATIVO"));

      let searchFilter = undefined;
      if ((f?.q && f.q.trim() !== "") || (f?.search && f.search.trim() !== "")) {
        const term = (f.q || f.search).toLowerCase().trim();
        searchFilter = or(
          sql`lower(${b2bProducts.nome}) LIKE ${`%${term}%`}`,
          sql`lower(${b2bProducts.sku}) LIKE ${`%${term}%`}`
        );
      }

      const finalFilter = searchFilter ? and(activeFilter, searchFilter) : activeFilter;

      const list = await db.select().from(b2bProducts).where(finalFilter!).limit(limit).offset(offset).orderBy(desc(b2bProducts.id));
      const totalResult = await db.select({ count: count() }).from(b2bProducts).where(finalFilter!);

      const formattedProducts = list.map((p) => ({
        ...p,
        name: p.nome,
        price: p.precoVarejo,
        stock: p.estoque ?? 0,
        cost: p.precoAtacado,
        image: p.imagem,
        description: p.descricao,
        sku: p.sku
      }));

      return {
        products: formattedProducts,
        total: totalResult[0]?.count || 0,
        page,
        totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
      };
    } catch (error) {
      console.error("[STORAGE ERROR] getProducts:", error);
      return { products: [], total: 0 };
    }
  }

  async checkDuplicate(sku: string, name: string, excludeId?: number): Promise<boolean> {
    let condition = and(or(eq(b2bProducts.sku, sku), eq(b2bProducts.nome, name)), ne(b2bProducts.status, "INATIVO"));
    if (excludeId) condition = and(condition, ne(b2bProducts.id, excludeId));
    const [existing] = await db.select().from(b2bProducts).where(condition).limit(1);
    return !!existing;
  }

  async createProduct(insert: any): Promise<B2bProduct> {
    const [p] = await db.insert(b2bProducts).values({
        nome: insert.nome || "Sem Nome",
        sku: insert.sku || `SKU-${Date.now()}`,
        unidadeMedida: insert.unidadeMedida || "UN",
        precoVarejo: String(insert.precoVarejo || 0),
        precoAtacado: String(insert.precoAtacado || 0),
        estoque: insert.stock ?? 0,
        descricao: insert.descricao,
        imagem: insert.imagem,
        status: "ATIVO",
      }).returning();
    return p;
  }

  // --- PEDIDOS B2B ---
  async getOrders(): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: b2bOrders.id,
          orderNumber: b2bOrders.orderNumber,
          total: b2bOrders.total,
          status: b2bOrders.status,
          createdAt: b2bOrders.createdAt,
          userId: b2bOrders.userId,
          customerName: b2bUsers.nome,
          customerCompany: b2bUsers.razaoSocial,
        })
        .from(b2bOrders)
        .leftJoin(b2bUsers, eq(b2bOrders.userId, b2bUsers.id))
        .orderBy(desc(b2bOrders.createdAt));

      const ordersWithDetails = await Promise.all(result.map(async (order) => {
         const items = await db.select().from(b2bOrderItems).where(eq(b2bOrderItems.orderId, order.id));
         return {
           ...order,
           customerName: order.customerName || "Cliente Desconhecido",
           items: items, 
           itemCount: items.length,
           user_id: order.userId
         };
      }));

      return ordersWithDetails;
    } catch (error) {
      console.error("[STORAGE] getOrders Error:", error);
      return [];
    }
  }

  async createOrder(data: any): Promise<any> {
    const orderNum = `PED-${Date.now().toString().slice(-6)}`;
    let totalCalculado = 0;
    const itemsToInsert = [];

    if (data.items && data.items.length > 0) {
        for (const item of data.items) {
            const [product] = await db.select().from(b2bProducts).where(eq(b2bProducts.id, item.productId));
            const price = item.unitPrice || (product ? Number(product.precoVarejo) : 0);
            const subtotal = price * item.quantity;
            totalCalculado += subtotal;
            
            itemsToInsert.push({
                productId: item.productId,
                quantity: item.quantity,
                sku: product?.sku || "SKU-DESC",
                precoLista: String(price),
                precoUnitario: String(price),
                subtotal: String(subtotal)
            });
        }
    }

    const [newOrder] = await db.insert(b2bOrders).values({
      orderNumber: orderNum,
      userId: data.userId, 
      status: "ORCAMENTO",
      total: String(totalCalculado),
      notes: data.notes
    }).returning();

    for (const item of itemsToInsert) {
        await db.insert(b2bOrderItems).values({
            orderId: newOrder.id,
            productId: item.productId,
            sku: item.sku,
            quantidade: item.quantity,
            price: item.precoUnitario,
            discount: "0"
        });
    }

    return newOrder;
  }

  async getOrder(id: number): Promise<any> {
    const [order] = await db.select().from(b2bOrders).where(eq(b2bOrders.id, id));
    if (!order) return null;

    const items = await db
      .select({
        id: b2bOrderItems.id,
        quantity: b2bOrderItems.quantity,
        price: b2bOrderItems.price,
        productId: b2bOrderItems.productId,
        product: b2bProducts
      })
      .from(b2bOrderItems)
      .leftJoin(b2bProducts, eq(b2bOrderItems.productId, b2bProducts.id))
      .where(eq(b2bOrderItems.orderId, id));

    const [customer] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, order.userId));

    return {
      ...order,
      userId: order.userId, 
      items: items.map(i => ({
        ...i,
        product: {
            ...i.product,
            name: i.product?.nome,
            sku: i.product?.sku,
            image: i.product?.imagem
        }
      })),
      customer: customer ? {
          ...customer,
          firstName: customer.nome,
          company: customer.razaoSocial,
          email: customer.email,
          phone: customer.telefone,
          address: customer.endereco,
      } : null
    };
  }

  async getCategories() {
    return db.select().from(categories);
  }
  async getSiteSetting(key: string) {
    const [s] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return s;
  }
}

export const storage = new DatabaseStorage();