import {
  cancelReceivablesByOrderId,
  getReceivableWithDetails,
} from "../services/receivables.service";

async function main() {
  const orderId = parseInt(process.argv[2] || "12");
  const companyId = process.argv[3] || "1";
  console.log(
    `Cancelando receivables do pedido ${orderId} para empresa ${companyId}...`,
  );
  const cancelled = await cancelReceivablesByOrderId(
    orderId,
    "Teste estorno via script",
    "Script",
    companyId,
  );
  console.log(`Cancelados: ${cancelled.length}`);

  // Inspecionar receivables
  for (const r of cancelled) {
    const details = await getReceivableWithDetails(r.id);
    console.log(
      `Receivable ${r.id} status=${details?.status} installments=${details?.installments.length}`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
