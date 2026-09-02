"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ConnectionState = "live" | "reconnecting" | "offline";

export type BoardStatus = {

  connection: ConnectionState | null;

  freshAt: Date;
};

type Store = BoardStatus & {
  report: (next: Partial<BoardStatus>) => void;
};

const BoardStatusContext = createContext<Store | null>(null);

const IDLE: BoardStatus = { connection: null, freshAt: new Date(0) };

export function BoardStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BoardStatus>(IDLE);

  const report = useCallback(
    (next: Partial<BoardStatus>) => setStatus((prev) => ({ ...prev, ...next })),
    [],
  );

  const value = useMemo(() => ({ ...status, report }), [status, report]);

  return (
    <BoardStatusContext.Provider value={value}>
      {children}
    </BoardStatusContext.Provider>
  );
}

export function useBoardStatus(): BoardStatus {
  return useContext(BoardStatusContext) ?? IDLE;
}

export function useReportBoardStatus(): Store["report"] {
  return useContext(BoardStatusContext)?.report ?? noop;
}

function noop() {}
