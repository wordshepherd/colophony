interface IssueItemsSummaryProps {
  items: Array<{ issueSectionId: string | null }>;
  sections: Array<{ id: string; title: string }>;
}

export function IssueItemsSummary({ items, sections }: IssueItemsSummaryProps) {
  const unsectionedCount = items.filter((i) => !i.issueSectionId).length;

  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className="font-medium">{items.length}</span>{" "}
        {items.length === 1 ? "item" : "items"} total
      </p>
      {sections.map((section) => {
        const count = items.filter(
          (i) => i.issueSectionId === section.id,
        ).length;
        return (
          <p key={section.id} className="text-muted-foreground">
            {section.title}: {count}
          </p>
        );
      })}
      {unsectionedCount > 0 && (
        <p className="text-muted-foreground">Unsectioned: {unsectionedCount}</p>
      )}
    </div>
  );
}
