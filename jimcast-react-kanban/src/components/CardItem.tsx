// [plugins] jimcast-react-kanban/src/components/CardItem.tsx
//
// onDoubleClick added: lets ColumnView.tsx trigger inline rename on a
// double-click, without ColumnView needing to render its own duplicate
// card markup just to attach the handler. Optional — CardModal.tsx
// (rendered via editingCardId/openFocusedCard) presumably has its own
// rename path too, so this stays additive rather than required.

import type { Card } from "../types";

export function CardItem({
  card,
  focused,
  deletePending,
  onClick,
  onDoubleClick,
}: {
  card: Card;
  focused: boolean;
  deletePending: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}) {
  const classes = ["card", focused && "focused", deletePending && "delete-pending"].filter(Boolean).join(" ");
  return (
    <div className={classes} onClick={onClick} onDoubleClick={onDoubleClick}>
      {deletePending ? `Delete "${card.title}"? y/n` : card.title}
    </div>
  );
}
