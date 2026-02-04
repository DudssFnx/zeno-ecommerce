/**
 * Financial helpers para operações comuns
 * - Cálculos de juros e multas
 * - Formatação de moeda
 * - Validações financeiras
 */

export interface FinancialCalculation {
  amount: number;
  interest: number;
  fine: number;
  total: number;
}

/**
 * Calcular juros compostos mensais
 * @param amount Valor principal
 * @param monthlyInterestRate Taxa mensal (ex: 2 = 2%)
 * @param monthsOverdue Meses em atraso
 */
export function calculateMonthlyInterest(
  amount: number,
  monthlyInterestRate: number,
  monthsOverdue: number,
): number {
  const rate = monthlyInterestRate / 100;
  const interest = amount * (Math.pow(1 + rate, monthsOverdue) - 1);
  return Math.round(interest * 100) / 100;
}

/**
 * Calcular multa por atraso
 * @param amount Valor principal
 * @param finePercent Percentual de multa (ex: 2 = 2%)
 */
export function calculateLateFine(amount: number, finePercent: number): number {
  const fine = amount * (finePercent / 100);
  return Math.round(fine * 100) / 100;
}

/**
 * Calcular dias em atraso
 * @param dueDate Data de vencimento (YYYY-MM-DD)
 * @param referenceDate Data de referência (default: hoje)
 */
export function calculateDaysOverdue(
  dueDate: string,
  referenceDate: string = new Date().toISOString().split("T")[0],
): number {
  const due = new Date(dueDate);
  const ref = new Date(referenceDate);

  const diff = ref.getTime() - due.getTime();
  const daysOverdue = Math.floor(diff / (1000 * 60 * 60 * 24));

  return Math.max(0, daysOverdue);
}

/**
 * Calcular meses em atraso
 * @param dueDate Data de vencimento (YYYY-MM-DD)
 * @param referenceDate Data de referência (default: hoje)
 */
export function calculateMonthsOverdue(
  dueDate: string,
  referenceDate: string = new Date().toISOString().split("T")[0],
): number {
  const due = new Date(dueDate);
  const ref = new Date(referenceDate);

  const months =
    (ref.getFullYear() - due.getFullYear()) * 12 +
    (ref.getMonth() - due.getMonth());

  return Math.max(0, months);
}

/**
 * Calcular total com juros e multa
 */
export function calculateFinancialTotal(
  amount: number,
  monthlyInterestRate: number,
  finePercent: number,
  daysOverdue: number,
): FinancialCalculation {
  const monthsOverdue = Math.ceil(daysOverdue / 30);

  const interest =
    monthsOverdue > 0
      ? calculateMonthlyInterest(amount, monthlyInterestRate, monthsOverdue)
      : 0;

  const fine = monthsOverdue > 0 ? calculateLateFine(amount, finePercent) : 0;

  return {
    amount,
    interest,
    fine,
    total: amount + interest + fine,
  };
}

/**
 * Formatar valor monetário
 */
export function formatCurrency(
  amount: number | string,
  locale: string = "pt-BR",
): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formatar percentual
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Validar se valores são válidos
 */
export function isValidAmount(amount: unknown): boolean {
  if (typeof amount !== "number" && typeof amount !== "string") return false;

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return !isNaN(num) && num >= 0;
}

/**
 * Validar data
 */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Comparar datas
 */
export function compareDates(date1: string, date2: string): -1 | 0 | 1 {
  if (date1 < date2) return -1;
  if (date1 > date2) return 1;
  return 0;
}

/**
 * Verificar se está vencido
 */
export function isOverdue(
  dueDate: string,
  referenceDate: string = new Date().toISOString().split("T")[0],
): boolean {
  return dueDate < referenceDate;
}

/**
 * Calcular próximo vencimento em sequência
 */
export function getNextDueDate(
  lastDueDate: string,
  intervalDays: number,
): string {
  const date = new Date(lastDueDate);
  date.setDate(date.getDate() + intervalDays);

  return date.toISOString().split("T")[0];
}

/**
 * Gerar série de vencimentos para parcelamento
 * @param startDate Data do primeiro vencimento (YYYY-MM-DD)
 * @param installmentCount Quantidade de parcelas
 * @param intervalDays Intervalo entre parcelas
 */
export function generateInstallmentDates(
  startDate: string,
  installmentCount: number,
  intervalDays: number,
): string[] {
  const dates: string[] = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < installmentCount; i++) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + intervalDays);
  }

  return dates;
}

/**
 * Calcular valor de cada parcela
 * @param totalAmount Valor total a parcelar
 * @param installmentCount Quantidade de parcelas
 * @param precision Casas decimais (default: 2)
 */
export function calculateInstallmentAmount(
  totalAmount: number,
  installmentCount: number,
  precision: number = 2,
): number {
  const baseAmount = totalAmount / installmentCount;
  return (
    Math.round(baseAmount * Math.pow(10, precision)) / Math.pow(10, precision)
  );
}

/**
 * Agrupar pagamentos por status
 */
export interface PaymentGrouping {
  paid: number;
  partial: number;
  pending: number;
  cancelled: number;
}

export function groupPaymentsByStatus(
  items: Array<{ status: string; amount: number }>,
): PaymentGrouping {
  return items.reduce(
    (acc, item) => {
      switch (item.status) {
        case "PAGA":
          acc.paid += item.amount;
          break;
        case "PARCIAL":
          acc.partial += item.amount;
          break;
        case "ABERTA":
        case "VENCIDA":
          acc.pending += item.amount;
          break;
        case "CANCELADA":
          acc.cancelled += item.amount;
          break;
      }
      return acc;
    },
    { paid: 0, partial: 0, pending: 0, cancelled: 0 },
  );
}

/**
 * Calcular idade do documento (dias desde emissão)
 */
export function calculateDocumentAge(issueDate: string): number {
  const issue = new Date(issueDate);
  const today = new Date();

  const diff = today.getTime() - issue.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Determinar status baseado em datas e valores
 */
export function determineStatus(
  amount: number,
  amountPaid: number,
  dueDate: string,
  isCancelled: boolean = false,
): string {
  if (isCancelled) return "CANCELADA";

  if (amountPaid >= amount) return "PAGA";

  if (amountPaid > 0 && amountPaid < amount) return "PARCIAL";

  const today = new Date().toISOString().split("T")[0];
  if (dueDate < today) return "VENCIDA";

  return "ABERTA";
}
