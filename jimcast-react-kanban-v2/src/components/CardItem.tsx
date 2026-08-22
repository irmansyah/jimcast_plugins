import type { Card } from "../types";

export function CardItem({
  card,
  focused,
  deletePending,
  onClick,
}: {
  card: Card;
  focused: boolean;
  deletePending: boolean;
  onClick: () => void;
}) {
  const classes = ["card", focused && "focused", deletePending && "delete-pending"].filter(Boolean).join(" ");
  return (
    <div className={classes} onClick={onClick}>
      {deletePending ? `Delete "${card.title}"? y/n` : card.title}
    </div>
  );
}
