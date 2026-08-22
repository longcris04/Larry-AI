import React, { useEffect, useMemo, useState } from "react";
import { roleLabel } from "../../constants/roles";
import { formatDay, formatNumber } from "../../utils/days";
import { matchesQuery } from "../../utils/search";
import TablePager from "./TablePager";

const PAGE_SIZE = 10;

function displayName(user) {
  return user?.profile?.fullName || user?.username || "—";
}

export default function ReadOnlyAccounts({ accounts = [], description }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const rows = useMemo(
    () =>
      accounts.filter((account) =>
        matchesQuery(query, [
          account.username,
          account.profile?.fullName,
          account.phone,
          account.email,
          account.profile?.className,
          account.profile?.school,
          account.profile?.grade
        ])
      ),
    [accounts, query]
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => setPage(0), [query]);

  return (
    <div className="dash-card">
      <h3 className="dash-card__title">Tài khoản người dùng</h3>
      {description && <p className="dash-card__sub">{description}</p>}

      <label className="usage-field teacher-account-search">
        <span>Tìm tài khoản</span>
        <input
          type="search"
          className="usage-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tên, SĐT, email, lớp, trường…"
        />
      </label>

      <div className="admin-table-wrap">
        <table className="admin-table teacher-account-table">
          <thead>
            <tr>
              <th>Vai trò</th><th>Họ tên</th><th>Số điện thoại</th><th>Email</th>
              <th>Lớp</th><th>Trường</th><th>Khối</th><th>Ngày tạo</th>
              <th>Hội thoại</th><th>Gắn cờ</th><th>Khẩn cấp</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((account) => (
              <tr key={account.id}>
                <td>{roleLabel(account.role)}</td>
                <td><strong>{displayName(account)}</strong></td>
                <td>{account.phone || "—"}</td>
                <td>{account.email || "—"}</td>
                <td>{account.profile?.className || "—"}</td>
                <td>{account.profile?.school || "—"}</td>
                <td>{account.profile?.grade || "—"}</td>
                <td>{formatDay(account.createdAt?.slice(0, 10), true)}</td>
                <td>{formatNumber(account.sessionCount)}</td>
                <td>{formatNumber(account.flaggedCount)}</td>
                <td>{formatNumber(account.highRiskCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="dash-empty">Không có tài khoản khớp.</p>}
      </div>

      <TablePager
        page={safePage}
        pages={pages}
        onPage={setPage}
        pageSize={PAGE_SIZE}
        total={rows.length}
        unit="tài khoản"
      />
    </div>
  );
}
