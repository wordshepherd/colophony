import { test, expect } from "../helpers/organization-fixtures";
import { addMember } from "../helpers/db";
import { removeMember, getMemberByEmail } from "../helpers/organization-db";

test.describe("Member Management (Members tab)", () => {
  test("displays member list with seeded members", async ({ authedPage }) => {
    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    // Assert table headers (scope to first table — members, not invitations)
    const membersTable = authedPage.getByRole("table").first();
    await expect(
      membersTable.getByRole("columnheader", { name: "Email" }),
    ).toBeVisible();
    await expect(
      membersTable.getByRole("columnheader", { name: "Role" }),
    ).toBeVisible();
    await expect(
      membersTable.getByRole("columnheader", { name: "Joined" }),
    ).toBeVisible();
    await expect(
      membersTable.getByRole("columnheader", { name: "Actions" }),
    ).toBeVisible();

    // At least one member row visible (header + data rows, minimum 2)
    const rowCount = await membersTable.getByRole("row").count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
    await expect(
      authedPage.getByRole("cell", { name: "editor@quarterlyreview.org" }),
    ).toBeVisible();

    // Invite Member button visible
    await expect(
      authedPage.getByRole("button", { name: "Invite Member" }),
    ).toBeVisible();
  });

  test("opens invite member dialog", async ({ authedPage }) => {
    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    await authedPage.getByRole("button", { name: "Invite Member" }).click();

    // Assert dialog title
    await expect(
      authedPage.getByRole("heading", { name: "Invite Member" }),
    ).toBeVisible();

    // Assert Email input and Role select visible (scope to dialog to avoid
    // "Email Templates" tab panel matching getByLabel('Email'))
    const dialog = authedPage.getByRole("dialog");
    await expect(dialog.getByLabel("Email")).toBeVisible();
    await expect(dialog.getByLabel("Role")).toBeVisible();

    // Assert action buttons
    await expect(
      authedPage.getByRole("button", { name: "Add Member" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: "Cancel" }),
    ).toBeVisible();
  });

  test("invites a member with READER role", async ({
    authedPage,
    seedOrg,
    inviteTarget,
  }) => {
    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    await authedPage.getByRole("button", { name: "Invite Member" }).click();

    // Fill email (scope to dialog to avoid "Email Templates" tab panel match)
    const dialog = authedPage.getByRole("dialog");
    await dialog.getByLabel("Email").fill(inviteTarget.email);

    // Role defaults to READER — leave as-is
    // Click Add Member
    await authedPage.getByRole("button", { name: "Add Member" }).click();

    // Assert success toast
    await expect(authedPage.getByText("Member added")).toBeVisible();

    // Assert new member appears in table
    await expect(
      authedPage.getByRole("cell", { name: inviteTarget.email }),
    ).toBeVisible();

    // Cleanup: remove the member via DB
    const member = await getMemberByEmail(seedOrg.id, inviteTarget.email);
    if (member) {
      await removeMember(member.id);
    }
  });

  test("changes member role via dropdown", async ({
    authedPage,
    seedOrg,
    inviteTarget,
  }) => {
    // Setup: invite target as READER via DB
    await addMember(seedOrg.id, inviteTarget.id, "READER");

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    // Find the invited member row and its role dropdown
    const memberRow = authedPage.getByRole("row").filter({
      hasText: inviteTarget.email,
    });
    await expect(memberRow).toBeVisible();

    // Open role select dropdown for that member
    const roleSelect = memberRow.getByRole("combobox");
    await roleSelect.click();

    // Select "Editor"
    await authedPage.getByRole("option", { name: "Editor" }).click();

    // Assert success toast
    await expect(authedPage.getByText("Roles updated")).toBeVisible();

    // Cleanup: remove the member via DB
    const member = await getMemberByEmail(seedOrg.id, inviteTarget.email);
    if (member) {
      await removeMember(member.id);
    }
  });

  test("removes a member with confirmation dialog", async ({
    authedPage,
    seedOrg,
    inviteTarget,
  }) => {
    // Setup: invite target as READER via DB
    await addMember(seedOrg.id, inviteTarget.id, "READER");

    await authedPage.goto("/organizations/settings");
    await authedPage.getByRole("tab", { name: "Members" }).click();

    // Find the invited member row
    const memberRow = authedPage.getByRole("row").filter({
      hasText: inviteTarget.email,
    });
    await expect(memberRow).toBeVisible();

    // Click the trash/remove button on that row
    await memberRow.getByRole("button").click();

    // Assert confirmation dialog
    await expect(
      authedPage.getByRole("heading", { name: "Remove member?" }),
    ).toBeVisible();
    await expect(
      authedPage.getByText(`remove ${inviteTarget.email}`),
    ).toBeVisible();

    // Click "Remove" in dialog
    await authedPage.getByRole("button", { name: "Remove" }).click();

    // Assert success toast
    await expect(authedPage.getByText("Member removed")).toBeVisible();

    // Assert member no longer in table
    await expect(
      authedPage.getByRole("cell", { name: inviteTarget.email }),
    ).not.toBeVisible();
  });
});
