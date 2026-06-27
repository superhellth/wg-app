import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Member } from "@wg/shared";
import dayjs from "dayjs";
import { useState } from "react";
import {
  useAddMember,
  useArchiveMember,
  useMembers,
  useRestoreMember,
  useUpdateMember,
} from "../api/members.js";
import { useCreateInvite } from "../api/invites.js";
import { AddFab } from "../components/Fab.js";
import { MemberAvatar } from "../components/MemberAvatar.js";

export function Mitbewohner() {
  const [showArchived, setShowArchived] = useState(false);
  const members = useMembers(showArchived);
  const add = useAddMember();
  const update = useUpdateMember();
  const archive = useArchiveMember();
  const restore = useRestoreMember();
  const invite = useCreateInvite();

  const [menu, setMenu] = useState<{ el: HTMLElement; member: Member } | null>(null);
  const [nameDialog, setNameDialog] = useState<Member | "new" | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const createInvite = () =>
    invite.mutate(undefined, {
      onSuccess: (inv) => setInviteUrl(`${window.location.origin}/join/${inv.token}`),
    });

  const isAway = (m: Member) => m.awayUntil && dayjs(m.awayUntil).isAfter(dayjs());

  return (
    <Box sx={{ p: 2 }}>
      <Button
        variant="contained"
        startIcon={<PersonAddRoundedIcon />}
        fullWidth
        sx={{ mb: 2 }}
        onClick={createInvite}
        disabled={invite.isPending}
      >
        Einladungslink erstellen
      </Button>

      <FormControlLabel
        control={<Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />}
        label="Ehemalige anzeigen"
        sx={{ mb: 1 }}
      />

      <Card sx={{ px: 1 }}>
        {(members.data ?? []).map((m, i) => (
          <Stack
            key={m.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{
              py: 1,
              borderTop: i === 0 ? "none" : "1px solid",
              borderColor: "divider",
              opacity: m.archivedAt ? 0.5 : 1,
            }}
          >
            <MemberAvatar memberId={m.id} />
            <Typography sx={{ flex: 1, fontWeight: 600 }}>{m.displayName}</Typography>
            {isAway(m) && <Chip label="Abwesend" size="small" color="warning" />}
            {m.archivedAt && <Chip label="Ehemalig" size="small" />}
            <IconButton size="small" onClick={(e) => setMenu({ el: e.currentTarget, member: m })}>
              <MoreVertRoundedIcon />
            </IconButton>
          </Stack>
        ))}
      </Card>

      {/* row menu */}
      <Menu anchorEl={menu?.el} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) setNameDialog(menu.member);
            setMenu(null);
          }}
        >
          Namen ändern
        </MenuItem>
        {menu?.member.archivedAt ? (
          <MenuItem
            onClick={() => {
              if (menu) restore.mutate(menu.member.id);
              setMenu(null);
            }}
          >
            Zurückholen
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              if (menu) archive.mutate(menu.member.id);
              setMenu(null);
            }}
          >
            Entfernen
          </MenuItem>
        )}
      </Menu>

      <AddFab label="Mitbewohner hinzufügen" onClick={() => setNameDialog("new")} />

      {nameDialog && (
        <NameDialog
          value={nameDialog}
          onClose={() => setNameDialog(null)}
          onSave={(name) => {
            if (nameDialog === "new") add.mutate({ displayName: name });
            else update.mutate({ id: nameDialog.id, body: { displayName: name } });
            setNameDialog(null);
          }}
        />
      )}

      <InviteDialog url={inviteUrl} onClose={() => setInviteUrl(null)} />
    </Box>
  );
}

function NameDialog({
  value,
  onClose,
  onSave,
}: {
  value: Member | "new";
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(value === "new" ? "" : value.displayName);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{value === "new" ? "Mitbewohner hinzufügen" : "Namen ändern"}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function InviteDialog({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "WG-Einladung", url });
        return;
      } catch {
        /* fell through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Einladungslink</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Gültig für 24 Stunden, mehrfach verwendbar.
        </DialogContentText>
        <TextField
          value={url}
          fullWidth
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={share}>
                  <ContentCopyRoundedIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {copied && (
          <Typography variant="caption" color="success.main">
            Kopiert!
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
        <Button variant="contained" onClick={share}>Teilen</Button>
      </DialogActions>
    </Dialog>
  );
}
