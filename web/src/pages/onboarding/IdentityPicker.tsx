import AddRoundedIcon from "@mui/icons-material/AddRounded";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setMemberId } from "../../api/identity.js";
import { useAddMember, useMembers } from "../../api/members.js";
import { MemberAvatar } from "../../components/MemberAvatar.js";
import { OnboardingLayout } from "../../app/OnboardingLayout.js";

export function IdentityPicker() {
  const navigate = useNavigate();
  const { data: members, isLoading } = useMembers();
  const addMember = useAddMember();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const pick = (id: string) => {
    setMemberId(id);
    navigate("/", { replace: true });
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const member = await addMember.mutateAsync({ displayName: name });
    pick(member.id);
  };

  return (
    <OnboardingLayout>
      <Stack spacing={1}>
        <Typography variant="h3">Wer bist du?</Typography>
        <Typography variant="body2" color="text.secondary">
          Wähle deinen Namen aus der Liste. Du kannst jederzeit wechseln.
        </Typography>
      </Stack>

      {isLoading ? (
        <CircularProgress sx={{ alignSelf: "center" }} />
      ) : (
        <List disablePadding>
          {(members ?? []).map((m) => (
            <ListItemButton key={m.id} onClick={() => pick(m.id)} sx={{ mb: 0.5 }}>
              <ListItemAvatar>
                <MemberAvatar memberId={m.id} />
              </ListItemAvatar>
              <ListItemText primary={m.displayName} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          ))}
          {members?.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              Noch keine Mitbewohner. Leg dich als Erste:r an.
            </Typography>
          )}
        </List>
      )}

      <Divider />

      {adding ? (
        <Stack
          component="form"
          spacing={1.5}
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdd();
          }}
        >
          <TextField
            label="Dein Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!newName.trim() || addMember.isPending}
          >
            {addMember.isPending ? "Wird angelegt…" : "Hinzufügen & loslegen"}
          </Button>
        </Stack>
      ) : (
        <Button startIcon={<AddRoundedIcon />} onClick={() => setAdding(true)}>
          Mitbewohner hinzufügen
        </Button>
      )}
    </OnboardingLayout>
  );
}
