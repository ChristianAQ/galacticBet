import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import {
  preferenceStore,
  PREFERENCES_KEY,
  resolveSelectedGroup,
} from "./preferences";

export function usePreferences(uid: string) {
  const value = useSyncExternalStore(preferenceStore.subscribe, () =>
    preferenceStore.get(uid),
  );
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === PREFERENCES_KEY || event.key === null)
        preferenceStore.refresh();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  return value;
}
export function useGroupSelection(uid: string, groups: { id: string }[]) {
  const preferences = usePreferences(uid);
  const [params, setParams] = useSearchParams();
  const groupId = resolveSelectedGroup(
    groups,
    params.get("group"),
    preferences.groupId,
  );
  useEffect(() => {
    if (groupId && uid) preferenceStore.update(uid, { groupId });
  }, [uid, groupId]);
  function selectGroup(id: string) {
    if (!groups.some((g) => g.id === id)) return;
    preferenceStore.update(uid, { groupId: id });
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("group", id);
        return next;
      },
      { replace: true },
    );
  }
  return { groupId, selectGroup, preferences };
}
