import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import { useActivityFeed } from "../api/activity.js";
import { ActivityRow } from "../components/ActivityRow.js";
import { EmptyState } from "../components/EmptyState.js";

export function Aktivitaet() {
  const feed = useActivityFeed();
  const items = feed.data?.pages.flat() ?? [];

  if (!feed.isLoading && items.length === 0) {
    return <EmptyState title="Noch nichts passiert" hint="Aktivitäten erscheinen hier." />;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Card sx={{ px: 2 }}>
        {items.map((a, i) => (
          <Box
            key={a.id}
            sx={{ borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider" }}
          >
            <ActivityRow item={a} />
          </Box>
        ))}
      </Card>
      {feed.hasNextPage && (
        <Button
          fullWidth
          sx={{ mt: 2 }}
          onClick={() => feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
        >
          {feed.isFetchingNextPage ? "Lädt…" : "Mehr laden"}
        </Button>
      )}
    </Box>
  );
}
