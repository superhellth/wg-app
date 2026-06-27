import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { setWgToken } from "../../api/identity.js";
import { wgApi } from "../../api/wg.js";
import { OnboardingLayout } from "../../app/OnboardingLayout.js";

/** Pull the token out of a pasted invite link or accept a raw token. */
function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/join\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]!) : trimmed;
}

export function Join() {
  const { token: paramToken } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState("");

  const redeem = useMutation({
    mutationFn: (token: string) => wgApi.redeem(token),
    onSuccess: (res) => {
      setWgToken(res.wgToken);
      navigate("/wer-bin-ich", { replace: true });
    },
  });

  useEffect(() => {
    if (paramToken) redeem.mutate(paramToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramToken]);

  // Auto-redeem path (opened via invite link).
  if (paramToken) {
    return (
      <OnboardingLayout>
        <Stack spacing={2} alignItems="center" sx={{ textAlign: "center" }}>
          {redeem.isError ? (
            <>
              <Typography variant="h4">Link ungültig</Typography>
              <Typography variant="body2" color="text.secondary">
                Dieser Einladungslink ist abgelaufen oder falsch. Bitte einen neuen
                anfragen.
              </Typography>
              <Button variant="contained" onClick={() => navigate("/willkommen")}>
                Zurück
              </Button>
            </>
          ) : (
            <>
              <CircularProgress />
              <Typography color="text.secondary">Tritt der WG bei…</Typography>
            </>
          )}
        </Stack>
      </OnboardingLayout>
    );
  }

  // Manual paste path.
  return (
    <OnboardingLayout>
      <Stack spacing={1}>
        <Typography variant="h3">WG beitreten</Typography>
        <Typography variant="body2" color="text.secondary">
          Füge den Einladungslink ein, den du von einem Mitbewohner bekommen hast.
        </Typography>
      </Stack>

      <Stack
        component="form"
        spacing={2}
        onSubmit={(e) => {
          e.preventDefault();
          const t = extractToken(input);
          if (t) redeem.mutate(t);
        }}
      >
        <TextField
          label="Einladungslink"
          placeholder="https://…/join/…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          fullWidth
        />
        {redeem.isError && (
          <Alert severity="error">Link ungültig oder abgelaufen.</Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!input.trim() || redeem.isPending}
        >
          {redeem.isPending ? "Beitreten…" : "Beitreten"}
        </Button>
        <Button onClick={() => navigate("/willkommen")}>Zurück</Button>
      </Stack>
    </OnboardingLayout>
  );
}
