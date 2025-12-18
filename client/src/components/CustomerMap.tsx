import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface CustomerLocation {
  userId: string;
  name: string;
  company?: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
}

const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];

const STATE_COORDS: Record<string, [number, number]> = {
  AC: [-9.0238, -70.8120],
  AL: [-9.5713, -36.7819],
  AP: [1.4102, -51.7769],
  AM: [-3.4168, -65.8561],
  BA: [-12.5797, -41.7007],
  CE: [-5.4984, -39.3206],
  DF: [-15.7998, -47.8645],
  ES: [-19.1834, -40.3089],
  GO: [-15.8270, -49.8362],
  MA: [-4.9609, -45.2744],
  MT: [-12.6819, -56.9211],
  MS: [-20.7722, -54.7852],
  MG: [-18.5122, -44.5550],
  PA: [-3.4168, -52.2170],
  PB: [-7.2399, -36.7819],
  PR: [-24.8946, -51.5546],
  PE: [-8.8137, -36.9541],
  PI: [-7.7183, -42.7289],
  RJ: [-22.2587, -42.6592],
  RN: [-5.8126, -36.5630],
  RS: [-30.0346, -51.2177],
  RO: [-10.8304, -63.3447],
  RR: [2.7376, -62.0751],
  SC: [-27.2423, -50.2189],
  SP: [-22.1937, -48.7934],
  SE: [-10.5741, -37.3857],
  TO: [-10.1753, -48.2982],
};

const CITY_COORDS: Record<string, [number, number]> = {
  "sao paulo": [-23.5505, -46.6333],
  "rio de janeiro": [-22.9068, -43.1729],
  "belo horizonte": [-19.9167, -43.9345],
  "brasilia": [-15.7942, -47.8822],
  "salvador": [-12.9714, -38.5014],
  "fortaleza": [-3.7172, -38.5433],
  "curitiba": [-25.4284, -49.2733],
  "manaus": [-3.1190, -60.0217],
  "recife": [-8.0476, -34.8770],
  "porto alegre": [-30.0346, -51.2177],
  "belem": [-1.4558, -48.4902],
  "goiania": [-16.6864, -49.2643],
  "guarulhos": [-23.4538, -46.5333],
  "campinas": [-22.9053, -47.0659],
  "sao luis": [-2.5387, -44.2825],
  "maceio": [-9.6498, -35.7089],
  "natal": [-5.7945, -35.2110],
  "campo grande": [-20.4697, -54.6201],
  "teresina": [-5.0892, -42.8019],
  "joao pessoa": [-7.1195, -34.8450],
  "aracaju": [-10.9472, -37.0731],
  "cuiaba": [-15.6014, -56.0979],
  "florianopolis": [-27.5969, -48.5495],
  "vitoria": [-20.3155, -40.3128],
  "londrina": [-23.3045, -51.1696],
  "santo andre": [-23.6737, -46.5432],
  "osasco": [-23.5329, -46.7917],
  "ribeirao preto": [-21.1775, -47.8103],
  "sorocaba": [-23.5015, -47.4526],
  "joinville": [-26.3045, -48.8487],
  "maringa": [-23.4273, -51.9375],
  "santos": [-23.9608, -46.3336],
  "sao jose dos campos": [-23.2237, -45.9009],
  "uberlandia": [-18.9186, -48.2772],
  "piracicaba": [-22.7338, -47.6476],
  "juiz de fora": [-21.7642, -43.3497],
  "sao jose do rio preto": [-20.8113, -49.3758],
  "contagem": [-19.9318, -44.0539],
  "feira de santana": [-12.2500, -38.9667],
  "bauru": [-22.3246, -49.0871],
  "caxias do sul": [-29.1634, -51.1797],
  "pelotas": [-31.7654, -52.3376],
  "canoas": [-29.9178, -51.1839],
  "blumenau": [-26.9194, -49.0661],
  "franca": [-20.5396, -47.4008],
};

function getCoordinates(city?: string, state?: string): [number, number] | null {
  if (city) {
    const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (CITY_COORDS[normalizedCity]) {
      const [lat, lng] = CITY_COORDS[normalizedCity];
      return [lat + (Math.random() - 0.5) * 0.05, lng + (Math.random() - 0.5) * 0.05];
    }
  }
  if (state) {
    const normalizedState = state.toUpperCase().trim();
    if (STATE_COORDS[normalizedState]) {
      const [lat, lng] = STATE_COORDS[normalizedState];
      return [lat + (Math.random() - 0.5) * 0.5, lng + (Math.random() - 0.5) * 0.5];
    }
  }
  return null;
}

export function CustomerMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { data: usersData = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const customerLocations: CustomerLocation[] = usersData
    .filter((u) => u.role === "customer" && (u.city || u.state))
    .map((u) => {
      const coords = getCoordinates(u.city || undefined, u.state || undefined);
      if (!coords) return null;
      return {
        userId: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Cliente",
        company: u.company || undefined,
        city: u.city || undefined,
        state: u.state || undefined,
        lat: coords[0],
        lng: coords[1],
      };
    })
    .filter(Boolean) as CustomerLocation[];

  const customersWithLocation = customerLocations.length;
  const totalCustomers = usersData.filter((u) => u.role === "customer").length;

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      center: BRAZIL_CENTER,
      zoom: 4,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    leafletMapRef.current = map;
    setMapReady(true);

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current || !mapReady) return;

    leafletMapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        leafletMapRef.current?.removeLayer(layer);
      }
    });

    customerLocations.forEach((customer) => {
      const marker = L.marker([customer.lat, customer.lng]).addTo(leafletMapRef.current!);
      marker.bindPopup(`
        <div style="min-width: 150px;">
          <strong>${customer.name}</strong>
          ${customer.company ? `<br/><span style="color: #666;">${customer.company}</span>` : ""}
          <br/>
          <span style="font-size: 12px; color: #888;">
            ${customer.city || ""}${customer.city && customer.state ? ", " : ""}${customer.state || ""}
          </span>
        </div>
      `);
    });

    if (customerLocations.length > 0) {
      const bounds = L.latLngBounds(customerLocations.map((c) => [c.lat, c.lng]));
      leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [customerLocations, mapReady]);

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-primary" />
          Mapa de Clientes
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {customersWithLocation} de {totalCustomers} clientes no mapa
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div
            ref={mapRef}
            className="h-[400px] rounded-lg border"
            style={{ zIndex: 0 }}
            data-testid="customer-map"
          />
        )}
        {!isLoading && customersWithLocation === 0 && (
          <p className="text-center text-muted-foreground mt-4">
            Nenhum cliente com endereco cadastrado. Adicione cidade e estado nos cadastros dos clientes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
