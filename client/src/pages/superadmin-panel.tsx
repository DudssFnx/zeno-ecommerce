import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
// Tipo mínimo para usuário (funcionário)
interface User {
  id: string;
  // ...adicione outros campos conforme necessário
}

function SuperadminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const { data, isLoading, isError } = useQuery<User, Error>(
    ["user"],
    () => axios.get("/user").then((res) => res.data),
    {
      enabled: true,
    },
  );

  useEffect(() => {
    setUser(data);
  }, [data]);

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (isError) {
    return <div>Erro ao carregar usuário</div>;
  }

  return (
    <div>
      <h1>Superadmin Panel</h1>
      <p>Olá, {user?.name}!</p>
      <p>Id: {user?.id}</p>
    </div>
  );
}

export default SuperadminPanel;
