import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setWgToken } from "../../api/identity.js";
import { wgApi } from "../../api/wg.js";
import { ApiError } from "../../api/client.js";
import { OnboardingLayout } from "../../app/OnboardingLayout.js";

export function CreateWg() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => wgApi.create({ name: name.trim() }),
    onSuccess: (res) => {
      setWgToken(res.wgToken);
      navigate("/wer-bin-ich", { replace: true });
    },
  });

  const conflict = create.error instanceof ApiError && create.error.code === "conflict";

  return (
    <OnboardingLayout>
      <Stack spacing={1}>
        <Typography variant="h3">Neue WG</Typography>
        <Typography variant="body2" color="text.secondary">
          Gib eurer WG einen Namen. Danach kannst du Mitbewohner hinzufügen und
          einladen.
        </Typography>
      </Stack>

      <Stack
        component="form"
        spacing={2}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <TextField
          label="Name der WG"
          placeholder="z. B. Sonnenallee 12"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          fullWidth
        />
        {conflict && (
          <Alert severity="info">
            Es gibt schon eine WG. Nutze stattdessen einen Einladungslink.
          </Alert>
        )}
        {create.isError && !conflict && (
          <Alert severity="error">Konnte nicht erstellt werden. Nochmal versuchen?</Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!name.trim() || create.isPending}
        >
          {create.isPending ? "Wird erstellt…" : "WG erstellen"}
        </Button>
        <Button onClick={() => navigate("/willkommen")}>Zurück</Button>
      </Stack>
    </OnboardingLayout>
  );
}
