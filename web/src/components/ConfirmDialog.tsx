import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** color of the confirm button — "error" for destructive actions */
  confirmColor?: "primary" | "error";
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * App-level replacement for window.confirm — renders a single MUI dialog and
 * resolves a promise with the user's choice. Keeps call sites terse:
 *   if (!(await confirm({ title: "…?", confirmColor: "error" }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback<Confirm>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(opts)} onClose={() => close(false)} fullWidth maxWidth="xs">
        {opts && (
          <>
            <DialogTitle>{opts.title}</DialogTitle>
            {opts.body && (
              <DialogContent>
                <DialogContentText>{opts.body}</DialogContentText>
              </DialogContent>
            )}
            <DialogActions>
              <Button onClick={() => close(false)} color="inherit">
                {opts.cancelLabel ?? "Abbrechen"}
              </Button>
              <Button
                onClick={() => close(true)}
                variant="contained"
                color={opts.confirmColor ?? "primary"}
                autoFocus
              >
                {opts.confirmLabel ?? "Bestätigen"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
