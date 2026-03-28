import { test, expect } from "../helpers/organization-fixtures";
import { addMember } from "../helpers/db";
import {
  createInvitation,
  createExpiredInvitation,
  deleteInvitation,
  deleteInvitationsByEmail,
  getInvitationByEmail,
  markInvitationAccepted,
  getMemberByEmail,
  removeMember,
} from "../helpers/organization-db";

// ---------------------------------------------------------------------------
// Admin-side tests (org settings → Members tab)
// ---------------------------------------------------------------------------

test.describe("Email Invitations — Admin Side", () => {
  test("invite non-existing user shows 'Invitation sent' toast", async ({
    authedPage,
    seedOrg,
  }) => {
    const email = `nobody-${Date.now()}@test.example.com`;

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();
    await authedPage.getByRole("button", { name: "Invite Member" }).click();

    const dialog = authedPage.getByRole("dialog");
    await dialog.getByLabel("Email").fill(email);

    // Select Editor role
    await dialog.getByLabel("Role").click();
    await authedPage.getByRole("option", { name: "Editor" }).click();

    await authedPage.getByRole("button", { name: "Add Member" }).click();

    await expect(
      authedPage.getByText(`Invitation sent to ${email}`),
    ).toBeVisible();

    // Pending invitations section should appear
    await expect(
      authedPage.getByRole("heading", { name: "Pending Invitations" }),
    ).toBeVisible();

    // Email should be in the pending table
    await expect(authedPage.getByRole("cell", { name: email })).toBeVisible();

    // Cleanup
    await deleteInvitationsByEmail(seedOrg.id, email);
  });

  test("pending invitations table shows correct data", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const email = `pending-display-${Date.now()}@test.example.com`;
    const { id: invitationId } = await createInvitation({
      orgId: seedOrg.id,
      email,
      roles: ["EDITOR"],
      invitedBy: seedAdmin.id,
    });

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    await expect(
      authedPage.getByRole("heading", { name: "Pending Invitations" }),
    ).toBeVisible();

    // Verify the row data
    const row = authedPage.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText("Editor")).toBeVisible();

    // Cleanup
    await deleteInvitation(invitationId);
  });

  test("revoke invitation removes it from pending table", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const email = `revoke-target-${Date.now()}@test.example.com`;
    const { id: invitationId } = await createInvitation({
      orgId: seedOrg.id,
      email,
      roles: ["READER"],
      invitedBy: seedAdmin.id,
    });

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    const row = authedPage.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Revoke invitation" }).click();

    await expect(authedPage.getByText("Invitation revoked")).toBeVisible();

    // Row should disappear
    await expect(row).not.toBeVisible();

    // Verify DB state
    const inv = await getInvitationByEmail(seedOrg.id, email);
    expect(inv?.status).toBe("REVOKED");

    // Cleanup
    await deleteInvitation(invitationId);
  });

  test("resend invitation shows confirmation toast", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const email = `resend-target-${Date.now()}@test.example.com`;
    await createInvitation({
      orgId: seedOrg.id,
      email,
      roles: ["READER"],
      invitedBy: seedAdmin.id,
    });

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    const row = authedPage.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Resend invitation" }).click();

    await expect(authedPage.getByText("Invitation resent")).toBeVisible();

    // Row should still be present (new invitation replaces old)
    await expect(row).toBeVisible();

    // Cleanup (resend revokes old + creates new, so clean by email)
    await deleteInvitationsByEmail(seedOrg.id, email);
  });

  test("re-invite same email replaces old invitation with new role", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const email = `reinvite-target-${Date.now()}@test.example.com`;
    await createInvitation({
      orgId: seedOrg.id,
      email,
      roles: ["READER"],
      invitedBy: seedAdmin.id,
    });

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    // Verify initial invitation row
    const row = authedPage.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();

    // Invite same email with different role via dialog
    await authedPage.getByRole("button", { name: "Invite Member" }).click();
    const dialog = authedPage.getByRole("dialog");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Role").click();
    await authedPage.getByRole("option", { name: "Admin" }).click();
    await authedPage.getByRole("button", { name: "Add Member" }).click();

    await expect(
      authedPage.getByText(`Invitation sent to ${email}`),
    ).toBeVisible();

    // Should only be ONE row for that email
    const rows = authedPage.getByRole("row").filter({ hasText: email });
    await expect(rows).toHaveCount(1);

    // The role badge should show the new role
    await expect(rows.getByText("Admin")).toBeVisible();

    // Cleanup
    await deleteInvitationsByEmail(seedOrg.id, email);
  });

  test("invite existing member shows 'already a member' error", async ({
    authedPage,
    seedOrg,
    inviteTarget,
  }) => {
    // Add inviteTarget as a member first
    await addMember(seedOrg.id, inviteTarget.id, "READER");

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    await authedPage.getByRole("button", { name: "Invite Member" }).click();
    const dialog = authedPage.getByRole("dialog");
    await dialog.getByLabel("Email").fill(inviteTarget.email);

    await dialog.getByRole("button", { name: "Add Member" }).click();

    await expect(
      authedPage.getByText("This user is already a member"),
    ).toBeVisible({ timeout: 10_000 });

    // Cleanup
    const member = await getMemberByEmail(seedOrg.id, inviteTarget.email);
    if (member) {
      await removeMember(member.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Accept-side tests (accept page)
// ---------------------------------------------------------------------------

test.describe("Email Invitations — Accept Side", () => {
  test("accept valid invitation shows success", async ({
    inviteePage,
    seedOrg,
    seedAdmin,
    inviteTarget,
  }) => {
    const { id: invitationId, plainToken } = await createInvitation({
      orgId: seedOrg.id,
      email: inviteTarget.email,
      roles: ["READER"],
      invitedBy: seedAdmin.id,
    });

    await inviteePage.goto(`/invite/accept/${plainToken}`);

    await expect(inviteePage.getByText("You're in!")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      inviteePage.getByText("Redirecting to your new organization..."),
    ).toBeVisible();

    // Cleanup: remove member created by accept + delete invitation
    const member = await getMemberByEmail(seedOrg.id, inviteTarget.email);
    if (member) {
      await removeMember(member.id);
    }
    await deleteInvitation(invitationId);
  });

  test("accept with wrong email shows mismatch error", async ({
    inviteePage,
    seedOrg,
    seedAdmin,
  }) => {
    const { id: invitationId, plainToken } = await createInvitation({
      orgId: seedOrg.id,
      email: "wrong@example.com",
      roles: ["READER"],
      invitedBy: seedAdmin.id,
    });

    await inviteePage.goto(`/invite/accept/${plainToken}`);

    await expect(
      inviteePage.getByText(
        "Your email address does not match this invitation.",
      ),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      inviteePage.getByRole("button", { name: "Go to Dashboard" }),
    ).toBeVisible();

    // Cleanup
    await deleteInvitation(invitationId);
  });

  test("accept expired invitation shows expired error", async ({
    inviteePage,
    seedOrg,
    seedAdmin,
    inviteTarget,
  }) => {
    const { id: invitationId, plainToken } = await createExpiredInvitation({
      orgId: seedOrg.id,
      email: inviteTarget.email,
      roles: ["READER"],
      invitedBy: seedAdmin.id,
    });

    await inviteePage.goto(`/invite/accept/${plainToken}`);

    await expect(
      inviteePage.getByText("This invitation is invalid or has expired."),
    ).toBeVisible({ timeout: 15_000 });

    // Cleanup
    await deleteInvitation(invitationId);
  });

  test("accept already-accepted invitation shows conflict error", async ({
    inviteePage,
    seedOrg,
    seedAdmin,
    inviteTarget,
  }) => {
    const { id: invitationId, plainToken } = await createInvitation({
      orgId: seedOrg.id,
      email: inviteTarget.email,
      roles: ["READER"],
      invitedBy: seedAdmin.id,
    });
    await markInvitationAccepted(invitationId, inviteTarget.id);

    await inviteePage.goto(`/invite/accept/${plainToken}`);

    await expect(
      inviteePage.getByText("This invitation has already been accepted."),
    ).toBeVisible({ timeout: 15_000 });

    // Cleanup
    await deleteInvitation(invitationId);
  });

  test("accept with invalid token shows not-found error", async ({
    inviteePage,
  }) => {
    await inviteePage.goto("/invite/accept/col_inv_0000000000000000");

    await expect(
      inviteePage.getByText("This invitation is invalid or has expired."),
    ).toBeVisible({ timeout: 15_000 });
  });
});
