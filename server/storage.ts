import {
  b2bProducts,
  b2bUsers,
  categories,
  siteSettings,
  type B2bProduct,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, isNull, ne, or } from "drizzle-orm";
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
  checkDuplicate(
    sku: string,
    name: string,
    excludeId?: number,
  ): Promise<boolean>;
  getCategories(): Promise<any[]>;
  getSiteSetting(key: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // --- USUÁRIOS ---
  async getUser(id: string): Promise<any | undefined> {
    const [user] = await db.select().from(b2bUsers).where(eq(b2bUsers.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<any | undefined> {
    const [user] = await db
      .select()
      .from(b2bUsers)
      .where(eq(b2bUsers.email, email.toLowerCase()));
    return user;
  }

  async getUsers(): Promise<any[]> {
    const users = await db
      .select()
      .from(b2bUsers)
      .orderBy(desc(b2bUsers.createdAt));
    // Traduz do Banco (Português) para o Frontend (Inglês) para a lista funcionar
    return users.map((u) => ({
      ...u,
      company: u.razaoSocial,
      tradingName: u.nomeFantasia,
      firstName: u.nome,
      address: u.endereco,
      addressNumber: u.numero,
      neighborhood: u.bairro,
      city: u.cidade,
      state: u.estado,
      stateRegistration: u.inscricaoEstadual,
      personType: u.tipoPessoa,

      // Mantém as chaves originais também, por segurança
      razaoSocial: u.razaoSocial,
      nomeFantasia: u.nomeFantasia,
      inscricaoEstadual: u.inscricaoEstadual,
      tipoPessoa: u.tipoPessoa,
      endereco: u.endereco,
      numero: u.numero,
      bairro: u.bairro,
      cidade: u.cidade,
      estado: u.estado,
    }));
  }

  async createUser(insertUser: any): Promise<any> {
    const hashedPassword = await hashPassword(insertUser.password || "123456");

    // Mapeamento na Criação
    const [user] = await db
      .insert(b2bUsers)
      .values({
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
      })
      .returning();
    return user;
  }

  // === AQUI ESTÁ A CORREÇÃO DO ERRO 500 ===
  async updateUser(id: string, update: any): Promise<any> {
    console.log(`[UPDATE] Recebido para user ${id}:`, update);

    const dataToUpdate: any = {};
    const has = (key: string) => update[key] !== undefined;

    // TRADUTOR: Frontend (Inglês) -> Banco (Português)
    // Se o front manda 'company', salvamos em 'razaoSocial'
    if (has("company")) dataToUpdate.razaoSocial = update.company;
    if (has("razaoSocial")) dataToUpdate.razaoSocial = update.razaoSocial;

    if (has("tradingName")) dataToUpdate.nomeFantasia = update.tradingName;
    if (has("firstName")) dataToUpdate.nome = update.firstName;
    if (has("nome")) dataToUpdate.nome = update.nome;

    if (has("email")) dataToUpdate.email = update.email;
    if (has("phone")) dataToUpdate.telefone = update.phone;

    if (has("cnpj")) dataToUpdate.cnpj = update.cnpj;
    if (has("cpf")) dataToUpdate.cpf = update.cpf;
    if (has("stateRegistration"))
      dataToUpdate.inscricaoEstadual = update.stateRegistration;
    if (has("personType")) dataToUpdate.tipoPessoa = update.personType;

    // Endereço
    if (has("cep")) dataToUpdate.cep = update.cep;
    if (has("address")) dataToUpdate.endereco = update.address;
    if (has("endereco")) dataToUpdate.endereco = update.endereco;
    if (has("addressNumber")) dataToUpdate.numero = update.addressNumber;
    if (has("complement")) dataToUpdate.complemento = update.complement;
    if (has("neighborhood")) dataToUpdate.bairro = update.neighborhood;
    if (has("city")) dataToUpdate.cidade = update.city;
    if (has("state")) dataToUpdate.estado = update.state;

    // Status
    if (has("approved")) dataToUpdate.approved = update.approved;
    if (has("customerType")) dataToUpdate.customerType = update.customerType;

    // Se não sobrou nenhum campo válido, retorna sem erro
    if (Object.keys(dataToUpdate).length === 0) {
      console.log("Nada para atualizar.");
      return await this.getUser(id);
    }

    try {
      const [updated] = await db
        .update(b2bUsers)
        .set(dataToUpdate)
        .where(eq(b2bUsers.id, id))
        .returning();
      console.log("Atualizado com sucesso!");
      return updated;
    } catch (error) {
      console.error("[UPDATE ERROR]", error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(b2bUsers).where(eq(b2bUsers.id, id));
  }

  // --- PRODUTOS ---
  async getProducts(f?: any): Promise<any> {
    try {
      const page = f?.page || 1;
      const limit = f?.limit || 100;
      const offset = (page - 1) * limit;
      const activeFilter = or(
        isNull(b2bProducts.status),
        ne(b2bProducts.status, "INATIVO"),
      );

      const list = await db
        .select()
        .from(b2bProducts)
        .where(activeFilter)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(b2bProducts.id));
      const totalResult = await db
        .select({ count: count() })
        .from(b2bProducts)
        .where(activeFilter);

      const formattedProducts = list.map((p) => ({
        ...p,
        name: p.nome,
        price: p.precoVarejo,
        stock: p.estoque ?? 0,
        cost: p.precoAtacado,
        image: p.imagem,
        description: p.descricao,
      }));

      return Object.assign(formattedProducts, {
        products: formattedProducts,
        total: totalResult[0].count,
        page,
        totalPages: Math.ceil(totalResult[0].count / limit),
      });
    } catch (error) {
      console.error("[STORAGE ERROR]", error);
      return [];
    }
  }

  async checkDuplicate(
    sku: string,
    name: string,
    excludeId?: number,
  ): Promise<boolean> {
    let condition = and(
      or(eq(b2bProducts.sku, sku), eq(b2bProducts.nome, name)),
      ne(b2bProducts.status, "INATIVO"),
    );
    if (excludeId) condition = and(condition, ne(b2bProducts.id, excludeId));
    const [existing] = await db
      .select()
      .from(b2bProducts)
      .where(condition)
      .limit(1);
    return !!existing;
  }

  async createProduct(insert: any): Promise<B2bProduct> {
    const [p] = await db
      .insert(b2bProducts)
      .values({
        nome: insert.nome || "Sem Nome",
        sku: insert.sku || `SKU-${Date.now()}`,
        unidadeMedida: insert.unidadeMedida || "UN",
        precoVarejo: String(insert.precoVarejo || 0),
        precoAtacado: String(insert.precoAtacado || 0),
        estoque: insert.stock ?? 0,
        descricao: insert.descricao,
        imagem: insert.imagem,
        status: "ATIVO",
      })
      .returning();
    return p;
  }

  async getCategories() {
    return db.select().from(categories);
  }
  async getSiteSetting(key: string) {
    const [s] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key));
    return s;
  }
}

export const storage = new DatabaseStorage();
