import { clerkClient } from "@clerk/nextjs/server";
import { lmsPrisma } from "@/lib/lms/prisma";
import { getLessons } from "@/lib/lms/curriculum";
import {
  inviteStudent,
  revokeStudent,
  unbanStudent,
  revokeInvitation,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const client = await clerkClient();

  const [students, lessons, userList, inviteList] = await Promise.all([
    lmsPrisma.student.findMany({
      include: { progress: { select: { lessonDay: true } } },
      orderBy: { invitedAt: "asc" },
    }),
    getLessons(),
    client.users.getUserList({ limit: 200 }),
    client.invitations.getInvitationList({ status: "pending" }),
  ]);

  const total = lessons.length || 36;
  const bannedById = new Map(userList.data.map((u) => [u.id, u.banned]));
  const pending = inviteList.data;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Students</h1>
        <p className="mt-1 text-sm text-copilot-muted">
          Invite by email, track completion, revoke access.
        </p>
      </div>

      {/* Invite */}
      <form
        action={inviteStudent}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-copilot-border bg-copilot-sidebar p-4"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="student@example.com"
          className="min-w-64 flex-1 rounded border border-copilot-border bg-copilot-input px-3 py-2 text-sm text-copilot-text outline-none focus:border-copilot-accent"
        />
        <button
          type="submit"
          className="rounded bg-copilot-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Send invite
        </button>
      </form>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-copilot-muted">
            Pending invites ({pending.length})
          </h2>
          <ul className="mt-3 divide-y divide-copilot-border overflow-hidden rounded-lg border border-copilot-border">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between bg-copilot-sidebar px-4 py-2 text-sm"
              >
                <span className="text-copilot-text">{inv.emailAddress}</span>
                <form action={revokeInvitation}>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button className="text-xs text-copilot-muted hover:text-red-400">
                    Cancel
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Progress matrix */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-copilot-muted">
          Progress ({students.length} joined)
        </h2>
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-copilot-muted">
            No students have joined yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-copilot-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-copilot-sidebar">
                  <th className="sticky left-0 z-10 bg-copilot-sidebar px-3 py-2 text-left font-medium text-copilot-text">
                    Student
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-copilot-muted">
                    %
                  </th>
                  {lessons.map((l) => (
                    <th
                      key={l.day}
                      className={`w-6 px-0 py-2 text-center text-[10px] font-normal text-copilot-muted ${
                        (l.day - 1) % 6 === 0
                          ? "border-l-2 border-copilot-border"
                          : ""
                      }`}
                      title={`Day ${l.day}: ${l.title}`}
                    >
                      {l.day}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-copilot-muted">
                    Access
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const doneDays = new Set(s.progress.map((p) => p.lessonDay));
                  const pct = Math.round((doneDays.size / total) * 100);
                  const banned = bannedById.get(s.id) ?? false;
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-copilot-border hover:bg-copilot-sidebar/50"
                    >
                      <td className="sticky left-0 z-10 bg-copilot-bg px-3 py-2 text-copilot-text">
                        {s.email || s.id}
                        {banned && (
                          <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
                            revoked
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-copilot-muted">
                        {pct}
                      </td>
                      {lessons.map((l) => (
                        <td
                          key={l.day}
                          className={`px-0 py-2 text-center ${
                            (l.day - 1) % 6 === 0
                              ? "border-l-2 border-copilot-border"
                              : ""
                          }`}
                        >
                          <span
                            className={`mx-auto block h-2 w-2 rounded-full ${
                              doneDays.has(l.day)
                                ? "bg-green-500"
                                : "bg-copilot-input"
                            }`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        {banned ? (
                          <form action={unbanStudent}>
                            <input type="hidden" name="userId" value={s.id} />
                            <button className="text-xs text-copilot-accent hover:underline">
                              Restore
                            </button>
                          </form>
                        ) : (
                          <form action={revokeStudent}>
                            <input type="hidden" name="userId" value={s.id} />
                            <button className="text-xs text-copilot-muted hover:text-red-400">
                              Revoke
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
