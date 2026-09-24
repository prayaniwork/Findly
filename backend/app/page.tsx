import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import WorksWheelDemo from "@/components/ui/demo";

export default async function Page() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: todos } = await supabase.from("todos").select();

  return (
    <main className="min-h-screen w-full bg-background flex flex-col">
      {todos && todos.length > 0 && (
        <div className="p-4 bg-muted/60 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Supabase Connection Active:
          </p>
          <ul className="text-sm space-y-1">
            {todos.map((todo: any) => (
              <li key={todo.id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{todo.name || todo.title || JSON.stringify(todo)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex-1">
        <WorksWheelDemo />
      </div>
    </main>
  );
}
