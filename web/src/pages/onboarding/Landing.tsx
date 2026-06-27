import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router-dom";
import { OnboardingLayout } from "../../app/OnboardingLayout.js";

export function Landing() {
  const navigate = useNavigate();
  return (
    <OnboardingLayout>
      <Stack spacing={1.5}>
        <Typography variant="h2" sx={{ lineHeight: 1.05 }}>
          Eure WG,
          <br />
          organisiert.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Putzplan, Geld, Einkauf und Termine — an einem Ort. Ohne Zettel am
          Kühlschrank.
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        <Button variant="contained" size="large" onClick={() => navigate("/erstellen")}>
          WG erstellen
        </Button>
        <Button variant="outlined" size="large" onClick={() => navigate("/beitreten")}>
          Einer WG beitreten
        </Button>
      </Stack>
    </OnboardingLayout>
  );
}
