import { useState, useEffect, useCallback } from "react";
import type { FilterState } from "@/components/advanced-filter";

export interface FilterPreset {
  id: string;
  name: string;
  filter: FilterState;
  createdAt: number;
}

function storageKey(namespace: string) {
  return `filter-presets:${namespace}`;
}

export function useFilterPresets(namespace: string) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(namespace));
    if (raw) {
      try {
        setPresets(JSON.parse(raw));
      } catch {
        setPresets([]);
      }
    }
  }, [namespace]);

  const save = useCallback(
    (name: string, filter: FilterState) => {
      const preset: FilterPreset = {
        id: Math.random().toString(36).slice(2, 11),
        name,
        filter,
        createdAt: Date.now(),
      };
      const next = [...presets, preset];
      setPresets(next);
      localStorage.setItem(storageKey(namespace), JSON.stringify(next));
      return preset;
    },
    [namespace, presets]
  );

  const remove = useCallback(
    (id: string) => {
      const next = presets.filter((p) => p.id !== id);
      setPresets(next);
      localStorage.setItem(storageKey(namespace), JSON.stringify(next));
    },
    [namespace, presets]
  );

  const load = useCallback(
    (id: string) => {
      return presets.find((p) => p.id === id);
    },
    [presets]
  );

  return { presets, save, remove, load };
}
