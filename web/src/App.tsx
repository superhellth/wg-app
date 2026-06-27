import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api.js";

export function App() {
  const { data: members, isLoading, isError } = useQuery({
    queryKey: ["members"],
    queryFn: api.listMembers,
  });

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">WG App</Typography>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Mitbewohner
        </Typography>
        {isLoading && <Typography>Lädt…</Typography>}
        {isError && (
          <Typography color="error">
            API nicht erreichbar (läuft der Server?)
          </Typography>
        )}
        <List>
          {members?.map((m) => (
            <ListItem key={m.id} divider>
              <ListItemText primary={m.displayName} />
            </ListItem>
          ))}
        </List>
      </Container>
    </Box>
  );
}
