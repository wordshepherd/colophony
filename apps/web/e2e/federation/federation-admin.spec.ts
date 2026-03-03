/**
 * Federation Admin E2E test suite — 16 tests.
 *
 * Validates federation admin UI pages: overview, peer management, sim-sub,
 * transfers, migrations, audit log, and hub admin.
 *
 * Data is seeded directly in the DB via federation-db.ts helpers.
 * Tests cover UI rendering and local-only admin actions (revoke, cancel, etc.).
 */

import { test, expect } from "./fixtures";

// ═══════════════════════════════════════════════════════════════════
// Federation Overview (2 tests)
// ═══════════════════════════════════════════════════════════════════

test.describe("Federation Overview", () => {
  test("renders federation overview with navigation cards", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation");

    // Heading
    await expect(page.getByRole("heading", { name: "Federation" })).toBeVisible(
      { timeout: 10_000 },
    );

    // Instance Configuration card
    await expect(page.getByText("Instance Configuration")).toBeVisible();

    // Trusted Peers summary card (CardTitle, not semantic heading)
    await expect(page.getByText("Trusted Peers")).toBeVisible();

    // Navigation cards
    await expect(page.getByText("Sim-Sub Checks")).toBeVisible();
    await expect(page.getByText("Piece Transfers")).toBeVisible();
    await expect(page.getByText("Identity Migrations")).toBeVisible();
    await expect(page.getByText("Hub Administration")).toBeVisible();
    await expect(page.getByText("Audit Log")).toBeVisible();
  });

  test("shows instance configuration details", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation");

    // Wait for config to load
    await expect(page.getByText("Instance Configuration")).toBeVisible({
      timeout: 10_000,
    });

    // Status badge (Enabled or Disabled)
    await expect(
      page.getByText("Enabled").or(page.getByText("Disabled")),
    ).toBeVisible();

    // Mode value (appears in config card + edit dialog; use .first())
    await expect(page.getByText("Mode").first()).toBeVisible();
    await expect(page.getByText("allowlist")).toBeVisible();

    // Capabilities list
    await expect(page.getByText("Capabilities")).toBeVisible();

    // Public key area
    await expect(page.getByText("Public Key")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Peer Management (4 tests)
// ═══════════════════════════════════════════════════════════════════

test.describe("Peer Management", () => {
  test("renders peer list with tab filtering", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/peers");

    // Wait for heading
    await expect(
      page.getByRole("heading", { name: "Trusted Peers" }),
    ).toBeVisible({ timeout: 10_000 });

    // Table headers
    await expect(
      page.getByRole("columnheader", { name: "Domain" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Status" }),
    ).toBeVisible();

    // Filter tabs
    const allTab = page.getByRole("tab", { name: "All" });
    const activeTab = page.getByRole("tab", { name: "Active" });
    const pendingTab = page.getByRole("tab", { name: "Pending" });
    const revokedTab = page.getByRole("tab", { name: "Revoked" });

    await expect(allTab).toBeVisible();
    await expect(activeTab).toBeVisible();
    await expect(pendingTab).toBeVisible();
    await expect(revokedTab).toBeVisible();

    // All peers visible on All tab
    await expect(page.getByText("active-peer.example.com")).toBeVisible();
    await expect(page.getByText("pending-peer.example.com")).toBeVisible();

    // Click Active tab — only active peer
    await activeTab.click();
    await expect(page.getByText("active-peer.example.com")).toBeVisible();
    await expect(page.getByText("pending-peer.example.com")).not.toBeVisible();

    // Click All tab — all peers visible again
    await allTab.click();
    await expect(page.getByText("active-peer.example.com")).toBeVisible();
    await expect(page.getByText("pending-peer.example.com")).toBeVisible();
  });

  test("navigates to peer detail page", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/peers");

    await expect(page.getByText("active-peer.example.com")).toBeVisible({
      timeout: 10_000,
    });

    // Click the peer row
    await page.getByText("active-peer.example.com").click();

    // Verify detail page
    await expect(
      page.getByRole("heading", { name: "active-peer.example.com" }),
    ).toBeVisible({ timeout: 10_000 });

    // Peer information card
    await expect(page.getByText("Peer Information")).toBeVisible();
    await expect(page.getByText("Public Key")).toBeVisible();

    // Capabilities card (CardTitle, not semantic heading)
    await expect(page.getByText("Granted Capabilities")).toBeVisible();
    await expect(page.getByText("identity.verify")).toBeVisible();
    await expect(page.getByText("simsub.check")).toBeVisible();
  });

  test("revokes an active peer", async ({
    authedPage: page,
    federationData,
  }) => {
    await page.goto(`/federation/peers/${federationData.activePeerId}`);

    // Wait for detail page
    await expect(
      page.getByRole("heading", { name: "active-peer.example.com" }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Revoke Trust button
    await page.getByRole("button", { name: "Revoke Trust" }).click();

    // Confirm in AlertDialog
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Revoke" })
      .click();

    // Verify success toast
    await expect(page.getByText("Trust revoked")).toBeVisible({
      timeout: 10_000,
    });

    // Verify status badge changes to revoked (exact: avoid toast "Trust revoked" + description text)
    await expect(page.getByText("revoked", { exact: true })).toBeVisible();
  });

  test("accepts a pending inbound peer", async ({
    authedPage: page,
    federationData,
  }) => {
    await page.goto(`/federation/peers/${federationData.pendingPeerId}`);

    // Wait for detail page
    await expect(
      page.getByRole("heading", { name: "pending-peer.example.com" }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Accept button
    await page.getByRole("button", { name: "Accept" }).click();

    // Verify AcceptPeerDialog opens
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Accept Trust Request")).toBeVisible();
    await expect(
      dialog.getByText("Grant Capabilities", { exact: true }),
    ).toBeVisible();

    // Capability checkboxes should be visible
    await expect(dialog.getByText("Identity Verification")).toBeVisible();
    await expect(dialog.getByText("Sim-Sub Check")).toBeVisible();

    // Click accept button in dialog
    await dialog
      .getByRole("button", { name: /Accept.*Grant Capabilities/ })
      .click();

    // Verify success toast
    await expect(page.getByText(/Trust accepted/)).toBeVisible({
      timeout: 10_000,
    });

    // Verify status changes to active
    await expect(page.getByText("active")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Sim-Sub Admin (2 tests)
// ═══════════════════════════════════════════════════════════════════

test.describe("Sim-Sub Admin", () => {
  test("renders sim-sub admin with lookup form", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/sim-sub");

    // Heading
    await expect(
      page.getByRole("heading", { name: "Sim-Sub Checks" }),
    ).toBeVisible({ timeout: 10_000 });

    // Lookup form
    await expect(page.getByText("Look Up Submission")).toBeVisible();
    await expect(page.getByPlaceholder("Submission UUID")).toBeVisible();
    await expect(page.getByRole("button", { name: "Look Up" })).toBeVisible();
  });

  test("shows check history for a submission", async ({
    authedPage: page,
    federationData,
  }) => {
    await page.goto("/federation/sim-sub");

    await expect(
      page.getByRole("heading", { name: "Sim-Sub Checks" }),
    ).toBeVisible({ timeout: 10_000 });

    // Enter submission ID and search
    await page
      .getByPlaceholder("Submission UUID")
      .fill(federationData.submissionId);
    await page.getByRole("button", { name: "Look Up" }).click();

    // Check history table appears (exact: CardDescription contains "check history" substring)
    await expect(page.getByText("Check History", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // Result badges
    await expect(page.getByText("CLEAR")).toBeVisible();
    await expect(page.getByText("CONFLICT")).toBeVisible();

    // CONFLICT row should show local conflicts
    await expect(page.getByText("Local conflicts:")).toBeVisible();
    await expect(page.getByText("Other Magazine")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Transfer Management (2 tests)
// ═══════════════════════════════════════════════════════════════════

test.describe("Transfer Management", () => {
  test("renders transfer list with tab filtering", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/transfers");

    // Heading
    await expect(
      page.getByRole("heading", { name: "Piece Transfers" }),
    ).toBeVisible({ timeout: 10_000 });

    // Filter tabs
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pending" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Completed" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Failed" })).toBeVisible();

    // Seeded transfer visible (scope to table — "Pending" tab matches case-insensitively)
    await expect(page.getByText("target-instance.example.com")).toBeVisible();
    await expect(
      page.locator("table").getByText("PENDING").first(),
    ).toBeVisible();
  });

  test("navigates to transfer detail and cancels", async ({
    authedPage: page,
    federationData,
  }) => {
    await page.goto(`/federation/transfers/${federationData.transferId}`);

    // Wait for detail page
    await expect(
      page.getByRole("heading", { name: "Transfer Detail" }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify key fields
    await expect(page.getByText("Submission ID")).toBeVisible();
    await expect(page.getByText("Target Domain")).toBeVisible();
    await expect(page.getByText("target-instance.example.com")).toBeVisible();
    await expect(page.getByText("PENDING").first()).toBeVisible();

    // Cancel transfer
    await page.getByRole("button", { name: "Cancel Transfer" }).click();

    // Confirm in AlertDialog
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel Transfer" })
      .click();

    // Verify success toast
    await expect(page.getByText("Transfer cancelled")).toBeVisible({
      timeout: 10_000,
    });

    // Status should change (use .first() — toast "cancelled" matches case-insensitively)
    await expect(page.getByText("CANCELLED").first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Migration Management (2 tests)
// ═══════════════════════════════════════════════════════════════════

test.describe("Migration Management", () => {
  test("renders migration list with direction filter", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/migrations");

    // Heading
    await expect(
      page.getByRole("heading", { name: "Identity Migrations" }),
    ).toBeVisible({ timeout: 10_000 });

    // Direction selector
    await expect(page.getByText("All Directions")).toBeVisible();

    // Status tabs
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Pending Approval" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "In Progress" })).toBeVisible();

    // Seeded migration visible
    await expect(page.getByText("migration-peer.example.com")).toBeVisible();
  });

  test("shows migration detail with action buttons", async ({
    authedPage: page,
    federationData,
  }) => {
    await page.goto(`/federation/migrations/${federationData.migrationId}`);

    // Wait for detail page
    await expect(
      page.getByRole("heading", { name: "Migration Detail" }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify key fields
    await expect(page.getByText("Direction")).toBeVisible();
    await expect(page.getByText("outbound")).toBeVisible();
    await expect(page.getByText("User DID", { exact: true })).toBeVisible();
    await expect(page.getByText("Peer Domain")).toBeVisible();
    // exact: "Peer Instance URL" field contains "https://migration-peer.example.com"
    await expect(
      page.getByText("migration-peer.example.com", { exact: true }),
    ).toBeVisible();

    // Action buttons visible for PENDING status (Cancel Migration)
    await expect(
      page.getByRole("button", { name: "Cancel Migration" }),
    ).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Audit Log (3 tests)
// ═══════════════════════════════════════════════════════════════════

test.describe("Audit Log", () => {
  test("renders audit log with filter panel", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/audit");

    // Heading
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible({
      timeout: 10_000,
    });

    // Collapsible filter panel
    await expect(page.getByText("Filters")).toBeVisible();

    // Open filters
    await page.getByText("Filters").click();

    // Filter fields (shadcn Select lacks htmlFor→id, so use select trigger text)
    await expect(page.getByText("All Actions")).toBeVisible();
    await expect(page.getByText("All Resources")).toBeVisible();

    // Events table (CardTitle, not semantic heading)
    await expect(page.getByText("Events", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Timestamp" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Action", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Resource", exact: true }),
    ).toBeVisible();
  });

  test("filters audit events by resource type", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/audit");

    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible({
      timeout: 10_000,
    });

    // Open filters
    await page.getByText("Filters").click();

    // Open resource dropdown via its trigger text
    await page.getByText("All Resources").click();

    // Select "federation"
    await page.getByRole("option", { name: "federation" }).click();

    // Table should update (may show events or empty state with period)
    await expect(
      page
        .getByText("Events", { exact: true })
        .or(page.getByText("No audit events found.")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows event detail in modal", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/audit");

    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible({
      timeout: 10_000,
    });

    // Wait for loading to finish — either table rows or empty state appears
    const firstRow = page.locator("table tbody tr").first();
    const emptyState = page.getByText("No audit events found.");
    await expect(firstRow.or(emptyState)).toBeVisible({ timeout: 10_000 });

    const hasEvents = await firstRow.isVisible().catch(() => false);

    if (hasEvents) {
      // Click first event row
      await firstRow.click();

      // Verify modal opens
      const eventDialog = page.getByRole("dialog");
      await expect(eventDialog.getByText("Audit Event Detail")).toBeVisible({
        timeout: 5_000,
      });

      // Modal should contain key fields (scope to dialog to avoid table header matches)
      await expect(eventDialog.getByText("Action")).toBeVisible();
      await expect(eventDialog.getByText("Resource")).toBeVisible();
    } else {
      // No events — verify empty state message
      await expect(emptyState).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Hub Admin (1 test)
// ═══════════════════════════════════════════════════════════════════

test.describe("Hub Admin", () => {
  test("shows hub mode not enabled message", async ({
    authedPage: page,
    federationData: _federationData,
  }) => {
    await page.goto("/federation/hub");

    // Hub page should show not-enabled message (default mode is allowlist)
    await expect(
      page.getByRole("heading", { name: "Hub Administration" }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText("Hub mode is not enabled on this instance"),
    ).toBeVisible();
  });
});
