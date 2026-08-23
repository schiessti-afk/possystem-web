const DEFAULT_LIMIT = 25;

export default function ActivityFilters({
  from = "",
  to = "",
  limit = DEFAULT_LIMIT,
}: {
  from?: string;
  to?: string;
  limit?: number;
}) {
  const dirty = Boolean(from || to || limit !== DEFAULT_LIMIT);

  return (
    <form className="activity-filters" method="get" action="/">
      <label>
        From
        <input type="date" name="from" defaultValue={from} />
      </label>
      <label>
        To
        <input type="date" name="to" defaultValue={to} />
      </label>
      <label>
        Show
        <input
          type="number"
          name="limit"
          min={1}
          max={200}
          defaultValue={limit}
        />
      </label>
      <button type="submit">Apply</button>
      {dirty ? (
        <a className="filter-reset" href="/">
          Reset
        </a>
      ) : null}
    </form>
  );
}
