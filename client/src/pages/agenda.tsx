import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Pencil,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  StickyNote,
  Users,
  ListTodo,
  Bell,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AgendaEvent } from "@shared/schema";

const eventTypes = [
  { value: "note", label: "Anotacao", icon: StickyNote, color: "bg-blue-500" },
  { value: "meeting", label: "Reuniao", icon: Users, color: "bg-purple-500" },
  { value: "task", label: "Tarefa", icon: ListTodo, color: "bg-green-500" },
  { value: "reminder", label: "Lembrete", icon: Bell, color: "bg-orange-500" },
];

export default function AgendaPage() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    type: "note",
  });

  const startDate = startOfMonth(currentMonth);
  const endDate = endOfMonth(currentMonth);

  const { data: events = [], isLoading, refetch } = useQuery<AgendaEvent[]>({
    queryKey: ["/api/agenda", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      const res = await fetch(`/api/agenda?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/agenda", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
      toast({ title: "Evento criado com sucesso" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erro ao criar evento", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PATCH", `/api/agenda/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
      toast({ title: "Evento atualizado com sucesso" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar evento", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/agenda/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
      toast({ title: "Evento excluido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir evento", variant: "destructive" });
    },
  });

  const toggleCompleted = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) => 
      apiRequest("PATCH", `/api/agenda/${id}`, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agenda"] });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
    setFormData({ title: "", description: "", date: "", time: "", type: "note" });
  };

  const openCreateDialog = (date?: Date) => {
    setFormData({
      title: "",
      description: "",
      date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      time: "",
      type: "note",
    });
    setEditingEvent(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (event: AgendaEvent) => {
    try {
      const eventDate = event.date ? new Date(event.date) : new Date();
      const formattedDate = !isNaN(eventDate.getTime()) ? format(eventDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      setFormData({
        title: event.title,
        description: event.description || "",
        date: formattedDate,
        time: event.time || "",
        type: event.type,
      });
      setEditingEvent(event);
      setIsDialogOpen(true);
    } catch {
      toast({ title: "Erro ao carregar evento", variant: "destructive" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date) {
      toast({ title: "Preencha o titulo e a data", variant: "destructive" });
      return;
    }

    const eventData = {
      title: formData.title,
      description: formData.description || null,
      date: formData.date,
      time: formData.time || null,
      type: formData.type,
    };

    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data: eventData });
    } else {
      createEventMutation.mutate(eventData);
    }
  };

  const getDaysInMonth = () => {
    const days = [];
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    const startDayOfWeek = start.getDay();
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    let current = start;
    while (current <= end) {
      days.push(new Date(current));
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      try {
        const eventDate = event.date ? new Date(event.date) : null;
        if (!eventDate || isNaN(eventDate.getTime())) return false;
        return isSameDay(eventDate, date);
      } catch {
        return false;
      }
    });
  };

  const getTypeConfig = (type: string) => {
    return eventTypes.find(t => t.value === type) || eventTypes[0];
  };

  const days = getDaysInMonth();
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Agenda</h1>
          <p className="text-muted-foreground">Gerencie seus compromissos e anotacoes</p>
        </div>
        <Button onClick={() => openCreateDialog()} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <Button variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
          Anterior
        </Button>
        <h2 className="text-xl font-semibold">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
          Proximo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-3">
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
                {days.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="p-2 min-h-[100px]" />;
                  }
                  const dayEvents = getEventsForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 min-h-[100px] border rounded-lg cursor-pointer transition-colors hover-elevate ${
                        isToday ? "bg-primary/10 border-primary" : "border-border"
                      } ${isSelected ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setSelectedDate(day)}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const typeConfig = getTypeConfig(event.type);
                          return (
                            <div
                              key={event.id}
                              className={`text-xs p-1 rounded truncate ${typeConfig.color} text-white ${event.completed ? "opacity-50 line-through" : ""}`}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} mais</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDate && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full" 
                    onClick={() => openCreateDialog(selectedDate)}
                    data-testid="button-add-event-selected-date"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar evento
                  </Button>
                  
                  {getEventsForDate(selectedDate).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum evento para este dia
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {getEventsForDate(selectedDate).map((event) => {
                        const typeConfig = getTypeConfig(event.type);
                        const TypeIcon = typeConfig.icon;
                        return (
                          <div
                            key={event.id}
                            className={`p-3 rounded-lg border ${event.completed ? "opacity-60" : ""}`}
                            data-testid={`event-card-${event.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => toggleCompleted.mutate({ id: event.id, completed: !event.completed })}
                                className="mt-0.5"
                                data-testid={`button-toggle-complete-${event.id}`}
                              >
                                {event.completed ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${event.completed ? "line-through" : ""}`}>
                                  {event.title}
                                </p>
                                {event.time && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <Clock className="h-3 w-3" />
                                    {event.time}
                                  </p>
                                )}
                                {event.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {event.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                  <TypeIcon className="h-3 w-3 mr-1" />
                                  {typeConfig.label}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 mt-2 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(event)}
                                data-testid={`button-edit-event-${event.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => deleteEventMutation.mutate(event.id)}
                                data-testid={`button-delete-event-${event.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              
              {!selectedDate && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Clique em um dia no calendario para ver os eventos
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titulo</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Digite o titulo do evento"
                data-testid="input-event-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descricao opcional"
                data-testid="input-event-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  data-testid="input-event-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  data-testid="input-event-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createEventMutation.isPending || updateEventMutation.isPending}
                data-testid="button-save-event"
              >
                {(createEventMutation.isPending || updateEventMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingEvent ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
