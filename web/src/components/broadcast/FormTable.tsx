type FormTableRow = {
  teamName: string;
  formScore: string;
  profitChange: string;
};

type FormTableProps = {
  title: string;
  rows: FormTableRow[];
};

export function FormTable({ title, rows }: FormTableProps) {
  return (
    <div className="broadcast-form-table">
      <div className="broadcast-form-table-head">
        <span>Form Table</span>
        <strong>{title}</strong>
      </div>
      <div className="broadcast-form-table-grid">
        <span>Team</span>
        <span>Form</span>
        <span>Profit</span>
      </div>
      <div className="broadcast-form-table-body">
        {rows.map((row) => (
          <div key={`${row.teamName}-${row.formScore}-${row.profitChange}`} className="broadcast-form-table-grid row">
            <strong>{row.teamName}</strong>
            <span>{row.formScore}</span>
            <span>{row.profitChange}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
