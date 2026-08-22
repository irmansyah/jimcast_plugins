```bash
jimcast plugin command "@kanban list-boards"
jimcast plugin command "@kanban new-board {\"name\":\"Q3 Goals\"}"
jimcast plugin command "@kanban delete-board {\"boardId\":\"b1\"}"
jimcast plugin command "@kanban new-card {\"boardId\":\"b1\",\"columnId\":\"todo\",\"title\":\"Buy milk\"}"
jimcast plugin command "@kanban delete-card {\"boardId\":\"b1\",\"cardId\":\"<card-id>\"}"
jimcast plugin command "@kanban move-card {\"boardId\":\"b1\",\"cardId\":\"<card-id>\",\"toColumnId\":\"done\"}"
jimcast plugin command "@kanban rename-card {\"boardId\":\"b1\",\"cardId\":\"<card-id>\",\"title\":\"New title\"}"
```
