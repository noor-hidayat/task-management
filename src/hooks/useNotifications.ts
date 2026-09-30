import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotification,
} from "@/lib/api/notifications";
import type { AppNotification } from "@/types";

export function useNotifications() {
  const [data, setData] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    listNotifications()
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`rt-notifications-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () =>
        reload()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  const markRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id);
      reload();
    },
    [reload]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    reload();
  }, [reload]);

  const remove = useCallback(
    async (id: string) => {
      await removeNotification(id);
      reload();
    },
    [reload]
  );

  return { data, loading, reload, markRead, markAllRead, remove };
}
