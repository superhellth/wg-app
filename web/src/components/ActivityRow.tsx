import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Activity } from "@wg/shared";
import { useMembersMap } from "../api/members.js";
import { useMemberColor } from "../theme/useMemberColor.js";
import { activityText } from "../lib/activityText.js";
import { fromNow } from "../lib/format.js";

/** One feed entry: a colored left-bar = who, the predicate, and relative time. */
export function ActivityRow({ item }: { item: Activity }) {
  const color = useMemberColor(item.memberId);
  const members = useMembersMap();
  const name = item.memberId
    ? (members.get(item.memberId)?.displayName ?? "Jemand")
    : "System";

  return (
    <Box sx={{ display: "flex", gap: 1.5, py: 1.25 }}>
      <Box
        sx={{
          flex: "0 0 auto",
          width: 4,
          borderRadius: 2,
          bgcolor: color.main,
          alignSelf: "stretch",
        }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
          <Box component="span" sx={{ fontWeight: 700, color: color.ink }}>
            {name}
          </Box>{" "}
          {activityText(item)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {fromNow(item.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
}
