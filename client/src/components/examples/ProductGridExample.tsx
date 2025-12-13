import { ProductGrid } from "../ProductGrid";

const mockProducts = [
  { id: "1", name: "Industrial Bearing Set", sku: "BRG-001", category: "Machinery", brand: "TechParts", price: 149.99, stock: 25 },
  { id: "2", name: "Hydraulic Pump Motor", sku: "HYD-102", category: "Hydraulics", brand: "FlowMax", price: 599.00, stock: 8 },
  { id: "3", name: "Steel Cable 10m", sku: "CBL-203", category: "Materials", brand: "SteelCo", price: 45.50, stock: 120 },
  { id: "4", name: "Safety Valve Kit", sku: "VLV-304", category: "Safety", brand: "SafeFlow", price: 89.99, stock: 0 },
];

export default function ProductGridExample() {
  return (
    <ProductGrid
      products={mockProducts}
      onAddToCart={(p, qty) => console.log("Added:", p.name, "qty:", qty)}
    />
  );
}
